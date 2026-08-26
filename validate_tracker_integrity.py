from pathlib import Path
import pandas as pd

BASE = Path(__file__).resolve().parent
LIVE = BASE / "LiveData.csv"
HISTORY = BASE / "History.csv"


def n(value):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return 0


def main():
    failures = 0

    if LIVE.exists():
        live = pd.read_csv(LIVE, dtype=str, keep_default_na=False)

        print("Checking LiveData.csv...")

        for _, row in live.iterrows():
            today = n(row.get("Solved Today"))
            d7 = n(row.get("Last 7 Days"))
            d14 = n(row.get("Last 14 Days"))
            d30 = n(row.get("Last 30 Days"))
            total = n(row.get("Problems Solved"))

            if not (0 <= today <= d7 <= d14 <= d30 <= total):
                failures += 1
                print(
                    "INVALID:",
                    row.get("Register Number"),
                    row.get("Student Name"),
                    f"T={today} 7={d7} 14={d14} 30={d30} Total={total}",
                )

            e = n(row.get("Easy"))
            m = n(row.get("Medium"))
            h = n(row.get("Hard"))

            if total > 0 and (e + m + h) != total:
                failures += 1
                print(
                    "E/M/H MISMATCH:",
                    row.get("Register Number"),
                    row.get("Student Name"),
                    f"{e}+{m}+{h}!={total}",
                )

    if HISTORY.exists():
        history = pd.read_csv(
            HISTORY,
            dtype=str,
            keep_default_na=False,
        )

        print("Checking History.csv duplicates...")

        if {"Register Number", "Date"}.issubset(history.columns):
            duplicate_counts = (
                history
                .groupby(["Register Number", "Date"])
                .size()
            )

            duplicates = duplicate_counts[
                duplicate_counts > 1
            ]

            if not duplicates.empty:
                failures += len(duplicates)
                print(
                    "Duplicate student/date history groups:",
                    len(duplicates),
                )

    if failures:
        print()
        print("FAILED integrity checks:", failures)
        raise SystemExit(1)

    print()
    print("ALL TRACKER INTEGRITY CHECKS PASSED")


if __name__ == "__main__":
    main()
