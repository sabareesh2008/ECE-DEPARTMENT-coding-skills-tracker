from __future__ import annotations

import os
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo
from typing import Any

import requests

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv(
    "SUPABASE_SERVICE_ROLE_KEY",
    "",
).strip()

LEETCODE_URL = "https://leetcode.com/graphql"
MAX_WORKERS = 20
RECENT_SUBMISSION_LIMIT = 300
IST = ZoneInfo("Asia/Kolkata")

QUERY = """
query getUserProfile($username: String!, $limit: Int!) {
  matchedUser(username: $username) {
    username
    submitStatsGlobal {
      acSubmissionNum {
        difficulty
        count
        submissions
      }
    }
    userCalendar {
      submissionCalendar
    }
  }

  recentAcSubmissionList(
    username: $username,
    limit: $limit
  ) {
    title
    titleSlug
    timestamp
  }
}
"""


def headers() -> dict[str, str]:
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def empty_profile(status: str) -> dict[str, Any]:
    return {
        "total_solved": 0,
        "easy": 0,
        "medium": 0,
        "hard": 0,
        "total_submissions": 0,
        "solved_today": 0,
        "last_7_days": 0,
        "last_14_days": 0,
        "last_30_days": 0,
        "last_7_days_submissions": 0,
        "last_problem": "",
        "last_solved": "",
        "status": status,
    }


def stat(items: list[dict[str, Any]], difficulty: str, field: str = "count") -> int:
    for item in items:
        if item.get("difficulty") == difficulty:
            return int(item.get(field, 0) or 0)
    return 0


def unique_since(
    submissions: list[dict[str, Any]],
    start: datetime,
) -> int:
    solved = set()

    for submission in submissions:
        timestamp = submission.get("timestamp")
        slug = submission.get("titleSlug")

        if not timestamp or not slug:
            continue

        submitted = datetime.fromtimestamp(
            int(timestamp),
            tz=IST,
        )

        if submitted >= start:
            solved.add(slug)

    return len(solved)


def submission_count_since(
    submission_calendar: Any,
    start: datetime,
) -> int:
    if not submission_calendar:
        return 0

    try:
        calendar = (
            json.loads(submission_calendar)
            if isinstance(submission_calendar, str)
            else submission_calendar
        )
    except (TypeError, ValueError, json.JSONDecodeError):
        return 0

    if not isinstance(calendar, dict):
        return 0

    total = 0

    for timestamp, count in calendar.items():
        try:
            submitted = datetime.fromtimestamp(int(timestamp), tz=IST)
            if submitted >= start:
                total += int(count or 0)
        except (TypeError, ValueError, OSError):
            continue

    return total


def fetch_profile(username: str) -> dict[str, Any]:
    if not username:
        return empty_profile("Username missing")

    body = {
        "operationName": "getUserProfile",
        "query": QUERY,
        "variables": {
            "username": username,
            "limit": RECENT_SUBMISSION_LIMIT,
        },
    }

    response = requests.post(
        LEETCODE_URL,
        json=body,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Origin": "https://leetcode.com",
            "Referer": f"https://leetcode.com/u/{username}/",
            "User-Agent": "Mozilla/5.0",
        },
        timeout=30,
    )

    if response.status_code != 200:
        return empty_profile(f"HTTP {response.status_code}")

    payload = response.json()

    if payload.get("errors"):
        return empty_profile("GraphQL error")

    data = payload.get("data", {})
    user = data.get("matchedUser")

    if user is None:
        return empty_profile("User not found")

    stats = (
        user.get("submitStatsGlobal", {})
        .get("acSubmissionNum", [])
    )

    submissions = data.get("recentAcSubmissionList", []) or []

    submission_calendar = (
        user.get("userCalendar", {})
        .get("submissionCalendar", "{}")
    )

    now = datetime.now(IST)

    today_start = datetime.combine(
        date.today(),
        datetime.min.time(),
        tzinfo=IST,
    )

    seven_start = now - timedelta(days=7)
    fourteen_start = now - timedelta(days=14)
    thirty_start = now - timedelta(days=30)

    last_problem = ""
    last_solved = ""

    if submissions:
        last_problem = str(submissions[0].get("title") or "")
        timestamp = submissions[0].get("timestamp")

        if timestamp:
            last_solved = datetime.fromtimestamp(
                int(timestamp),
                tz=IST,
            ).strftime("%Y-%m-%d %H:%M:%S IST")

    return {
        "total_solved": stat(stats, "All"),
        "easy": stat(stats, "Easy"),
        "medium": stat(stats, "Medium"),
        "hard": stat(stats, "Hard"),
        "total_submissions": stat(stats, "All", "submissions"),
        "solved_today": unique_since(submissions, today_start),
        "last_7_days": unique_since(submissions, seven_start),
        "last_14_days": unique_since(submissions, fourteen_start),
        "last_30_days": unique_since(submissions, thirty_start),
        "last_7_days_submissions":
            submission_count_since(
                submission_calendar,
                seven_start,
            ),
        "last_problem": last_problem,
        "last_solved": last_solved,
        "status": "Success",
    }


def load_faculties() -> list[dict[str, Any]]:
    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/faculties",
        headers=headers(),
        params={
            "select": "id,faculty_name,leetcode_username",
            "order": "faculty_name.asc",
        },
        timeout=30,
    )

    response.raise_for_status()
    return response.json()



def save_history_snapshot(
    faculty_id: int,
    profile: dict[str, Any],
) -> None:
    today = datetime.now(IST).date().isoformat()

    payload = {
        "faculty_id": faculty_id,
        "activity_date": today,
        "total_solved": int(profile.get("total_solved", 0) or 0),
        "solved_today": int(profile.get("solved_today", 0) or 0),
        "last_14_days": int(profile.get("last_14_days", 0) or 0),
        "last_7_days_submissions": int(
            profile.get("last_7_days_submissions", 0) or 0
        ),
        "easy": int(profile.get("easy", 0) or 0),
        "medium": int(profile.get("medium", 0) or 0),
        "hard": int(profile.get("hard", 0) or 0),
        "updated_at": datetime.now(IST).isoformat(),
    }

    response = requests.post(
        f"{SUPABASE_URL}/rest/v1/faculty_activity_history",
        headers={
            **headers(),
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        params={
            "on_conflict": "faculty_id,activity_date",
        },
        json=payload,
        timeout=30,
    )

    response.raise_for_status()


def update_faculty(
    faculty: dict[str, Any],
) -> tuple[str, str]:
    faculty_id = faculty["id"]
    username = str(faculty.get("leetcode_username") or "").strip()

    try:
        profile = fetch_profile(username)
    except Exception as error:
        profile = empty_profile(f"Error: {error}")

    profile["tracked_at"] = datetime.now(IST).isoformat()
    profile["updated_at"] = datetime.now(IST).isoformat()

    response = requests.patch(
        f"{SUPABASE_URL}/rest/v1/faculties",
        headers={
            **headers(),
            "Prefer": "return=minimal",
        },
        params={"id": f"eq.{faculty_id}"},
        json=profile,
        timeout=30,
    )

    response.raise_for_status()

    save_history_snapshot(
        faculty_id,
        profile,
    )

    return (
        str(faculty.get("faculty_name") or faculty.get("faculty_id")),
        profile["status"],
    )


def main() -> None:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."
        )

    faculties = load_faculties()

    if not faculties:
        print("No faculty profiles configured.")
        return

    print(f"Tracking {len(faculties)} faculty LeetCode profile(s)...")

    with ThreadPoolExecutor(
        max_workers=min(MAX_WORKERS, max(1, len(faculties)))
    ) as pool:
        futures = {
            pool.submit(update_faculty, faculty): faculty
            for faculty in faculties
        }

        for future in as_completed(futures):
            faculty = futures[future]

            try:
                name, status = future.result()
                print(f"[FACULTY] {name}: {status}")
            except Exception as error:
                print(
                    f"[FACULTY ERROR] "
                    f"{faculty.get('faculty_name')}: {error}"
                )

    print("Faculty LeetCode tracking completed.")


if __name__ == "__main__":
    main()
