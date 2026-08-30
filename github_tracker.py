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
MAX_WORKERS = max(1, min(30, int(os.getenv("GITHUB_TRACKER_WORKERS", "20"))))

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

GITHUB_ERRORS_CSV = BASE_DIR / "GitHubErrors.csv"
ERROR_COLUMNS = [
    "Register Number",
    "Student Name",
    "GitHub Username",
    "Error Type",
    "Error Message",
    "Checked At",
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
  $to: DateTime!,
  $reposCursor: String
) {
  user(login: $login) {
    login
    url

    today: contributionsCollection(from: $today, to: $to) {
      contributionCalendar { totalContributions }
      totalCommitContributions
    }

    d7: contributionsCollection(from: $d7, to: $to) {
      contributionCalendar { totalContributions }
      totalCommitContributions
    }

    d14: contributionsCollection(from: $d14, to: $to) {
      contributionCalendar { totalContributions }
      totalCommitContributions
    }

    d30: contributionsCollection(from: $d30, to: $to) {
      contributionCalendar { totalContributions }
      totalCommitContributions
    }

    repositories(
      first: 100,
      after: $reposCursor,
      ownerAffiliations: OWNER,
      privacy: PUBLIC,
      orderBy: { field: CREATED_AT, direction: DESC }
    ) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes {
        name
        createdAt
        pushedAt
        updatedAt
        homepageUrl
        deployments(first: 1) { totalCount }
      }
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


def fetch_graphql_page(username: str, now: datetime, cursor: str | None) -> dict[str, Any]:
    starts = window_starts(now)
    variables = {
        "login": username,
        "today": starts["today"].isoformat(),
        "d7": starts["d7"].isoformat(),
        "d14": starts["d14"].isoformat(),
        "d30": starts["d30"].isoformat(),
        "to": now.isoformat(),
        "reposCursor": cursor,
    }

    last_error = ""
    for attempt in range(1, 5):
        try:
            response = requests.post(
                GRAPHQL_URL,
                headers=github_headers(),
                json={"query": GRAPHQL_QUERY, "variables": variables},
                timeout=45,
            )

            if response.status_code == 401:
                raise RuntimeError("GitHub authentication failed. Check GITHUB_TRACKER_TOKEN.")

            if response.status_code in (429, 502, 503, 504):
                remaining = response.headers.get("x-ratelimit-remaining", "?")
                reset = response.headers.get("x-ratelimit-reset", "?")
                retry_after = safe_int(response.headers.get("retry-after", 0))
                wait_seconds = retry_after if retry_after > 0 else min(30, 2 ** attempt)
                last_error = (
                    f"GitHub API temporary error HTTP {response.status_code}; "
                    f"remaining={remaining} reset={reset}"
                )
                if attempt < 4:
                    time.sleep(wait_seconds)
                    continue
                raise RuntimeError(last_error)

            if response.status_code == 403:
                remaining = response.headers.get("x-ratelimit-remaining", "?")
                reset = response.headers.get("x-ratelimit-reset", "?")
                raise RuntimeError(
                    f"GitHub API forbidden/rate limited. Remaining={remaining} Reset={reset}"
                )

            response.raise_for_status()
            payload = response.json()
            break
        except (requests.Timeout, requests.ConnectionError) as error:
            last_error = f"GitHub network error: {error}"
            if attempt < 4:
                time.sleep(min(30, 2 ** attempt))
                continue
            raise RuntimeError(last_error) from error
    else:
        raise RuntimeError(last_error or "GitHub API request failed")
    errors = payload.get("errors") or []
    if errors:
        message = " | ".join(clean(item.get("message")) for item in errors)
        # GraphQL can return partial data, but for a tracker accuracy guarantee
        # we reject partial payloads rather than silently mixing missing fields.
        raise RuntimeError(message or "GitHub GraphQL error")

    user = (payload.get("data") or {}).get("user")
    if user is None:
        raise RuntimeError("GitHub user not found")
    return user


def parse_github_datetime(value: Any) -> datetime | None:
    text = clean(value)
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None


def _repository_metrics_from_nodes(nodes: list[dict[str, Any]], now: datetime) -> dict[str, Any]:
    starts = window_starts(now)
    latest_repo = ""
    latest_activity_dt: datetime | None = None
    repo_total = 0
    deployments = 0
    created_counts = {"today": 0, "7": 0, "14": 0, "30": 0}

    for repo in nodes:
        repo_total += 1
        created = parse_github_datetime(repo.get("createdAt"))
        if created is not None:
            created_ist = created.astimezone(IST)
            if created_ist >= starts["today"].astimezone(IST):
                created_counts["today"] += 1
            if created_ist >= starts["d7"].astimezone(IST):
                created_counts["7"] += 1
            if created_ist >= starts["d14"].astimezone(IST):
                created_counts["14"] += 1
            if created_ist >= starts["d30"].astimezone(IST):
                created_counts["30"] += 1

        pushed = parse_github_datetime(repo.get("pushedAt"))
        updated = parse_github_datetime(repo.get("updatedAt"))
        activity_candidates = [item for item in (pushed, updated) if item is not None]
        activity = max(activity_candidates) if activity_candidates else None
        if activity is not None and (latest_activity_dt is None or activity > latest_activity_dt):
            latest_activity_dt = activity
            latest_repo = clean(repo.get("name"))

        # Exact count of GitHub Deployment records attached to this repository.
        # This replaces heuristic homepage/hosting detection.
        deployment_connection = repo.get("deployments") or {}
        deployments += max(0, safe_int(deployment_connection.get("totalCount")))

    return {
        "repos_total_page": repo_total,
        "repos_today": created_counts["today"],
        "repos_7": created_counts["7"],
        "repos_14": created_counts["14"],
        "repos_30": created_counts["30"],
        "deployments": deployments,
        "latest_repository": latest_repo,
        "last_activity": latest_activity_dt.astimezone(IST).strftime("%Y-%m-%d %H:%M") if latest_activity_dt else "",
    }


def fetch_github_profile(username: str) -> dict[str, Any]:
    username = clean(username)
    if not username:
        return empty_metrics("GitHub Not Added")

    now = now_ist()
    all_nodes: list[dict[str, Any]] = []
    first_page = None

    for page_number in range(1, 101):
        user = fetch_graphql_page(username, now, first_page)
        if page_number == 1:
            root = user
            contribution_result = {
                "profile_url": clean(user.get("url")) or f"https://github.com/{username}",
            }
            for alias, label in [("today", "today"), ("d7", "7"), ("d14", "14"), ("d30", "30")]:
                collection = user.get(alias) or {}
                calendar = collection.get("contributionCalendar") or {}
                contribution_result[f"contrib_{label}"] = safe_int(calendar.get("totalContributions"))
                contribution_result[f"commits_{label}"] = safe_int(collection.get("totalCommitContributions"))
        else:
            root = user

        repos = root.get("repositories") or {}
        nodes = repos.get("nodes") or []
        all_nodes.extend(nodes)
        page_info = repos.get("pageInfo") or {}
        if not page_info.get("hasNextPage"):
            break
        first_page = page_info.get("endCursor")
        if not first_page:
            raise RuntimeError("GitHub repository pagination returned no cursor")
    else:
        raise RuntimeError("GitHub repository pagination exceeded 100 pages; refusing incomplete totals")

    repo_data = _repository_metrics_from_nodes(all_nodes, now)
    result = {**contribution_result, **repo_data, "repos_total": len(all_nodes), "status": "Success"}

    for prefix in ("contrib", "commits"):
        values = [safe_int(result[f"{prefix}_today"]), safe_int(result[f"{prefix}_7"]), safe_int(result[f"{prefix}_14"]), safe_int(result[f"{prefix}_30"])]
        if not (0 <= values[0] <= values[1] <= values[2] <= values[3]):
            raise RuntimeError(f"GitHub {prefix} window integrity failure: {values}")

    repo_values = [safe_int(result["repos_today"]), safe_int(result["repos_7"]), safe_int(result["repos_14"]), safe_int(result["repos_30"]), safe_int(result["repos_total"])]
    if not (0 <= repo_values[0] <= repo_values[1] <= repo_values[2] <= repo_values[3] <= repo_values[4]):
        raise RuntimeError(f"GitHub repository window integrity failure: {repo_values}")

    return result


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


def previous_good_github_row(previous_history: pd.DataFrame, register_number: str) -> dict[str, Any] | None:
    if previous_history is None or previous_history.empty or "Register Number" not in previous_history.columns:
        return None
    rows = previous_history[previous_history["Register Number"].astype(str).str.strip() == str(register_number).strip()].copy()
    if rows.empty:
        return None
    if "Status" in rows.columns:
        good = rows[rows["Status"].astype(str).str.startswith("Success")]
        if not good.empty:
            rows = good
    if "Date" in rows.columns:
        rows["_date"] = pd.to_datetime(rows["Date"], errors="coerce")
        rows = rows.dropna(subset=["_date"]).sort_values("_date")
    return rows.iloc[-1].to_dict() if not rows.empty else None


def stale_github_metrics(previous_history: pd.DataFrame, register_number: str, error_status: str) -> dict[str, Any]:
    old = previous_good_github_row(previous_history, register_number)
    if old is None:
        return empty_metrics(error_status)
    def n(key: str) -> int: return safe_int(old.get(key, 0))
    return {
        "profile_url": f"https://github.com/{clean(old.get('GitHub Username',''))}" if clean(old.get("GitHub Username", "")) else "",
        "contrib_today": n("Contributions Today"),
        "contrib_7": n("Contributions 7 Days"),
        "contrib_14": n("Contributions 14 Days"),
        "contrib_30": n("Contributions 30 Days"),
        "commits_today": n("Commits Today"),
        "commits_7": n("Commits 7 Days"),
        "commits_14": n("Commits 14 Days"),
        "commits_30": n("Commits 30 Days"),
        "repos_total": n("Repositories Total"),
        "repos_today": n("Repositories Today"),
        "repos_7": n("Repositories 7 Days"),
        "repos_14": n("Repositories 14 Days"),
        "repos_30": n("Repositories 30 Days"),
        "deployments": n("Detected Deployments"),
        "latest_repository": clean(old.get("Latest Repository", "")),
        "last_activity": clean(old.get("Last Activity", "")),
        "status": f"STALE | {error_status} | Previous data kept",
    }

def process_student(
    position: int,
    total: int,
    student: pd.Series,
    updated_at: str,
    previous_history: pd.DataFrame,
) -> dict[str, Any]:
    register = clean(student.get("Register Number"))
    name = clean(student.get("Student Name"))
    username = clean(student.get("GitHub Username"))
    section = clean(student.get("Section")) or "ECE E"

    print(
        f"[START {position}/{total}] "
        f"{section} | {name} | @{username or 'not-added'}"
    )

    try:
        data = fetch_github_profile(username)
    except Exception as error:
        data = empty_metrics(f"Worker error: {clean(error)}")

    if clean(data.get("status", "")) != "Success":
        error_status = clean(data.get("status", "GitHub tracking failed"))
        data = stale_github_metrics(previous_history, register, error_status)

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

    # CodeMetrix GitHub ranking rule:
    # Verified-now rows first, then 1) actual GitHub deployment records,
    # 2) total public repositories, 3) 30-day contributions,
    # 4) 30-day commits, 5) register number.
    frame["_VerifiedNow"] = frame["Status"].astype(str).str.strip().eq("Success").map({True: 0, False: 1})
    sortable = frame.sort_values(
        by=[
            "_VerifiedNow",
            "Detected Deployments",
            "Repositories Total",
            "Contributions 30 Days",
            "Commits 30 Days",
            "Register Number",
        ],
        ascending=[True, False, False, False, False, True],
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
        ].copy()
        section_rows["_VerifiedNow"] = section_rows["Status"].astype(str).str.strip().eq("Success").map({True: 0, False: 1})
        section_rows = section_rows.sort_values(
            by=[
                "_VerifiedNow",
                "Detected Deployments",
                "Repositories Total",
                "Contributions 30 Days",
                "Commits 30 Days",
                "Register Number",
            ],
            ascending=[True, False, False, False, False, True],
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



def _classify_github_error(status: str) -> tuple[str, str]:
    text = clean(status)
    lower = text.lower()
    if not text or lower == "success":
        return "", ""
    if "github not added" in lower:
        return "NOT_ADDED", text
    if "not found" in lower:
        return "PROFILE_NOT_FOUND", text
    if "rate limited" in lower or "429" in lower:
        return "RATE_LIMITED", text
    if "forbidden" in lower or "403" in lower:
        return "API_FORBIDDEN", text
    if "authentication failed" in lower or "401" in lower:
        return "AUTHENTICATION", text
    if "timeout" in lower:
        return "TIMEOUT", text
    if "network" in lower or "connection" in lower:
        return "NETWORK_ERROR", text
    return "TRACKING_ERROR", text


def write_github_errors(rows: list[dict[str, Any]]) -> None:
    errors=[]
    checked_at=now_ist().strftime("%Y-%m-%d %H:%M:%S %Z")
    for row in rows:
        error_type, message = _classify_github_error(row.get("Status", ""))
        if not error_type:
            continue
        errors.append({
            "Register Number": clean(row.get("Register Number", "")),
            "Student Name": clean(row.get("Student Name", "")),
            "GitHub Username": clean(row.get("GitHub Username", "")),
            "Error Type": error_type,
            "Error Message": message,
            "Checked At": checked_at,
        })
    atomic_csv_write(pd.DataFrame(errors, columns=ERROR_COLUMNS), GITHUB_ERRORS_CSV)
    print(f"GitHub error report: {len(errors)} current error profile(s)")
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return
    try:
        url=f"{SUPABASE_URL}/rest/v1/github_errors"
        headers={"apikey":SUPABASE_SERVICE_ROLE_KEY,"Authorization":f"Bearer {SUPABASE_SERVICE_ROLE_KEY}","Content-Type":"application/json","Prefer":"return=minimal"}
        clear=requests.delete(url,headers=headers,timeout=30); clear.raise_for_status()
        if errors:
            payload=[{"register_number":i["Register Number"],"student_name":i["Student Name"],"github_username":i["GitHub Username"] or None,"error_type":i["Error Type"],"error_message":i["Error Message"],"checked_at":datetime.now(IST).isoformat()} for i in errors]
            response=requests.post(url,headers=headers,json=payload,timeout=45); response.raise_for_status()
    except Exception as error:
        print(f"[ERROR TABLE WARNING] Could not sync github_errors: {error}")

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
    previous_history = pd.DataFrame(columns=HISTORY_COLUMNS)
    if HISTORY_CSV.exists():
        try:
            previous_history = pd.read_csv(HISTORY_CSV, dtype=str, keep_default_na=False)
        except Exception:
            previous_history = pd.DataFrame(columns=HISTORY_COLUMNS)

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
                previous_history,
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

    # Never write stale/error values into historical snapshots. They remain in
    # GitHubLiveData with an explicit status, while the last known-good history
    # stays intact.
    fresh_live = live[
        live["Status"].astype(str).str.strip().eq("Success")
    ].copy()

    history = update_history(fresh_live)
    activity = update_daily_activity(fresh_live)

    atomic_csv_write(live, LIVE_CSV)
    atomic_csv_write(history, HISTORY_CSV)
    atomic_csv_write(activity, DAILY_ACTIVITY_CSV)

    # Do not overwrite Supabase current facts with stale/error placeholders.
    sync_performance_to_supabase(fresh_live)
    write_github_errors(live.to_dict("records"))

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
