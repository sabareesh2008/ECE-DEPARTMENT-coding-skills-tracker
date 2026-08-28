from pathlib import Path
import pandas as pd

BASE = Path(__file__).resolve().parent

required = [
    "index.html",
    "leetcode.html",
    "github.html",
    "script.js",
    "github-script.js",
    "github_tracker.py",
    "ADD_GITHUB_TRACKER.sql",
    "GitHubLiveData.csv",
    "GitHubHistory.csv",
    "GitHubDailyActivity.csv",
    ".github/workflows/github-tracker.yml",
]

missing = [
    name for name in required
    if not (BASE / name).exists()
]

if missing:
    raise SystemExit("Missing files: " + ", ".join(missing))

live = pd.read_csv(
    BASE / "GitHubLiveData.csv",
    dtype=str,
    keep_default_na=False,
)

required_columns = [
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
    "Status",
]

missing_columns = [
    col for col in required_columns
    if col not in live.columns
]

if missing_columns:
    raise SystemExit(
        "GitHubLiveData missing columns: "
        + ", ".join(missing_columns)
    )

github_html = (BASE / "github.html").read_text(encoding="utf-8")

for required_text in [
    "30D Contributions",
    "14D Contributions",
    "7D Contributions",
    "7D Commits",
    "Today Contributions",
    "Repositories",
    "30D Commits / 30D Repos / Deployed",
]:
    if required_text not in github_html:
        raise SystemExit(
            "GitHub UI missing: " + required_text
        )

if 'class="github-mode"' not in github_html:
    raise SystemExit("GitHub mode marker missing")

entry = (BASE / "index.html").read_text(encoding="utf-8")

if 'href="leetcode.html"' not in entry:
    raise SystemExit("LeetCode entry box missing")

if 'href="github.html"' not in entry:
    raise SystemExit("GitHub entry box missing")

print("ALL GITHUB V1 STRUCTURE CHECKS PASSED")
