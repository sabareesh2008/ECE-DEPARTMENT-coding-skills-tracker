#!/usr/bin/env python3
"""
ECE LeetCode Platform - Automated Daily / Weekly Email Reports

Data sources:
- LiveData.csv       -> LeetCode tracker metrics
- LeetCode public profile feed -> exact 07:00-to-07:00 accepted activity

Email:
- Gmail SMTP
- Section-wise recipient routing for ECE A-F and HOD Overall.
- Recipient fields support comma/semicolon/newline-separated addresses.

Environment variables:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  RESEND_API_KEY
  REPORT_FROM_EMAIL
  REPORT_TO_EMAILS
  REPORT_REPLY_TO              optional
"""

from __future__ import annotations
import smtplib
from email.message import EmailMessage
from email.utils import formataddr
import mimetypes

import argparse
import base64
import html
import json
import os
import sys
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone, time as dt_time
from pathlib import Path
from typing import Any, Iterable
from zoneinfo import ZoneInfo

import pandas as pd
import requests
import tracker as leetcode_tracker
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak

ROOT = Path(__file__).resolve().parent
LIVE_DATA_PATH = ROOT / "LiveData.csv"
REPORT_DIR = ROOT / "reports"

REPORT_ACTIVITY_QUERY = """
query reportActivity($username: String!, $acceptedLimit: Int!) {
  matchedUser(username: $username) {
    username
    submitStatsGlobal {
      acSubmissionNum { difficulty count submissions }
      totalSubmissionNum { difficulty count submissions }
    }
  }
  recentAcSubmissionList(username: $username, limit: $acceptedLimit) {
    title
    titleSlug
    timestamp
  }
  recentSubmissionList(username: $username) {
    title
    titleSlug
    timestamp
    statusDisplay
  }
}
"""

IST = ZoneInfo("Asia/Kolkata")
RESEND_ENDPOINT = "https://api.resend.com/emails"
MAX_RECIPIENTS_PER_EMAIL = 50
REQUEST_TIMEOUT = 30

SECTIONS = ["ECE A", "ECE B", "ECE C", "ECE D", "ECE E", "ECE F"]


@dataclass
class Config:
    supabase_url: str
    supabase_key: str
    gmail_address: str
    gmail_app_password: str
    recipients: list[str]
    section_recipients: dict[str, list[str]]
    hod_recipients: list[str]
    reply_to: str | None


def env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def parse_recipients(raw: str) -> list[str]:
    """Parse comma/semicolon/newline-separated emails and remove duplicates."""
    normalized = raw.replace(";", ",").replace("\n", ",")
    seen: set[str] = set()
    result: list[str] = []

    for item in normalized.split(","):
        address = item.strip()
        if not address:
            continue

        lower = address.lower()

        if lower in seen:
            continue

        if "@" not in address or address.startswith("@") or address.endswith("@"):
            raise ValueError(f"Invalid report recipient email: {address}")

        seen.add(lower)
        result.append(address)

    return result


def section_secret_name(section: str) -> str:
    return f"REPORT_{section.replace(' ', '_')}_EMAILS"


def load_config(require_email: bool = True) -> Config:
    legacy_recipients = parse_recipients(env("REPORT_TO_EMAILS"))
    section_recipients = {
        section: parse_recipients(env(section_secret_name(section)))
        for section in SECTIONS
    }
    hod_recipients = parse_recipients(env("REPORT_HOD_EMAILS"))
    if not hod_recipients:
        hod_recipients = list(legacy_recipients)
    config = Config(
        supabase_url=env("SUPABASE_URL").rstrip("/"),
        supabase_key=env("SUPABASE_SERVICE_ROLE_KEY"),
        gmail_address=env("GMAIL_ADDRESS"),
        gmail_app_password=env("GMAIL_APP_PASSWORD"),
        recipients=legacy_recipients,
        section_recipients=section_recipients,
        hod_recipients=hod_recipients,
        reply_to=env("REPORT_REPLY_TO") or None,
    )
    missing = []
    if require_email:
        if not config.gmail_address:
            missing.append("GMAIL_ADDRESS")
        if not config.gmail_app_password:
            missing.append("GMAIL_APP_PASSWORD")
        if not config.hod_recipients and not any(config.section_recipients.values()):
            missing.append("REPORT_HOD_EMAILS or at least one REPORT_ECE_*_EMAILS secret")
    if missing:
        raise RuntimeError("Missing required environment variable(s): " + ", ".join(missing))
    return config


def scope_slug(scope_label: str) -> str:
    return (
        str(scope_label)
        .strip()
        .upper()
        .replace(" ", "_")
        .replace("/", "_")
    )


def safe_int(value: Any) -> int:
    try:
        if pd.isna(value):
            return 0
        return int(float(value))
    except (TypeError, ValueError):
        return 0


def esc(value: Any) -> str:
    return html.escape(str(value if value is not None else ""))


def percent(numerator: float, denominator: float) -> float:
    return (numerator / denominator * 100.0) if denominator else 0.0


def chunks(items: list[str], size: int) -> Iterable[list[str]]:
    for index in range(0, len(items), size):
        yield items[index:index + size]


def ist_now() -> datetime:
    return datetime.now(IST)


def iso_date_ist() -> str:
    return ist_now().date().isoformat()


def parse_datetime(value: Any) -> datetime | None:
    """Parse Supabase timestamps and return an IST-aware datetime when possible."""
    if value is None or value == "":
        return None
    try:
        text = str(value).replace("Z", "+00:00")
        dt = datetime.fromisoformat(text)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(IST)
    except (TypeError, ValueError):
        return None


def supabase_get(
    config: Config,
    table: str,
    params: dict[str, str] | None = None,
) -> list[dict[str, Any]]:
    response = requests.get(
        f"{config.supabase_url}/rest/v1/{table}",
        headers={
            "apikey": config.supabase_key,
            "Authorization": f"Bearer {config.supabase_key}",
            "Accept": "application/json",
        },
        params=params or {"select": "*"},
        timeout=REQUEST_TIMEOUT,
    )
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, list):
        raise RuntimeError(f"Unexpected Supabase response for {table}")
    return payload


def load_live_data() -> pd.DataFrame:
    if not LIVE_DATA_PATH.exists():
        raise FileNotFoundError(f"Missing {LIVE_DATA_PATH.name}")
    frame = pd.read_csv(LIVE_DATA_PATH, dtype={"Register Number": str})
    required = {
        "Section", "Register Number", "Student Name", "LeetCode Username",
        "Problems Solved", "Solved Today", "Last 7 Days", "Last 14 Days",
        "Last 30 Days", "Last 7 Days Submissions", "Total Submissions", "Status",
    }
    missing = sorted(required - set(frame.columns))
    if missing:
        raise RuntimeError("LiveData.csv is missing required column(s): " + ", ".join(missing))
    for col in ["Register Number","Section","LeetCode Username"]:
        frame[col] = frame[col].fillna("").astype(str).str.strip()
    for col in ["Problems Solved","Solved Today","Last 7 Days","Last 14 Days","Last 30 Days","Last 7 Days Submissions","Total Submissions","Easy","Medium","Hard"]:
        if col not in frame.columns:
            frame[col]=0
        frame[col]=pd.to_numeric(frame[col],errors="coerce").fillna(0).astype(int)
    return frame



def _report_stat(items: list[dict[str, Any]], difficulty: str, field: str) -> int:
    for item in items or []:
        if str(item.get("difficulty", "")).lower() == difficulty.lower():
            return safe_int(item.get(field, 0))
    return 0


def _normalize_report_submissions(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result=[]
    for row in rows or []:
        try:
            submitted_at=datetime.fromtimestamp(int(row.get("timestamp")),tz=IST)
        except (TypeError,ValueError,OSError):
            continue
        item=dict(row)
        item["_submitted_at"]=submitted_at
        item["_problem_key"]=str(item.get("titleSlug") or item.get("title") or "").strip()
        result.append(item)
    result.sort(key=lambda x:x["_submitted_at"],reverse=True)
    return result


def _report_feed_covers(rows: list[dict[str, Any]], lifetime_count: int, start_time: datetime) -> bool:
    lifetime_count=max(0,safe_int(lifetime_count))
    if lifetime_count==0: return True
    if not rows: return False
    if len(rows)>=lifetime_count: return True
    oldest=rows[-1].get("_submitted_at")
    return bool(isinstance(oldest,datetime) and oldest<=start_time)


def _count_attempts_between(rows: list[dict[str, Any]], start_time: datetime, end_time: datetime) -> int:
    return sum(1 for row in rows if isinstance(row.get("_submitted_at"),datetime) and start_time<=row["_submitted_at"]<end_time)


def _count_solved_between(rows: list[dict[str, Any]], start_time: datetime, end_time: datetime) -> int:
    solved=set()
    for row in rows:
        dt=row.get("_submitted_at"); key=row.get("_problem_key")
        if isinstance(dt,datetime) and key and start_time<=dt<end_time:
            solved.add(str(key))
    return len(solved)


def fetch_report_activity(username: str, start_time: datetime, end_time: datetime) -> dict[str, Any]:
    """Fetch report data without requesting the private submission calendar."""
    if not username:
        return {"status":"Username missing","solved":0,"solved_coverage":"ERROR","recent_attempts":0,"attempt_coverage":"ERROR","current_total_submissions":None}
    body={"operationName":"reportActivity","query":REPORT_ACTIVITY_QUERY,"variables":{"username":username,"acceptedLimit":2000}}
    headers={"Content-Type":"application/json","Accept":"application/json","Origin":"https://leetcode.com","Referer":f"https://leetcode.com/u/{username}/","User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36"}
    last_error=""
    for attempt in range(1,4):
        try:
            response=requests.post(leetcode_tracker.LEETCODE_URL,json=body,headers=headers,timeout=35)
            if response.status_code in {429,500,502,503,504} and attempt<3:
                import time; time.sleep(attempt*2); continue
            if response.status_code!=200:
                return {"status":f"HTTP {response.status_code}","solved":0,"solved_coverage":"ERROR","recent_attempts":0,"attempt_coverage":"ERROR","current_total_submissions":None}
            payload=response.json(); data=payload.get("data",{}) or {}; matched=data.get("matchedUser")
            if matched is None:
                return {"status":"User not found","solved":0,"solved_coverage":"ERROR","recent_attempts":0,"attempt_coverage":"ERROR","current_total_submissions":None}
            stats=matched.get("submitStatsGlobal",{}) or {}; ac=stats.get("acSubmissionNum",[]) or []; total=stats.get("totalSubmissionNum",[]) or []
            lifetime_ac=_report_stat(ac,"All","submissions")
            lifetime_total=max(_report_stat(total,"All","submissions"),_report_stat(total,"All","count"))
            ac_rows=_normalize_report_submissions(data.get("recentAcSubmissionList",[]) or [])
            attempt_rows=_normalize_report_submissions(data.get("recentSubmissionList",[]) or [])
            solved=_count_solved_between(ac_rows,start_time,end_time)
            attempts=_count_attempts_between(attempt_rows,start_time,end_time)
            return {"status":"Success","solved":solved,"solved_coverage":"FULL" if _report_feed_covers(ac_rows,lifetime_ac,start_time) else "PARTIAL","recent_attempts":attempts,"attempt_coverage":"FULL" if _report_feed_covers(attempt_rows,lifetime_total,start_time) else "PARTIAL","current_total_submissions":lifetime_total}
        except Exception as exc:
            last_error=str(exc)
            if attempt<3:
                import time; time.sleep(attempt*2)
    return {"status":last_error or "LeetCode fetch failed","solved":0,"solved_coverage":"ERROR","recent_attempts":0,"attempt_coverage":"ERROR","current_total_submissions":None}


def supabase_report_snapshot_get(config: Config, boundary: datetime, register_numbers: list[str]) -> dict[str,int]:
    if not config.supabase_url or not config.supabase_key or not register_numbers: return {}
    boundary_text=boundary.astimezone(timezone.utc).isoformat()
    try:
        rows=supabase_get(config,"report_submission_snapshots",params={"select":"register_number,total_submissions,boundary_at","boundary_at":f"eq.{boundary_text}"})
    except Exception:
        return {}
    wanted={str(x).strip() for x in register_numbers}
    return {str(r.get("register_number","")).strip():safe_int(r.get("total_submissions")) for r in rows if str(r.get("register_number","")).strip() in wanted}


def supabase_report_snapshot_upsert(config: Config, live: pd.DataFrame, boundary: datetime) -> None:
    if not config.supabase_url or not config.supabase_key or live.empty: return
    age=ist_now()-boundary
    if age.total_seconds()<0 or age>timedelta(minutes=45): return
    rows=[]
    for _,row in live.iterrows():
        current=row.get("_Current Total Submissions")
        if current is None or pd.isna(current): continue
        reg=str(row.get("Register Number","")).strip()
        if not reg: continue
        rows.append({"register_number":reg,"boundary_at":boundary.astimezone(timezone.utc).isoformat(),"total_submissions":safe_int(current)})
    if not rows: return
    response=requests.post(f"{config.supabase_url}/rest/v1/report_submission_snapshots",headers={"apikey":config.supabase_key,"Authorization":f"Bearer {config.supabase_key}","Content-Type":"application/json","Prefer":"resolution=merge-duplicates,return=minimal"},params={"on_conflict":"register_number,boundary_at"},json=rows,timeout=REQUEST_TIMEOUT)
    response.raise_for_status()


def _display_submission(value: Any, coverage: Any) -> str:
    c=str(coverage or "").upper(); amount=max(0,safe_int(value))
    if c in {"EXACT","FULL","OFFLINE"}: return str(amount)
    if c=="PARTIAL": return f"{amount}+" if amount else "N/A"
    return "N/A"

def latest_7am_boundary(now: datetime | None = None) -> datetime:
    current = now.astimezone(IST) if now else ist_now()
    boundary = datetime.combine(current.date(), dt_time(hour=7), tzinfo=IST)
    if current < boundary:
        boundary -= timedelta(days=1)
    return boundary


def format_window(start: datetime, end: datetime) -> str:
    return f"{start.strftime('%d %b %Y %I:%M %p')} to {end.strftime('%d %b %Y %I:%M %p')} IST"


def count_distinct_accepted_between(recent_submissions, start_time: datetime, end_time: datetime) -> int:
    solved=set()
    for item in recent_submissions or []:
        dt=item.get("_submitted_at"); key=item.get("_problem_key")
        if isinstance(dt,datetime) and key and start_time <= dt < end_time:
            solved.add(str(key))
    return len(solved)


def _window_activity_for_username(username: str, start_time: datetime, end_time: datetime) -> dict[str, Any]:
    if not username:
        return {"solved":0,"coverage":"ERROR","status":"Username missing"}
    profile=leetcode_tracker.fetch_leetcode(username)
    status=str(profile.get("status","")).strip()
    if status != "Success":
        return {"solved":0,"coverage":"ERROR","status":status or "LeetCode fetch failed"}
    recent=profile.get("recent_submissions",[]) or []
    solved=count_distinct_accepted_between(recent,start_time,end_time)
    full=leetcode_tracker.accepted_feed_covers_window(
        recent, profile.get("accepted_submission_total",0), start_time
    )
    return {"solved":solved,"coverage":"FULL" if full else "PARTIAL","status":"Success"}



def refresh_report_window_activity(live: pd.DataFrame, start_time: datetime, end_time: datetime, config: Config, offline: bool=False) -> pd.DataFrame:
    frame=live.copy()
    if frame.empty:
        for c in ["Report Window Solved","Report Window Coverage","Report Window Status","Report Window Submissions","Report Submission Coverage","_Current Total Submissions"]: frame[c]=pd.Series(dtype="object")
        return frame
    if offline:
        preview="Solved Today" if (end_time-start_time)<=timedelta(days=1) else "Last 7 Days"
        frame["Report Window Solved"]=frame[preview].fillna(0).astype(int)
        frame["Report Window Submissions"]=frame["Last 7 Days Submissions"].fillna(0).astype(int) if "Last 7 Days Submissions" in frame.columns else 0
        frame["Report Window Coverage"]="OFFLINE"; frame["Report Submission Coverage"]="OFFLINE"; frame["Report Window Status"]="Offline preview"; frame["_Current Total Submissions"]=None
        return frame
    registers=frame["Register Number"].fillna("").astype(str).str.strip().tolist(); usernames=frame["LeetCode Username"].fillna("").astype(str).str.strip().tolist()
    baseline=supabase_report_snapshot_get(config,start_time,registers)
    unique=list(dict.fromkeys(u for u in usernames if u)); results={}
    with ThreadPoolExecutor(max_workers=6) as ex:
        fmap={ex.submit(fetch_report_activity,u,start_time,end_time):u for u in unique}
        for f in as_completed(fmap):
            u=fmap[f]
            try: results[u]=f.result()
            except Exception as e: results[u]={"status":f"Report fetch error: {e}","solved":0,"solved_coverage":"ERROR","recent_attempts":0,"attempt_coverage":"ERROR","current_total_submissions":None}
    solved=[]; scov=[]; subs=[]; subcov=[]; statuses=[]; currents=[]
    for reg,u in zip(registers,usernames):
        r=results.get(u,{"status":"Username missing","solved":0,"solved_coverage":"ERROR","recent_attempts":0,"attempt_coverage":"ERROR","current_total_submissions":None})
        solved.append(max(0,safe_int(r.get("solved",0)))); scov.append(str(r.get("solved_coverage","ERROR"))); current=r.get("current_total_submissions"); currents.append(current)
        old=baseline.get(reg)
        if old is not None and current is not None:
            subs.append(max(0,safe_int(current)-safe_int(old))); subcov.append("EXACT")
        else:
            subs.append(max(0,safe_int(r.get("recent_attempts",0)))); subcov.append(str(r.get("attempt_coverage","ERROR")))
        statuses.append(str(r.get("status","Unknown")))
    frame["Report Window Solved"]=solved; frame["Report Window Coverage"]=scov; frame["Report Window Submissions"]=subs; frame["Report Submission Coverage"]=subcov; frame["Report Window Status"]=statuses; frame["_Current Total Submissions"]=currents
    return frame



def report_window_masks(live: pd.DataFrame):
    solved=pd.to_numeric(live["Report Window Solved"],errors="coerce").fillna(0)
    subs=pd.to_numeric(live["Report Window Submissions"],errors="coerce").fillna(0)
    scov=live["Report Window Coverage"].fillna("ERROR").astype(str).str.upper(); subcov=live["Report Submission Coverage"].fillna("ERROR").astype(str).str.upper()
    active=(solved>0)|(subs>0)
    reliable_solved=scov.isin(["FULL","OFFLINE"]); reliable_subs=subcov.isin(["EXACT","FULL","OFFLINE"])
    inactive=(solved==0)&(subs==0)&reliable_solved&reliable_subs
    unknown=(~active)&(~inactive)
    return active,inactive,unknown



def inactive_students(live: pd.DataFrame):
    _,mask,_=report_window_masks(live); rows=live[mask].sort_values(["Section","Register Number"],kind="stable")
    return [{"name":r.get("Student Name","Student"),"register":r.get("Register Number",""),"section":r.get("Section",""),"solved":safe_int(r.get("Report Window Solved")),"window_submissions":safe_int(r.get("Report Window Submissions")),"submission_coverage":r.get("Report Submission Coverage","ERROR"),"week":safe_int(r.get("Last 7 Days")),"fortnight":safe_int(r.get("Last 14 Days")),"month":safe_int(r.get("Last 30 Days")),"total":safe_int(r.get("Problems Solved")),"easy":safe_int(r.get("Easy")),"medium":safe_int(r.get("Medium")),"hard":safe_int(r.get("Hard"))} for _,r in rows.iterrows()]



def report_window_students(live: pd.DataFrame,count:int=10,ascending:bool=False,exclude_inactive:bool=False):
    subset=live[live["Report Window Coverage"].fillna("ERROR").astype(str).str.upper().ne("ERROR")].copy()
    if exclude_inactive and not subset.empty:
        _,mask,_=report_window_masks(subset); subset=subset[~mask].copy()
    if subset.empty: return []
    subset["_ws"]=pd.to_numeric(subset["Report Window Solved"],errors="coerce").fillna(0); subset["_sub"]=pd.to_numeric(subset["Report Window Submissions"],errors="coerce").fillna(0)
    subset=subset.sort_values(["_ws","_sub","Problems Solved"],ascending=[ascending,ascending,ascending],kind="stable").head(count)
    return [{"name":r.get("Student Name","Student"),"register":r.get("Register Number",""),"section":r.get("Section",""),"value":safe_int(r.get("Report Window Solved")),"window_submissions":safe_int(r.get("Report Window Submissions")),"submission_coverage":r.get("Report Submission Coverage","ERROR"),"week":safe_int(r.get("Last 7 Days")),"fortnight":safe_int(r.get("Last 14 Days")),"month":safe_int(r.get("Last 30 Days")),"total":safe_int(r.get("Problems Solved")),"easy":safe_int(r.get("Easy")),"medium":safe_int(r.get("Medium")),"hard":safe_int(r.get("Hard"))} for _,r in subset.iterrows()]



def section_report_summary(live: pd.DataFrame):
    rows=[]; sections=SECTIONS+sorted({x for x in live["Section"].dropna().astype(str) if x and x not in SECTIONS})
    for sec in sections:
        sub=live[live["Section"]==sec]
        if sub.empty: continue
        a,i,u=report_window_masks(sub)
        rows.append({"section":sec,"students":len(sub),"active":int(a.sum()),"inactive":int(i.sum()),"unknown":int(u.sum()),"window_solved":int(pd.to_numeric(sub["Report Window Solved"],errors="coerce").fillna(0).sum()),"window_submissions":int(pd.to_numeric(sub["Report Window Submissions"],errors="coerce").fillna(0).sum()),"week":int(sub["Last 7 Days"].sum()),"fortnight":int(sub["Last 14 Days"].sum()),"month":int(sub["Last 30 Days"].sum())})
    return rows


def index_students(
    live: pd.DataFrame,
    supabase_students: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}

    for _, row in live.iterrows():
        register = str(row.get("Register Number", "")).strip()
        if not register:
            continue
        result[register] = {
            "register_number": register,
            "student_name": str(row.get("Student Name", "")).strip(),
            "section": str(row.get("Section", "")).strip(),
        }

    for student in supabase_students:
        register = str(student.get("register_number", "")).strip()
        if not register:
            continue
        current = result.setdefault(register, {"register_number": register})
        if student.get("student_name"):
            current["student_name"] = str(student["student_name"]).strip()
        if student.get("section"):
            current["section"] = str(student["section"]).strip()

    return result


def daily_challenge_stats_in_window(
    start_time,
    end_time,
    challenges,
    challenge_results,
    total_students,
):
    """
    Daily Challenge statistics for the exact reporting window.

    Example:
        Aug 24 07:00 AM IST
        ->
        Aug 25 07:00 AM IST
    """

    # --------------------------------------------------------
    # Find the Daily Challenge belonging to this 24-hour window
    # --------------------------------------------------------

    window_challenges = []

    for challenge in challenges:

        raw_time = (
            challenge.get("created_at")
            or challenge.get("starts_at")
            or challenge.get("challenge_date")
        )

        challenge_time = parse_datetime(raw_time)

        if not challenge_time:
            continue

        if start_time <= challenge_time < end_time:
            window_challenges.append(challenge)

    # Use the latest challenge in the reporting window
    challenge = (
        window_challenges[-1]
        if window_challenges
        else None
    )

    if not challenge:
        return {
            "exists": False,
            "title": "No Daily Challenge posted",
            "completed": 0,
            "pending": total_students,
            "completion_rate": 0.0,
        }

    challenge_id = str(
        challenge.get("id", "")
    )

    # --------------------------------------------------------
    # Find students who completed this challenge
    # between 7 AM -> next 7 AM
    # --------------------------------------------------------

    completed_registers = set()

    for result in challenge_results:

        if str(
            result.get("challenge_id", "")
        ) != challenge_id:
            continue

        if not bool(
            result.get("completed")
        ):
            continue

        raw_time = (
            result.get("completed_at")
            or result.get("submitted_at")
            or result.get("created_at")
        )

        result_time = parse_datetime(raw_time)

        if not result_time:
            continue

        if not (
            start_time
            <= result_time
            < end_time
        ):
            continue

        register_number = str(
            result.get(
                "register_number",
                ""
            )
        ).strip()

        if register_number:
            completed_registers.add(
                register_number
            )

    completed = len(
        completed_registers
    )

    return {
        "exists": True,

        "title": (
            challenge.get("title")
            or challenge.get("problem_title")
            or challenge.get("problem_name")
            or "Daily Challenge"
        ),

        "completed": completed,

        "pending": max(
            total_students - completed,
            0,
        ),

        "completion_rate": (
            completed
            / total_students
            * 100
            if total_students
            else 0.0
        ),
    }
def coding_tests_in_window(
    tests: list[dict[str, Any]],
    start: datetime,
    end: datetime,
) -> list[dict[str, Any]]:
    selected = []
    for test in tests:
        dt = parse_datetime(test.get("starts_at"))
        if dt and start <= dt < end:
            selected.append(test)
    return selected


def coding_test_summary(
    tests: list[dict[str, Any]],
    attempts: list[dict[str, Any]],
    total_students: int,
) -> dict[str, Any]:
    test_ids = {str(test.get("id")) for test in tests}
    finals = [
        attempt
        for attempt in attempts
        if str(attempt.get("test_id")) in test_ids
        and attempt.get("status") in ("submitted", "expired")
    ]

    unique_attendees = {
        str(item.get("register_number", "")).strip()
        for item in finals
        if item.get("register_number")
    }
    passed = sum(
        1 for item in finals if item.get("result_status") == "passed"
    )
    failed = len(finals) - passed
    total_cases = sum(safe_int(item.get("total_cases")) for item in finals)
    passed_cases = sum(safe_int(item.get("passed_cases")) for item in finals)
    violations = sum(
        safe_int(item.get("violation_count")) for item in finals
    )

    score_percentages: list[float] = []
    test_by_id = {str(test.get("id")): test for test in tests}
    for attempt in finals:
        test = test_by_id.get(str(attempt.get("test_id")), {})
        total_marks = float(test.get("total_marks") or 0)
        if total_marks > 0:
            score_percentages.append(
                float(attempt.get("total_score") or 0) / total_marks * 100
            )

    return {
        "tests_conducted": len(tests),
        "attended": len(unique_attendees),
        "not_attended": max(total_students - len(unique_attendees), 0)
        if len(tests) == 1
        else None,
        "passed": passed,
        "failed": failed,
        "pass_rate": percent(passed, len(finals)),
        "average_score": (
            sum(score_percentages) / len(score_percentages)
            if score_percentages
            else 0.0
        ),
        "passed_cases": passed_cases,
        "total_cases": total_cases,
        "violations": violations,
    }


def section_leetcode_summary(live: pd.DataFrame) -> list[dict[str, Any]]:
    rows = []
    sections = SECTIONS + sorted(
        {
            value
            for value in live["Section"].dropna().astype(str)
            if value and value not in SECTIONS
        }
    )
    for section in sections:
        subset = live[live["Section"] == section]
        if subset.empty:
            continue
        rows.append(
            {
                "section": section,
                "students": len(subset),
                "today": int(subset["Solved Today"].sum()),
                "week": int(subset["Last 7 Days"].sum()),
                "month": int(subset["Last 30 Days"].sum()),
                "active_today": int((subset["Solved Today"] > 0).sum()),
            }
        )
    return rows


def top_students(
    live: pd.DataFrame,
    metric: str,
    count: int = 10,
) -> list[dict[str, Any]]:
    if metric not in live.columns:
        return []

    ordered = live.sort_values(
        by=[metric, "Problems Solved"],
        ascending=[False, False],
        kind="stable",
    ).head(count)

    return [
        {
            "name": row.get("Student Name", "Student"),
            "register": row.get("Register Number", ""),
            "section": row.get("Section", ""),
            "value": safe_int(row.get(metric)),
            "total": safe_int(row.get("Problems Solved")),
        }
        for _, row in ordered.iterrows()
    ]


def bottom_students_week(live: pd.DataFrame, count: int = 10) -> list[dict[str, Any]]:
    ordered = live.sort_values(
        by=["Last 7 Days", "Problems Solved"],
        ascending=[True, True],
        kind="stable",
    ).head(count)

    return [
        {
            "name": row.get("Student Name", "Student"),
            "register": row.get("Register Number", ""),
            "section": row.get("Section", ""),
            "value": safe_int(row.get("Last 7 Days")),
            "total": safe_int(row.get("Problems Solved")),
        }
        for _, row in ordered.iterrows()
    ]


def table_html(headers: list[str], rows: list[list[Any]]) -> str:
    if not rows:
        return '<p class="muted">No data available.</p>'

    head = "".join(f"<th>{esc(item)}</th>" for item in headers)
    body = "".join(
        "<tr>" + "".join(f"<td>{esc(cell)}</td>" for cell in row) + "</tr>"
        for row in rows
    )

    return f"""
    <div class="table-wrap">
      <table>
        <thead><tr>{head}</tr></thead>
        <tbody>{body}</tbody>
      </table>
    </div>
    """


def report_shell(title: str, subtitle: str, content: str) -> str:
    return f"""<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {{
    margin: 0; padding: 0; background: #f3f6fa;
    font-family: Arial, Helvetica, sans-serif; color: #172033;
  }}
  .wrap {{ max-width: 920px; margin: 0 auto; padding: 24px; }}
  .hero {{
    background: #101b31; color: white; border-radius: 18px;
    padding: 28px; margin-bottom: 18px;
  }}
  .hero h1 {{ margin: 0 0 7px; font-size: 25px; }}
  .hero p {{ margin: 0; color: #bdc9dd; }}
  .card {{
    background: white; border-radius: 16px; padding: 20px;
    margin-bottom: 16px; border: 1px solid #e5eaf1;
  }}
  .card h2 {{ margin: 0 0 14px; font-size: 18px; }}
  .kpis {{
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }}
  .kpi {{
    border: 1px solid #e7ebf1; border-radius: 12px;
    padding: 14px; background: #fafbfd;
  }}
  .kpi span {{ display: block; color: #657189; font-size: 12px; }}
  .kpi strong {{ display: block; margin-top: 7px; font-size: 23px; }}
  table {{ border-collapse: collapse; width: 100%; font-size: 13px; }}
  th, td {{ text-align: left; padding: 10px; border-bottom: 1px solid #e7ebf1; }}
  th {{ background: #f7f9fc; color: #4c5870; }}
  .table-wrap {{ overflow-x: auto; }}
  .muted {{ color: #6e788a; }}
  .footer {{ text-align: center; color: #818b9c; font-size: 11px; padding: 10px; }}
  @media (max-width: 680px) {{
    .kpis {{ grid-template-columns: 1fr 1fr; }}
    .wrap {{ padding: 12px; }}
  }}
</style>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <h1>{esc(title)}</h1>
      <p>{esc(subtitle)}</p>
    </div>
    {content}
    <div class="footer">
      Generated automatically by the ECE LeetCode Leaderboard platform.
    </div>
  </div>
</body>
</html>"""



def build_daily_report(live: pd.DataFrame,report_date:str,report_window:str,scope_label:str="ECE") -> tuple[str,str]:
    total=len(live); active,inactive,unknown=report_window_masks(live); top=report_window_students(live,10,False); zeros=inactive_students(live); sections=section_report_summary(live)
    solved=int(live["Report Window Solved"].sum()); subs=int(live["Report Window Submissions"].sum())
    top_rows=[[n,x["name"],x["register"],x["section"],x["value"],_display_submission(x["window_submissions"],x["submission_coverage"]),x["week"],x["fortnight"],x["month"],x["total"]] for n,x in enumerate(top,1)]
    zero_rows=[[n,x["name"],x["register"],x["section"],0,0,x["week"],x["fortnight"],x["month"],x["total"]] for n,x in enumerate(zeros,1)]
    content=f'''<div class="card"><h2>LeetCode Daily Summary</h2><p class="muted"><strong>Report Window:</strong> {esc(report_window)}</p><div class="kpis"><div class="kpi"><span>Total Students</span><strong>{total}</strong></div><div class="kpi"><span>Active Today</span><strong>{int(active.sum())}</strong></div><div class="kpi"><span>0 Solved / 0 Submission</span><strong>{int(inactive.sum())}</strong></div><div class="kpi"><span>Problems Solved Today</span><strong>{solved}</strong></div><div class="kpi"><span>Today Submissions</span><strong>{subs}</strong></div><div class="kpi"><span>Unverified Profiles</span><strong>{int(unknown.sum())}</strong></div></div></div>
    <div class="card"><h2>Top 10 Students - Today</h2>{table_html(["#","Student","Register No.","Section","Today Solved","Today Submissions","7 Days","14 Days","30 Days","Total Solved"],top_rows)}</div>
    <div class="card"><h2>0 Solved Today Students</h2><p class="muted">Only students with 0 solved AND 0 submissions in the complete 07:00 AM to 07:00 AM window are listed. Students who submitted code today are excluded.</p>{table_html(["#","Student","Register No.","Section","Today Solved","Today Submissions","7 Days","14 Days","30 Days","Total Solved"],zero_rows)}</div>
    <div class="card"><h2>Section Summary</h2>{table_html(["Section","Students","Active","0 Solved / 0 Submission","Today Solved","Today Submissions","7 Days","14 Days","30 Days"],[[x["section"],x["students"],x["active"],x["inactive"],x["window_solved"],x["window_submissions"],x["week"],x["fortnight"],x["month"]] for x in sections])}</div>'''
    subject=f"{scope_label} LeetCode Daily Report - {report_date}"; return subject,report_shell(f"{scope_label} LeetCode Daily Report",f"Reporting Date: {report_date} | {report_window}",content)



def build_weekly_report(live: pd.DataFrame,start_date:str,end_date:str,report_window:str,scope_label:str="ECE") -> tuple[str,str]:
    total=len(live); active,inactive,unknown=report_window_masks(live); top=report_window_students(live,10,False); zeros=inactive_students(live); bottom=report_window_students(live,10,True,True); sections=section_report_summary(live)
    solved=int(live["Report Window Solved"].sum()); subs=int(live["Report Window Submissions"].sum())
    def rows(items): return [[n,x["name"],x["register"],x["section"],x.get("value",x.get("solved",0)),_display_submission(x["window_submissions"],x["submission_coverage"]),x["fortnight"],x["month"],x["total"]] for n,x in enumerate(items,1)]
    headers=["#","Student","Register No.","Section","Week Solved","Week Submissions","14 Days","30 Days","Total Solved"]
    content=f'''<div class="card"><h2>LeetCode Weekly Summary</h2><p class="muted"><strong>Report Window:</strong> {esc(report_window)}</p><div class="kpis"><div class="kpi"><span>Total Students</span><strong>{total}</strong></div><div class="kpi"><span>Active This Week</span><strong>{int(active.sum())}</strong></div><div class="kpi"><span>0 Solved / 0 Submission</span><strong>{int(inactive.sum())}</strong></div><div class="kpi"><span>Problems Solved This Week</span><strong>{solved}</strong></div><div class="kpi"><span>Weekly Submissions</span><strong>{subs}</strong></div><div class="kpi"><span>Unverified Profiles</span><strong>{int(unknown.sum())}</strong></div></div></div>
    <div class="card"><h2>Top 10 Students - This Week</h2>{table_html(headers,rows(top))}</div>
    <div class="card"><h2>0 Solved This Week Students</h2><p class="muted">Only students with 0 solved AND 0 submissions in the complete weekly report window are listed.</p>{table_html(headers,rows(zeros))}</div>
    <div class="card"><h2>Bottom 10 Students - This Week</h2><p class="muted">Completely inactive 0/0 students are shown separately above and are excluded here.</p>{table_html(headers,rows(bottom))}</div>
    <div class="card"><h2>Section Performance</h2>{table_html(["Section","Students","Active","0 Solved / 0 Submission","Week Solved","Week Submissions","14 Days","30 Days"],[[x["section"],x["students"],x["active"],x["inactive"],x["window_solved"],x["window_submissions"],x["fortnight"],x["month"]] for x in sections])}</div>'''
    subject=f"{scope_label} LeetCode Weekly Report - {start_date} to {end_date}"; return subject,report_shell(f"{scope_label} LeetCode Weekly Report",report_window,content)



def _xlsx_title_format(workbook):
    return workbook.add_format({
        "bold": True,
        "font_size": 16,
        "font_color": "#FFFFFF",
        "bg_color": "#101B31",
        "align": "center",
        "valign": "vcenter",
    })


def _xlsx_header_format(workbook):
    return workbook.add_format({
        "bold": True,
        "font_color": "#FFFFFF",
        "bg_color": "#1F4E78",
        "border": 1,
        "align": "center",
        "valign": "vcenter",
    })


def _xlsx_kpi_label(workbook):
    return workbook.add_format({
        "bold": True,
        "font_color": "#5B6578",
        "bg_color": "#F4F7FB",
        "border": 1,
    })


def _xlsx_kpi_value(workbook):
    return workbook.add_format({
        "bold": True,
        "font_size": 13,
        "border": 1,
        "align": "center",
    })


def _write_dataframe_sheet(
    writer: pd.ExcelWriter,
    sheet_name: str,
    frame: pd.DataFrame,
    title: str,
) -> None:
    frame.to_excel(
        writer,
        sheet_name=sheet_name,
        index=False,
        startrow=2,
    )

    workbook = writer.book
    worksheet = writer.sheets[sheet_name]

    title_format = _xlsx_title_format(workbook)
    header_format = _xlsx_header_format(workbook)

    max_col = max(len(frame.columns) - 1, 0)
    worksheet.merge_range(0, 0, 0, max_col, title, title_format)

    for col_index, column in enumerate(frame.columns):
        worksheet.write(2, col_index, column, header_format)
        max_len = max(
            len(str(column)),
            *(len(str(value)) for value in frame[column].head(200).tolist()),
        )
        worksheet.set_column(
            col_index,
            col_index,
            min(max(max_len + 2, 11), 34),
        )

    worksheet.freeze_panes(3, 0)
    worksheet.autofilter(2, 0, 2 + len(frame), max_col)



def generate_daily_excel(live:pd.DataFrame,report_date:str,report_window:str,scope_label:str="ECE") -> Path:
    REPORT_DIR.mkdir(parents=True,exist_ok=True); path=REPORT_DIR/f"{scope_slug(scope_label)}_Daily_Report_{report_date}.xlsx"; active,inactive,unknown=report_window_masks(live); top=report_window_students(live,10,False); zeros=inactive_students(live); sections=section_report_summary(live)
    summary_rows=[["Reporting Date",report_date],["Report Window",report_window],["Total Students",len(live)],["Active Today",int(active.sum())],["0 Solved / 0 Submission",int(inactive.sum())],["Problems Solved Today",int(live["Report Window Solved"].sum())],["Today Submissions",int(live["Report Window Submissions"].sum())],["Unverified Profiles",int(unknown.sum())]]
    def frame(items): return pd.DataFrame([{"Rank":n,"Student":x["name"],"Register Number":x["register"],"Section":x["section"],"Today Solved":x.get("value",x.get("solved",0)),"Today Submissions":_display_submission(x["window_submissions"],x["submission_coverage"]),"7 Days":x["week"],"14 Days":x["fortnight"],"30 Days":x["month"],"Total Solved":x["total"],"E / M / H":f'{x["easy"]} / {x["medium"]} / {x["hard"]}'} for n,x in enumerate(items,1)])
    sec=pd.DataFrame([{"Section":x["section"],"Students":x["students"],"Active":x["active"],"0 Solved / 0 Submission":x["inactive"],"Today Solved":x["window_solved"],"Today Submissions":x["window_submissions"],"7 Days":x["week"],"14 Days":x["fortnight"],"30 Days":x["month"]} for x in sections])
    cols=[c for c in ["Register Number","Student Name","Section","Report Window Solved","Report Window Submissions","Last 7 Days","Last 14 Days","Last 30 Days","Problems Solved","Easy","Medium","Hard","Report Window Coverage","Report Submission Coverage","Status"] if c in live.columns]; students=live[cols].copy().rename(columns={"Report Window Solved":"Today Solved","Report Window Submissions":"Today Submissions","Problems Solved":"Total Solved"})
    with pd.ExcelWriter(path,engine="xlsxwriter") as writer:
        wb=writer.book; sh=wb.add_worksheet("Summary"); writer.sheets["Summary"]=sh; sh.merge_range("A1:B1",f"{scope_label} LeetCode Daily Report",_xlsx_title_format(wb)); sh.set_column("A:A",32); sh.set_column("B:B",52)
        for n,(label,value) in enumerate(summary_rows,start=2): sh.write(n-1,0,label,_xlsx_kpi_label(wb)); sh.write(n-1,1,value,_xlsx_kpi_value(wb))
        _write_dataframe_sheet(writer,"Top 10 Today",frame(top),"Top 10 Students - Today"); _write_dataframe_sheet(writer,"0 Solved Today",frame(zeros),"0 Solved Today - Also 0 Today Submissions"); _write_dataframe_sheet(writer,"Section Summary",sec,"Section Summary"); _write_dataframe_sheet(writer,"Student Data",students,"Student LeetCode Daily Data")
    return path



def generate_weekly_excel(live:pd.DataFrame,start_date:str,end_date:str,report_window:str,scope_label:str="ECE") -> Path:
    REPORT_DIR.mkdir(parents=True,exist_ok=True); path=REPORT_DIR/f"{scope_slug(scope_label)}_Weekly_Report_{start_date}_to_{end_date}.xlsx"; active,inactive,unknown=report_window_masks(live); top=report_window_students(live,10,False); zeros=inactive_students(live); bottom=report_window_students(live,10,True,True); sections=section_report_summary(live)
    summary_rows=[["Period",f"{start_date} to {end_date}"],["Report Window",report_window],["Total Students",len(live)],["Active This Week",int(active.sum())],["0 Solved / 0 Submission",int(inactive.sum())],["Problems Solved This Week",int(live["Report Window Solved"].sum())],["Weekly Submissions",int(live["Report Window Submissions"].sum())],["Unverified Profiles",int(unknown.sum())]]
    def frame(items): return pd.DataFrame([{"Rank":n,"Student":x["name"],"Register Number":x["register"],"Section":x["section"],"Week Solved":x.get("value",x.get("solved",0)),"Week Submissions":_display_submission(x["window_submissions"],x["submission_coverage"]),"14 Days":x["fortnight"],"30 Days":x["month"],"Total Solved":x["total"],"E / M / H":f'{x["easy"]} / {x["medium"]} / {x["hard"]}'} for n,x in enumerate(items,1)])
    sec=pd.DataFrame([{"Section":x["section"],"Students":x["students"],"Active":x["active"],"0 Solved / 0 Submission":x["inactive"],"Week Solved":x["window_solved"],"Week Submissions":x["window_submissions"],"14 Days":x["fortnight"],"30 Days":x["month"]} for x in sections])
    cols=[c for c in ["Register Number","Student Name","Section","Report Window Solved","Report Window Submissions","Last 14 Days","Last 30 Days","Problems Solved","Easy","Medium","Hard","Report Window Coverage","Report Submission Coverage","Status"] if c in live.columns]; students=live[cols].copy().rename(columns={"Report Window Solved":"Week Solved","Report Window Submissions":"Week Submissions","Problems Solved":"Total Solved"})
    with pd.ExcelWriter(path,engine="xlsxwriter") as writer:
        wb=writer.book; sh=wb.add_worksheet("Summary"); writer.sheets["Summary"]=sh; sh.merge_range("A1:B1",f"{scope_label} LeetCode Weekly Report",_xlsx_title_format(wb)); sh.set_column("A:A",32); sh.set_column("B:B",52)
        for n,(label,value) in enumerate(summary_rows,start=2): sh.write(n-1,0,label,_xlsx_kpi_label(wb)); sh.write(n-1,1,value,_xlsx_kpi_value(wb))
        _write_dataframe_sheet(writer,"Top 10",frame(top),"Top 10 Students - This Week"); _write_dataframe_sheet(writer,"0 Solved Week",frame(zeros),"0 Solved This Week - Also 0 Weekly Submissions"); _write_dataframe_sheet(writer,"Bottom 10",frame(bottom),"Bottom 10 Students - This Week"); _write_dataframe_sheet(writer,"Section Summary",sec,"Section Weekly Summary"); _write_dataframe_sheet(writer,"Student Data",students,"Student LeetCode Weekly Data")
    return path


def _pdf_styles():
    styles = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "ReportTitle",
            parent=styles["Title"],
            alignment=TA_CENTER,
            fontSize=19,
            leading=23,
            textColor=colors.HexColor("#101B31"),
            spaceAfter=8,
        ),
        "subtitle": ParagraphStyle(
            "ReportSubtitle",
            parent=styles["Normal"],
            alignment=TA_CENTER,
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#667085"),
            spaceAfter=14,
        ),
        "heading": ParagraphStyle(
            "ReportHeading",
            parent=styles["Heading2"],
            fontSize=12,
            leading=15,
            textColor=colors.HexColor("#1F4E78"),
            spaceBefore=8,
            spaceAfter=7,
        ),
        "normal": ParagraphStyle(
            "ReportNormal",
            parent=styles["Normal"],
            fontSize=8.5,
            leading=11,
        ),
    }


def _pdf_table(data: list[list[Any]], widths=None) -> Table:
    safe = [
        [
            Paragraph(esc(value), getSampleStyleSheet()["BodyText"])
            for value in row
        ]
        for row in data
    ]
    table = Table(
        safe,
        colWidths=widths,
        repeatRows=1,
        hAlign="LEFT",
    )
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1F4E78")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#D0D5DD")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [
            colors.white,
            colors.HexColor("#F8FAFC"),
        ]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return table



def generate_daily_pdf(live:pd.DataFrame,report_date:str,report_window:str,scope_label:str="ECE") -> Path:
    REPORT_DIR.mkdir(parents=True,exist_ok=True); path=REPORT_DIR/f"{scope_slug(scope_label)}_Daily_Report_{report_date}.pdf"; styles=_pdf_styles(); doc=SimpleDocTemplate(str(path),pagesize=landscape(A4),rightMargin=12*mm,leftMargin=12*mm,topMargin=12*mm,bottomMargin=12*mm,title=f"{scope_label} LeetCode Daily Report - {report_date}"); active,inactive,unknown=report_window_masks(live); top=report_window_students(live,10,False); zeros=inactive_students(live); sections=section_report_summary(live)
    headers=["#","Student","Register No.","Section","Today Solved","Today Subs","7D","14D","30D","Total Solved"]
    def rows(items): return [[n,x["name"],x["register"],x["section"],x.get("value",x.get("solved",0)),_display_submission(x["window_submissions"],x["submission_coverage"]),x["week"],x["fortnight"],x["month"],x["total"]] for n,x in enumerate(items,1)]
    story=[Paragraph(f"{scope_label} LeetCode Daily Report",styles["title"]),Paragraph(f"Reporting Date: {report_date} | {report_window}",styles["subtitle"]),Paragraph("LeetCode Daily Summary",styles["heading"]),_pdf_table([["Metric","Value"],["Total Students",len(live)],["Active Today",int(active.sum())],["0 Solved / 0 Submission",int(inactive.sum())],["Problems Solved Today",int(live["Report Window Solved"].sum())],["Today Submissions",int(live["Report Window Submissions"].sum())],["Unverified Profiles",int(unknown.sum())]],[72*mm,45*mm]),Spacer(1,8),Paragraph("Top 10 Students - Today",styles["heading"]),_pdf_table([headers]+rows(top)),PageBreak(),Paragraph("0 Solved Today Students",styles["heading"]),Paragraph("Only 0 solved + 0 submission students are listed.",styles["subtitle"]),_pdf_table([headers]+rows(zeros)),Spacer(1,10),Paragraph("Section Summary",styles["heading"]),_pdf_table([["Section","Students","Active","0/0","Today Solved","Today Subs","7D","14D","30D"]]+[[x["section"],x["students"],x["active"],x["inactive"],x["window_solved"],x["window_submissions"],x["week"],x["fortnight"],x["month"]] for x in sections])]
    doc.build(story); return path



def generate_weekly_pdf(live:pd.DataFrame,start_date:str,end_date:str,report_window:str,scope_label:str="ECE") -> Path:
    REPORT_DIR.mkdir(parents=True,exist_ok=True); path=REPORT_DIR/f"{scope_slug(scope_label)}_Weekly_Report_{start_date}_to_{end_date}.pdf"; styles=_pdf_styles(); doc=SimpleDocTemplate(str(path),pagesize=landscape(A4),rightMargin=12*mm,leftMargin=12*mm,topMargin=12*mm,bottomMargin=12*mm,title=f"{scope_label} LeetCode Weekly Report - {start_date} to {end_date}"); active,inactive,unknown=report_window_masks(live); top=report_window_students(live,10,False); zeros=inactive_students(live); bottom=report_window_students(live,10,True,True); sections=section_report_summary(live)
    headers=["#","Student","Register No.","Section","Week Solved","Week Subs","14D","30D","Total Solved"]
    def rows(items): return [[n,x["name"],x["register"],x["section"],x.get("value",x.get("solved",0)),_display_submission(x["window_submissions"],x["submission_coverage"]),x["fortnight"],x["month"],x["total"]] for n,x in enumerate(items,1)]
    story=[Paragraph(f"{scope_label} LeetCode Weekly Report",styles["title"]),Paragraph(report_window,styles["subtitle"]),Paragraph("LeetCode Weekly Summary",styles["heading"]),_pdf_table([["Metric","Value"],["Total Students",len(live)],["Active This Week",int(active.sum())],["0 Solved / 0 Submission",int(inactive.sum())],["Problems Solved This Week",int(live["Report Window Solved"].sum())],["Weekly Submissions",int(live["Report Window Submissions"].sum())],["Unverified Profiles",int(unknown.sum())]],[72*mm,45*mm]),Spacer(1,8),Paragraph("Top 10 Students - This Week",styles["heading"]),_pdf_table([headers]+rows(top)),PageBreak(),Paragraph("0 Solved This Week Students",styles["heading"]),Paragraph("Only 0 solved + 0 weekly submission students are listed.",styles["subtitle"]),_pdf_table([headers]+rows(zeros)),Spacer(1,10),Paragraph("Bottom 10 Students - This Week",styles["heading"]),Paragraph("Completely inactive 0/0 students are excluded here.",styles["subtitle"]),_pdf_table([headers]+rows(bottom)),Spacer(1,10),Paragraph("Section Performance",styles["heading"]),_pdf_table([["Section","Students","Active","0/0","Week Solved","Week Subs","14D","30D"]]+[[x["section"],x["students"],x["active"],x["inactive"],x["window_solved"],x["window_submissions"],x["fortnight"],x["month"]] for x in sections])]
    doc.build(story); return path


def encode_attachment(path: Path) -> dict[str, str]:
    content = base64.b64encode(path.read_bytes()).decode("ascii")
    return {
        "filename": path.name,
        "content": content,
    }



def send_gmail_email(
    config: Config,
    recipients: list[str],
    subject: str,
    html_body: str,
    attachment_paths: list[Path],
) -> list[str]:
    if not recipients:
        raise RuntimeError("No report recipients configured for this report.")

    message_ids: list[str] = []

    for group in chunks(recipients, MAX_RECIPIENTS_PER_EMAIL):
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = config.gmail_address
        msg["To"] = ", ".join(group)

        if config.reply_to:
            msg["Reply-To"] = config.reply_to

        msg.set_content(
            "Please view this email in an HTML-compatible email client."
        )
        msg.add_alternative(html_body, subtype="html")

        for path in attachment_paths:
            mime_type, _ = mimetypes.guess_type(path.name)

            if mime_type:
                maintype, subtype = mime_type.split("/", 1)
            else:
                maintype = "application"
                subtype = "octet-stream"

            with open(path, "rb") as file_handle:
                msg.add_attachment(
                    file_handle.read(),
                    maintype=maintype,
                    subtype=subtype,
                    filename=path.name,
                )

        try:
            with smtplib.SMTP("smtp.gmail.com", 587, timeout=60) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(
                    config.gmail_address,
                    config.gmail_app_password,
                )
                server.send_message(msg)

            message_ids.append("gmail-sent")

        except Exception as exc:
            raise RuntimeError(
                f"Gmail send failed for {', '.join(group)}: {exc}"
            ) from exc

    return message_ids


def collect_supabase_data(
    config: Config,
) -> dict[str, list[dict[str, Any]]]:
    return {
        "students": supabase_get(
            config,
            "students",
            {"select": "register_number,student_name,section"},
        ),
        "challenges": supabase_get(
            config,
            "daily_challenges",
            {"select": "*", "order": "challenge_date.asc"},
        ),
        "challenge_results": supabase_get(
            config,
            "daily_challenge_results",
            {"select": "*"},
        ),
        "coding_tests": supabase_get(
            config,
            "coding_tests",
            {"select": "*", "order": "starts_at.asc"},
        ),
        "coding_attempts": supabase_get(
            config,
            "coding_attempts",
            {"select": "*"},
        ),
    }


def filtered_scope_data(
    live: pd.DataFrame,
    data: dict[str, list[dict[str, Any]]],
    section: str | None,
) -> tuple[pd.DataFrame, dict[str, list[dict[str, Any]]]]:
    """Filter student, challenge-result and coding-attempt data for one section."""
    if section is None:
        return live.copy(), {
            key: list(value)
            for key, value in data.items()
        }

    key = section.strip().upper()

    scoped_live = live[
        live["Section"]
        .astype(str)
        .str.strip()
        .str.upper()
        .eq(key)
    ].copy()

    registers = {
        str(value).strip()
        for value in scoped_live["Register Number"].tolist()
        if str(value).strip()
    }

    scoped = {
        "students": [
            row
            for row in data["students"]
            if str(row.get("register_number", "")).strip() in registers
        ],
        "challenges": list(data["challenges"]),
        "challenge_results": [
            row
            for row in data["challenge_results"]
            if str(row.get("register_number", "")).strip() in registers
        ],
        "coding_tests": list(data["coding_tests"]),
        "coding_attempts": [
            row
            for row in data["coding_attempts"]
            if str(row.get("register_number", "")).strip() in registers
        ],
    }

    return scoped_live, scoped



def build_report(mode:str,config:Config,offline:bool=False,section:str|None=None) -> tuple[str,str,list[Path]]:
    all_live=load_live_data()
    if section is None: live=all_live.copy()
    else:
        key=section.strip().upper(); live=all_live[all_live["Section"].astype(str).str.strip().str.upper().eq(key)].copy()
    scope_label=section or "ECE Overall"; report_end=latest_7am_boundary()
    if mode=="daily":
        report_start=report_end-timedelta(days=1); live=refresh_report_window_activity(live,report_start,report_end,config,offline)
        if not offline: supabase_report_snapshot_upsert(config,live,report_end)
        display=report_start.strftime("%d %b %Y"); file_date=report_start.date().isoformat(); window=format_window(report_start,report_end); print(f"Daily report window: {report_start.isoformat()} -> {report_end.isoformat()}")
        subject,body=build_daily_report(live,display,window,scope_label); return subject,body,[generate_daily_excel(live,file_date,window,scope_label),generate_daily_pdf(live,file_date,window,scope_label)]
    if mode=="weekly":
        report_start=report_end-timedelta(days=7); live=refresh_report_window_activity(live,report_start,report_end,config,offline); start_iso=report_start.date().isoformat(); end_iso=report_end.date().isoformat(); window=format_window(report_start,report_end); print(f"Weekly report window: {report_start.isoformat()} -> {report_end.isoformat()}")
        subject,body=build_weekly_report(live,report_start.strftime("%d %b %Y"),report_end.strftime("%d %b %Y"),window,scope_label); return subject,body,[generate_weekly_excel(live,start_iso,end_iso,window,scope_label),generate_weekly_pdf(live,start_iso,end_iso,window,scope_label)]
    raise ValueError(f"Unknown report mode: {mode}")


def configured_report_routes(
    config: Config,
) -> list[tuple[str, str | None, list[str]]]:
    routes: list[tuple[str, str | None, list[str]]] = []

    for section in SECTIONS:
        recipients = config.section_recipients.get(section, [])

        if recipients:
            routes.append((section, section, recipients))

    if config.hod_recipients:
        routes.append(("OVERALL", None, config.hod_recipients))

    return routes


def write_html_copy(
    mode: str,
    route_label: str,
    html_body: str,
) -> Path:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)

    output = REPORT_DIR / (
        f"latest_{mode}_{scope_slug(route_label).lower()}_report.html"
    )

    output.write_text(html_body, encoding="utf-8")
    return output


def main() -> int:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--mode",
        choices=["daily", "weekly"],
        required=True,
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Generate reports but do not send email.",
    )

    parser.add_argument(
        "--offline",
        action="store_true",
        help="Skip LeetCode refresh and use LiveData only for local preview.",
    )

    parser.add_argument(
        "--scope",
        choices=["OVERALL", *SECTIONS],
        help="Generate only one report, e.g. --scope 'ECE E'.",
    )

    args = parser.parse_args()

    config = load_config(
        require_email=not args.dry_run
    )

    if args.scope:
        selected_routes = [
            (
                args.scope,
                None if args.scope == "OVERALL" else args.scope,
                (
                    config.hod_recipients
                    if args.scope == "OVERALL"
                    else config.section_recipients.get(args.scope, [])
                ),
            )
        ]
    else:
        selected_routes = configured_report_routes(config)

    if not selected_routes:
        if args.dry_run:
            selected_routes = [("OVERALL", None, [])]
        else:
            raise RuntimeError(
                "No report routes configured. Add REPORT_HOD_EMAILS "
                "and/or REPORT_ECE_A_EMAILS ... REPORT_ECE_F_EMAILS."
            )

    sent_reports = 0
    sent_recipients = 0

    for route_label, section, recipients in selected_routes:
        print("=" * 72)
        print(f"Building {args.mode} report for {route_label}")

        subject, html_body, attachment_paths = build_report(
            args.mode,
            config,
            offline=args.offline,
            section=section,
        )

        html_output = write_html_copy(
            args.mode,
            route_label,
            html_body,
        )

        print(f"HTML report generated: {html_output}")

        for attachment in attachment_paths:
            print(f"Attachment generated: {attachment}")

        print(f"Subject: {subject}")

        if args.dry_run:
            print(f"DRY RUN: {route_label} email not sent.")
            continue

        if not recipients:
            print(f"SKIPPED: no recipient configured for {route_label}.")
            continue

        ids = send_gmail_email(
            config,
            recipients,
            subject,
            html_body,
            attachment_paths,
        )

        sent_reports += 1
        sent_recipients += len(recipients)

        print(
            f"{route_label}: sent to {len(recipients)} recipient(s) "
            f"in {len(ids)} Gmail send(s)."
        )

    if args.dry_run:
        print("DRY RUN COMPLETE.")
    else:
        print("=" * 72)
        print(
            f"SECTION-WISE EMAIL COMPLETE: {sent_reports} report(s), "
            f"{sent_recipients} recipient(s)."
        )

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"REPORT ERROR: {exc}", file=sys.stderr)
        raise
