from pathlib import Path
import pandas as pd

BASE = Path(__file__).resolve().parent
HISTORY = BASE / "History.csv"
ACTIVITY = BASE / "DailyActivity.csv"


def safe_int(value):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return 0


def main():
    if not HISTORY.exists():
        raise SystemExit("History.csv not found")

    history = pd.read_csv(
        HISTORY,
        dtype=str,
        keep_default_na=False,
    )

    rows = []

    for register, group in history.groupby(
        history["Register Number"].astype(str)
    ):
        group = group.copy()
        group["_date"] = pd.to_datetime(
            group["Date"],
            errors="coerce",
        )

        group["_total"] = pd.to_numeric(
            group["Problems Solved"],
            errors="coerce",
        )

        group = (
            group
            .dropna(subset=["_date", "_total"])
            .sort_values("_date")
            .drop_duplicates("_date", keep="last")
            .reset_index(drop=True)
        )

        group["_total"] = group["_total"].cummax()

        for index in range(1, len(group)):
            previous = group.iloc[index - 1]
            current = group.iloc[index]

            days = (
                current["_date"].date()
                - previous["_date"].date()
            ).days

            # Only consecutive daily snapshots are allowed to become
            # an exact Daily Activity row. A 97-problem change across a
            # 6-day data gap is NOT assigned to one fake day anymore.
            if days != 1:
                continue

            solved = max(
                0,
                safe_int(current["_total"])
                - safe_int(previous["_total"]),
            )

            rows.append({
                "Date":
                    current["_date"].date().isoformat(),
                "Section":
                    current.get("Section", ""),
                "Register Number":
                    str(register),
                "Student Name":
                    current.get("Student Name", ""),
                "LeetCode Username":
                    current.get("LeetCode Username", ""),
                "Problems Solved":
                    safe_int(current["_total"]),
                "Solved That Day":
                    solved,
                "Source":
                    "HISTORY_EXACT",
                "Exact":
                    "true",
            })

    repaired = pd.DataFrame(
        rows,
        columns=[
            "Date",
            "Section",
            "Register Number",
            "Student Name",
            "LeetCode Username",
            "Problems Solved",
            "Solved That Day",
            "Source",
            "Exact",
        ],
    )

    backup = ACTIVITY.with_name(
        "DailyActivity_before_snapshot_fix.csv"
    )

    if ACTIVITY.exists():
        ACTIVITY.replace(backup)

    repaired.to_csv(
        ACTIVITY,
        index=False,
        encoding="utf-8-sig",
    )

    print("DailyActivity.csv rebuilt.")
    print(
        "Legacy gap spikes removed. "
        "Backup:",
        backup.name,
    )
    print(
        "Exact daily rows:",
        len(repaired),
    )


if __name__ == "__main__":
    main()
