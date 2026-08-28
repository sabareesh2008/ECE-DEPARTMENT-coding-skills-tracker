from __future__ import annotations

import json
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

import pandas as pd
import requests


BASE_DIR = Path(__file__).resolve().parent

STUDENTS_CSV = BASE_DIR / "github_students.csv"
LIVE_CSV = BASE_DIR / "GitHubLiveData.csv"
HISTORY_CSV = BASE_DIR / "GitHubHistory.csv"
DAILY_ACTIVITY_CSV = BASE_DIR / "GitHubDailyActivity.csv"

SUPABASE_URL = (
    os.getenv("SUPABASE_URL", "")
    .strip()
    .replace("%0A", "")
    .replace("%0a", "")
    .rstrip("/")
)

SUPABASE_SERVICE_ROLE_KEY = os.getenv(
    "SUPABASE_SERVICE_ROLE_KEY",
    "",
).strip()

GITHUB_TOKEN = (
    os.getenv("GITHUB_TRACKER_TOKEN", "")
    or os.getenv("GITHUB_TOKEN", "")
).strip()

GRAPHQL_URL = "https://api.github.com/graphql"
REST_URL = "https://api.github.com"

IST = ZoneInfo("Asia/Kolkata")
MAX_WORKERS = max(1, min(10, int(os.getenv("GITHUB_TRACKER_WORKERS", "6"))))

ALLOWED_SECTIONS = (
    "ECE A",
    "ECE B",
    "ECE C",
    "ECE D",
    "ECE E",
    "ECE F",
)

LIVE_COLUMNS = [
    "Overall Rank",
    "Section Rank",
    "Section",
    "Register Number",
    "Student Name",
    "GitHub Username",
    "GitHub Link",
    "Contributions Today",
    "Contributions 7 Days",
    "Contributions 14 Days",
    "Contributions 30 Days",
    "Commits Today",
    "Commits 7 Days",
    "Commits 14 Days",
    "Commits 30 Days",
    "Repositories Total",
    "Repositories Today",
    "Repositories 7 Days",
    "Repositories 14 Days",
    "Repositories 30 Days",
    "Detected Deployments",
    "Latest Repository",
    "Last Activity",
    "Status",
    "Updated At",

    # Compatibility aliases let the existing CodeMetrix UI/championship logic
    # run unchanged while the displayed GitHub table uses native headings.
    "LeetCode Username",
    "LeetCode Link",
    "Problems Solved",
    "Solved Today",
    "Last 7 Days",
    "Last 14 Days",
    "Last 30 Days",
    "Last 7 Days Submissions",
    "Total Submissions",
    "Easy",
    "Medium",
    "Hard",
    "Last Problem",
    "Last Solved",
    "7D Source",
    "14D Source",
    "30D Source",
]

HISTORY_COLUMNS = [
    "Date",
    "Section",
    "Register Number",
    "Student Name",
    "GitHub Username",
    "Contributions Today",
    "Contributions 7 Days",
    "Contributions 14 Days",
    "Contributions 30 Days",
    "Commits Today",
    "Commits 7 Days",
    "Commits 14 Days",
    "Commits 30 Days",
    "Repositories Total",
    "Repositories Today",
    "Repositories 7 Days",
    "Repositories 14 Days",
    "Repositories 30 Days",
    "Detected Deployments",
    "Latest Repository",
    "Last Activity",
    "Status",
    "Updated At",
]

ACTIVITY_COLUMNS = [
    "Date",
    "Section",
    "Register Number",
    "Student Name",
    "GitHub Username",
    "Contributions That Day",
    "Commits That Day",
    "Repositories Created That Day",
    "Status",
]


# GitHub GraphQL schema note:
# ContributionsCollection does NOT expose totalContributions directly.
# Use contributionCalendar.totalContributions.
# totalCommitContributions remains directly on ContributionsCollection.

GRAPHQL_QUERY = """
query GitHubCodeMetrix(
  $login: String!,
  $today: DateTime!,
  $d7: DateTime!,
  $d14: DateTime!,
  $d30: DateTime!,
  $to: DateTime!
) {
  user(login: $login) {
    login
    url

    today: contributionsCollection(from: $today, to: $to) {
      contributionCalendar {
        totalContributions
      }
      totalCommitContributions
    }

    d7: contributionsCollection(from: $d7, to: $to) {
      contributionCalendar {
        totalContributions
      }
      totalCommitContributions
    }

    d14: contributionsCollection(from: $d14, to: $to) {
      contributionCalendar {
        totalContributions
      }
      totalCommitContributions
    }

    d30: contributionsCollection(from: $d30, to: $to) {
      contributionCalendar {
        totalContributions
      }
      totalCommitContributions
    }
  }
}
"""


def clean(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def safe_int(value: Any) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return 0


def now_ist() -> datetime:
    return datetime.now(IST)


def today_ist():
    return now_ist().date()


def window_starts(now: datetime) -> dict[str, datetime]:
    midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)

    return {
        "today": midnight,
        "d7": midnight - timedelta(days=6),
        "d14": midnight - timedelta(days=13),
        "d30": midnight - timedelta(days=29),
    }


def github_headers() -> dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "CodeMetrix-GitHub-Tracker",
    }

    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"

    return headers


def atomic_csv_write(frame: pd.DataFrame, path: Path) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    frame.to_csv(tmp, index=False, encoding="utf-8-sig")
    tmp.replace(path)


def sync_students_from_supabase() -> None:
    """
    Supabase students is authoritative.

    GitHub username is optional so the GitHub page can show every registered
    student and clearly mark profiles that have not yet been attached.
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("Supabase secrets not set; using local github_students.csv")
        return

    url = f"{SUPABASE_URL}/rest/v1/students"

    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Accept": "application/json",
    }

    params = {
        "select": (
            "register_number,"
            "student_name,"
            "github_username,"
            "section,"
            "created_at"
        ),
        "order": "created_at.asc",
    }

    response = requests.get(
        url,
        headers=headers,
        params=params,
        timeout=30,
    )
    response.raise_for_status()

    rows = response.json()

    frame = pd.DataFrame([
        {
            "Register Number": clean(row.get("register_number")),
            "Student Name": clean(row.get("student_name")),
            "GitHub Username": clean(row.get("github_username")),
            "Section": clean(row.get("section")) or "ECE E",
        }
        for row in rows
    ])

    if frame.empty:
        frame = pd.DataFrame(columns=[
            "Register Number",
            "Student Name",
            "GitHub Username",
            "Section",
        ])

    atomic_csv_write(frame, STUDENTS_CSV)

    print(f"Synced {len(frame)} student(s) from Supabase")


def read_students() -> pd.DataFrame:
    if not STUDENTS_CSV.exists():
        return pd.DataFrame(columns=[
            "Register Number",
            "Student Name",
            "GitHub Username",
            "Section",
        ])

    frame = pd.read_csv(
        STUDENTS_CSV,
        dtype=str,
        keep_default_na=False,
    )

    for column in [
        "Register Number",
        "Student Name",
        "GitHub Username",
        "Section",
    ]:
        if column not in frame.columns:
            frame[column] = ""

    frame["Section"] = (
        frame["Section"]
        .astype(str)
        .str.strip()
        .str.upper()
    )

    frame.loc[
        ~frame["Section"].isin(ALLOWED_SECTIONS),
        "Section",
    ] = "ECE E"

    frame = frame.drop_duplicates(
        subset=["Register Number"],
        keep="last",
    ).reset_index(drop=True)

    return frame


def graphql_metrics(username: str, now: datetime) -> dict[str, Any]:
    starts = window_starts(now)

    variables = {
        "login": username,
        "today": starts["today"].isoformat(),
        "d7": starts["d7"].isoformat(),
        "d14": starts["d14"].isoformat(),
        "d30": starts["d30"].isoformat(),
        "to": now.isoformat(),
    }

    response = requests.post(
        GRAPHQL_URL,
        headers=github_headers(),
        json={
            "query": GRAPHQL_QUERY,
            "variables": variables,
        },
        timeout=30,
    )

    if response.status_code == 401:
        raise RuntimeError(
            "GitHub authentication failed. Check GITHUB_TRACKER_TOKEN."
        )

    if response.status_code == 403:
        remaining = response.headers.get("x-ratelimit-remaining", "?")
        raise RuntimeError(
            f"GitHub API forbidden/rate limited. Remaining={remaining}"
        )

    response.raise_for_status()

    payload = response.json()

    errors = payload.get("errors") or []

    user = (payload.get("data") or {}).get("user")

    if user is None:
        if errors:
            message = " | ".join(
                clean(item.get("message")) for item in errors
            )
            raise RuntimeError(message or "GitHub user not found")
        raise RuntimeError("GitHub user not found")

    result = {
        "profile_url": clean(user.get("url"))
            or f"https://github.com/{username}",
    }

    for alias, label in [
        ("today", "today"),
        ("d7", "7"),
        ("d14", "14"),
        ("d30", "30"),
    ]:
        collection = user.get(alias) or {}

        calendar = collection.get("contributionCalendar") or {}

        result[f"contrib_{label}"] = safe_int(
            calendar.get("totalContributions")
        )
        result[f"commits_{label}"] = safe_int(
            collection.get("totalCommitContributions")
        )

    return result


def list_public_repositories(username: str) -> list[dict[str, Any]]:
    repos: list[dict[str, Any]] = []
    page = 1

    while page <= 10:
        response = requests.get(
            f"{REST_URL}/users/{username}/repos",
            headers=github_headers(),
            params={
                "type": "owner",
                "sort": "created",
                "direction": "desc",
                "per_page": 100,
                "page": page,
            },
            timeout=30,
        )

        if response.status_code == 404:
            raise RuntimeError("GitHub user not found")

        if response.status_code == 403:
            remaining = response.headers.get("x-ratelimit-remaining", "?")
            raise RuntimeError(
                f"GitHub API forbidden/rate limited. Remaining={remaining}"
            )

        response.raise_for_status()

        batch = response.json()

        if not isinstance(batch, list):
            raise RuntimeError("Unexpected GitHub repository response")

        repos.extend(batch)

        if len(batch) < 100:
            break

        page += 1

    return repos


DEPLOYMENT_HOST_SUFFIXES = (
    "github.io",
    "vercel.app",
    "netlify.app",
    "onrender.com",
    "web.app",
    "firebaseapp.com",
    "pages.dev",
    "railway.app",
    "up.railway.app",
    "herokuapp.com",
    "azurewebsites.net",
    "fly.dev",
    "surge.sh",
)


def deployed_repo(repo: dict[str, Any]) -> bool:
    """
    Conservative deployment detection.

    Count a public repository when:
    - GitHub reports Pages enabled, OR
    - repository homepage points to a common deployment host.

    The UI deliberately calls this "Detected Deployments" rather than claiming
    every possible deployment can be discovered from a public GitHub profile.
    """
    if bool(repo.get("has_pages")):
        return True

    homepage = clean(repo.get("homepage"))

    if not homepage:
        return False

    try:
        host = (urlparse(homepage).hostname or "").lower()
    except Exception:
        return False

    return any(
        host == suffix or host.endswith("." + suffix)
        for suffix in DEPLOYMENT_HOST_SUFFIXES
    )


def parse_github_datetime(value: Any) -> datetime | None:
    text = clean(value)

    if not text:
        return None

    try:
        return datetime.fromisoformat(
            text.replace("Z", "+00:00")
        )
    except ValueError:
        return None


def repository_metrics(repos: list[dict[str, Any]], now: datetime) -> dict[str, Any]:
    starts = window_starts(now)

    created_dates = []

    latest_repo = ""
    latest_activity_dt: datetime | None = None

    deployments = 0

    for repo in repos:
        created = parse_github_datetime(repo.get("created_at"))

        if created is not None:
            created_dates.append(created.astimezone(IST))

        pushed = parse_github_datetime(repo.get("pushed_at"))
        updated = parse_github_datetime(repo.get("updated_at"))

        activity = pushed or updated

        if activity is not None:
            if latest_activity_dt is None or activity > latest_activity_dt:
                latest_activity_dt = activity
                latest_repo = clean(repo.get("name"))

        if deployed_repo(repo):
            deployments += 1

    def created_since(start: datetime) -> int:
        return sum(
            1
            for item in created_dates
            if item >= start
        )

    return {
        "repos_total": len(repos),
        "repos_today": created_since(starts["today"]),
        "repos_7": created_since(starts["d7"]),
        "repos_14": created_since(starts["d14"]),
        "repos_30": created_since(starts["d30"]),
        "deployments": deployments,
        "latest_repository": latest_repo,
        "last_activity": (
            latest_activity_dt
            .astimezone(IST)
            .strftime("%Y-%m-%d %H:%M")
            if latest_activity_dt
            else ""
        ),
    }


def empty_metrics(status: str) -> dict[str, Any]:
    return {
        "profile_url": "",
        "contrib_today": 0,
        "contrib_7": 0,
        "contrib_14": 0,
        "contrib_30": 0,
        "commits_today": 0,
        "commits_7": 0,
        "commits_14": 0,
        "commits_30": 0,
        "repos_total": 0,
        "repos_today": 0,
        "repos_7": 0,
        "repos_14": 0,
        "repos_30": 0,
        "deployments": 0,
        "latest_repository": "",
        "last_activity": "",
        "status": status,
    }


def fetch_github_profile(username: str) -> dict[str, Any]:
    username = clean(username)

    if not username:
        return empty_metrics("GitHub Not Added")

    now = now_ist()

    try:
        contribution_data = graphql_metrics(username, now)
        repos = list_public_repositories(username)
        repo_data = repository_metrics(repos, now)

        result = {
            **contribution_data,
            **repo_data,
            "status": "Success",
        }

        # Hard nested-window integrity guards.
        for prefix in ("contrib", "commits"):
            values = [
                safe_int(result[f"{prefix}_today"]),
                safe_int(result[f"{prefix}_7"]),
                safe_int(result[f"{prefix}_14"]),
                safe_int(result[f"{prefix}_30"]),
            ]

            if not (
                0 <= values[0] <= values[1] <= values[2] <= values[3]
            ):
                raise RuntimeError(
                    f"GitHub {prefix} window integrity failure: {values}"
                )

        repo_values = [
            safe_int(result["repos_today"]),
            safe_int(result["repos_7"]),
            safe_int(result["repos_14"]),
            safe_int(result["repos_30"]),
            safe_int(result["repos_total"]),
        ]

        if not (
            0
            <= repo_values[0]
            <= repo_values[1]
            <= repo_values[2]
            <= repo_values[3]
            <= repo_values[4]
        ):
            raise RuntimeError(
                f"GitHub repository window integrity failure: {repo_values}"
            )

        return result

    except Exception as error:
        return empty_metrics(
            f"Error: {clean(error)}"
        )


def process_student(
    position: int,
    total: int,
    student: pd.Series,
    updated_at: str,
) -> dict[str, Any]:
    register = clean(student.get("Register Number"))
    name = clean(student.get("Student Name"))
    username = clean(student.get("GitHub Username"))
    section = clean(student.get("Section")) or "ECE E"

    print(
        f"[START {position}/{total}] "
        f"{section} | {name} | @{username or 'not-added'}"
    )

    data = fetch_github_profile(username)

    row = {
        "Overall Rank": "",
        "Section Rank": "",
        "Section": section,
        "Register Number": register,
        "Student Name": name,
        "GitHub Username": username,
        "GitHub Link": (
            data.get("profile_url")
            or (
                f"https://github.com/{username}"
                if username
                else ""
            )
        ),
        "Contributions Today": safe_int(data.get("contrib_today")),
        "Contributions 7 Days": safe_int(data.get("contrib_7")),
        "Contributions 14 Days": safe_int(data.get("contrib_14")),
        "Contributions 30 Days": safe_int(data.get("contrib_30")),
        "Commits Today": safe_int(data.get("commits_today")),
        "Commits 7 Days": safe_int(data.get("commits_7")),
        "Commits 14 Days": safe_int(data.get("commits_14")),
        "Commits 30 Days": safe_int(data.get("commits_30")),
        "Repositories Total": safe_int(data.get("repos_total")),
        "Repositories Today": safe_int(data.get("repos_today")),
        "Repositories 7 Days": safe_int(data.get("repos_7")),
        "Repositories 14 Days": safe_int(data.get("repos_14")),
        "Repositories 30 Days": safe_int(data.get("repos_30")),
        "Detected Deployments": safe_int(data.get("deployments")),
        "Latest Repository": clean(data.get("latest_repository")),
        "Last Activity": clean(data.get("last_activity")),
        "Status": clean(data.get("status")) or "Unknown",
        "Updated At": updated_at,
    }

    # Existing CodeMetrix visual/ranking compatibility.
    row.update({
        "LeetCode Username": row["GitHub Username"],
        "LeetCode Link": row["GitHub Link"],
        "Problems Solved": row["Repositories Total"],
        "Solved Today": row["Contributions Today"],
        "Last 7 Days": row["Contributions 7 Days"],
        "Last 14 Days": row["Contributions 14 Days"],
        "Last 30 Days": row["Contributions 30 Days"],
        "Last 7 Days Submissions": row["Commits 7 Days"],
        "Total Submissions": row["Commits 30 Days"],
        "Easy": row["Commits 30 Days"],
        "Medium": row["Repositories 30 Days"],
        "Hard": row["Detected Deployments"],
        "Last Problem": row["Latest Repository"],
        "Last Solved": row["Last Activity"],
        "7D Source": "GITHUB_API",
        "14D Source": "GITHUB_API",
        "30D Source": "GITHUB_API",
    })

    print(
        f"[DONE  {position}/{total}] "
        f"{section} | {name} | "
        f"C30={row['Contributions 30 Days']} | "
        f"M30={row['Commits 30 Days']} | "
        f"Repos={row['Repositories Total']} | "
        f"Deploy={row['Detected Deployments']} | "
        f"{row['Status']}"
    )

    return row


def add_ranks(frame: pd.DataFrame) -> pd.DataFrame:
    if frame.empty:
        return frame

    frame = frame.copy()

    # Ranking rule:
    # 30D contributions -> 30D commits -> total repos -> deployments -> reg no
    sortable = frame.sort_values(
        by=[
            "Contributions 30 Days",
            "Commits 30 Days",
            "Repositories Total",
            "Detected Deployments",
            "Register Number",
        ],
        ascending=[False, False, False, False, True],
        kind="stable",
    ).copy()

    sortable["Overall Rank"] = range(1, len(sortable) + 1)

    rank_map = {
        clean(row["Register Number"]): safe_int(row["Overall Rank"])
        for _, row in sortable.iterrows()
    }

    frame["Overall Rank"] = frame["Register Number"].map(rank_map)

    section_rank_map: dict[str, int] = {}

    for section in ALLOWED_SECTIONS:
        section_rows = frame[
            frame["Section"] == section
        ].sort_values(
            by=[
                "Contributions 30 Days",
                "Commits 30 Days",
                "Repositories Total",
                "Detected Deployments",
                "Register Number",
            ],
            ascending=[False, False, False, False, True],
            kind="stable",
        )

        for rank, (_, row) in enumerate(
            section_rows.iterrows(),
            start=1,
        ):
            section_rank_map[
                clean(row["Register Number"])
            ] = rank

    frame["Section Rank"] = frame["Register Number"].map(section_rank_map)

    return frame


def update_history(live: pd.DataFrame) -> pd.DataFrame:
    if HISTORY_CSV.exists():
        try:
            history = pd.read_csv(
                HISTORY_CSV,
                dtype=str,
                keep_default_na=False,
            )
        except pd.errors.EmptyDataError:
            history = pd.DataFrame(columns=HISTORY_COLUMNS)
    else:
        history = pd.DataFrame(columns=HISTORY_COLUMNS)

    for column in HISTORY_COLUMNS:
        if column not in history.columns:
            history[column] = ""

    snapshot_date = today_ist().isoformat()

    current = live.copy()
    current.insert(0, "Date", snapshot_date)
    current = current[[
        column for column in HISTORY_COLUMNS
        if column in current.columns
    ]]

    if not history.empty:
        current_registers = set(
            current["Register Number"].astype(str)
        )

        history = history[
            ~(
                (history["Date"].astype(str) == snapshot_date)
                & history["Register Number"].astype(str).isin(current_registers)
            )
        ].copy()

    history = pd.concat(
        [history, current],
        ignore_index=True,
    )

    history = history.drop_duplicates(
        subset=["Register Number", "Date"],
        keep="last",
    )

    history = history.sort_values(
        by=["Date", "Section", "Register Number"],
        ascending=[True, True, True],
    ).reset_index(drop=True)

    return history[HISTORY_COLUMNS]


def update_daily_activity(live: pd.DataFrame) -> pd.DataFrame:
    if DAILY_ACTIVITY_CSV.exists():
        try:
            activity = pd.read_csv(
                DAILY_ACTIVITY_CSV,
                dtype=str,
                keep_default_na=False,
            )
        except pd.errors.EmptyDataError:
            activity = pd.DataFrame(columns=ACTIVITY_COLUMNS)
    else:
        activity = pd.DataFrame(columns=ACTIVITY_COLUMNS)

    for column in ACTIVITY_COLUMNS:
        if column not in activity.columns:
            activity[column] = ""

    snapshot_date = today_ist().isoformat()

    rows = []

    for _, row in live.iterrows():
        rows.append({
            "Date": snapshot_date,
            "Section": row["Section"],
            "Register Number": row["Register Number"],
            "Student Name": row["Student Name"],
            "GitHub Username": row["GitHub Username"],
            "Contributions That Day": row["Contributions Today"],
            "Commits That Day": row["Commits Today"],
            "Repositories Created That Day": row["Repositories Today"],
            "Status": row["Status"],
        })

    current = pd.DataFrame(rows, columns=ACTIVITY_COLUMNS)

    if not activity.empty:
        registers = set(current["Register Number"].astype(str))

        activity = activity[
            ~(
                (activity["Date"].astype(str) == snapshot_date)
                & activity["Register Number"].astype(str).isin(registers)
            )
        ].copy()

    activity = pd.concat(
        [activity, current],
        ignore_index=True,
    )

    activity = activity.drop_duplicates(
        subset=["Register Number", "Date"],
        keep="last",
    )

    activity = activity.sort_values(
        by=["Date", "Section", "Register Number"],
        ascending=[True, True, True],
    ).reset_index(drop=True)

    return activity[ACTIVITY_COLUMNS]


def supabase_headers() -> dict[str, str]:
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }


def postgrest_upsert(table: str, rows: list[dict[str, Any]], on_conflict: str) -> None:
    if not rows:
        return

    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return

    url = f"{SUPABASE_URL}/rest/v1/{table}"

    response = requests.post(
        url,
        headers=supabase_headers(),
        params={"on_conflict": on_conflict},
        json=rows,
        timeout=45,
    )

    response.raise_for_status()


def sync_performance_to_supabase(live: pd.DataFrame) -> None:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("Supabase secrets not set; skipped GitHub performance table sync")
        return

    current_rows = []
    history_rows = []

    snapshot_date = today_ist().isoformat()

    for _, row in live.iterrows():
        common = {
            "register_number": clean(row["Register Number"]),
            "section": clean(row["Section"]),
            "student_name": clean(row["Student Name"]),
            "github_username": clean(row["GitHub Username"]) or None,
            "contributions_today": safe_int(row["Contributions Today"]),
            "contributions_7_days": safe_int(row["Contributions 7 Days"]),
            "contributions_14_days": safe_int(row["Contributions 14 Days"]),
            "contributions_30_days": safe_int(row["Contributions 30 Days"]),
            "commits_today": safe_int(row["Commits Today"]),
            "commits_7_days": safe_int(row["Commits 7 Days"]),
            "commits_14_days": safe_int(row["Commits 14 Days"]),
            "commits_30_days": safe_int(row["Commits 30 Days"]),
            "repositories_total": safe_int(row["Repositories Total"]),
            "repositories_today": safe_int(row["Repositories Today"]),
            "repositories_7_days": safe_int(row["Repositories 7 Days"]),
            "repositories_14_days": safe_int(row["Repositories 14 Days"]),
            "repositories_30_days": safe_int(row["Repositories 30 Days"]),
            "detected_deployments": safe_int(row["Detected Deployments"]),
            "latest_repository": clean(row["Latest Repository"]) or None,
            "last_activity": clean(row["Last Activity"]) or None,
            "status": clean(row["Status"]),
            "updated_at": now_ist().isoformat(),
        }

        current_rows.append(common)

        history_rows.append({
            **common,
            "snapshot_date": snapshot_date,
        })

    postgrest_upsert(
        "github_performance_current",
        current_rows,
        "register_number",
    )

    postgrest_upsert(
        "github_performance_history",
        history_rows,
        "register_number,snapshot_date",
    )

    print(
        f"Synced GitHub current/history tables for {len(current_rows)} student(s)"
    )


def run() -> None:
    print("=" * 72)
    print("CodeMetrix GitHub Tracker")
    print("Tracks: Contributions + Commits + Repositories + Detected Deployments")
    print("=" * 72)

    if not GITHUB_TOKEN:
        print(
            "WARNING: GITHUB_TRACKER_TOKEN/GITHUB_TOKEN is not set. "
            "Unauthenticated GitHub API rate limits are much lower."
        )

    sync_students_from_supabase()

    students = read_students()

    if students.empty:
        empty = pd.DataFrame(columns=LIVE_COLUMNS)
        atomic_csv_write(empty, LIVE_CSV)
        atomic_csv_write(
            pd.DataFrame(columns=HISTORY_COLUMNS),
            HISTORY_CSV,
        )
        atomic_csv_write(
            pd.DataFrame(columns=ACTIVITY_COLUMNS),
            DAILY_ACTIVITY_CSV,
        )
        print("No students found.")
        return

    updated_at = now_ist().strftime("%Y-%m-%d %H:%M:%S %Z")

    rows: list[dict[str, Any]] = []

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {}

        for position, (_, student) in enumerate(
            students.iterrows(),
            start=1,
        ):
            future = executor.submit(
                process_student,
                position,
                len(students),
                student,
                updated_at,
            )
            futures[future] = position

        for future in as_completed(futures):
            rows.append(future.result())

    live = pd.DataFrame(rows)

    for column in LIVE_COLUMNS:
        if column not in live.columns:
            live[column] = ""

    live = add_ranks(live)

    live = live.sort_values(
        by=["Section", "Register Number"],
        ascending=[True, True],
        kind="stable",
    ).reset_index(drop=True)

    live = live[LIVE_COLUMNS]

    history = update_history(live)
    activity = update_daily_activity(live)

    atomic_csv_write(live, LIVE_CSV)
    atomic_csv_write(history, HISTORY_CSV)
    atomic_csv_write(activity, DAILY_ACTIVITY_CSV)

    sync_performance_to_supabase(live)

    successes = int((live["Status"] == "Success").sum())
    not_added = int((live["Status"] == "GitHub Not Added").sum())
    errors = len(live) - successes - not_added

    print("=" * 72)
    print(
        f"Finished: total={len(live)} "
        f"success={successes} "
        f"not_added={not_added} "
        f"errors={errors}"
    )
    print(f"Wrote: {LIVE_CSV.name}")
    print(f"Wrote: {HISTORY_CSV.name}")
    print(f"Wrote: {DAILY_ACTIVITY_CSV.name}")
    print("=" * 72)


if __name__ == "__main__":
    run()
