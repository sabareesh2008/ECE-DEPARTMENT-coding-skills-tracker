from pathlib import Path
import sys
import pandas as pd

import tracker


def main():
    if len(sys.argv) < 3:
        print(
            "Usage: python tracker_diagnostic.py "
            "<register_number> <leetcode_username>"
        )
        raise SystemExit(1)

    register_number = sys.argv[1].strip()
    username = sys.argv[2].strip()

    history = (
        pd.read_csv(tracker.HISTORY_CSV, dtype=str)
        if tracker.HISTORY_CSV.exists()
        else pd.DataFrame()
    )

    profile = tracker.fetch_leetcode(username)

    result = tracker.calculate_completed_day_counts(
        history,
        pd.DataFrame(),
        register_number,
        profile["total_solved"],
        profile["solved_today"],
        profile["last_7_days"],
        profile["last_14_days"],
        profile["last_30_days"],
    )

    print()
    print("========== CODEMETRIX TRACKER DIAGNOSTIC ==========")
    print("Username:", username)
    print("Register Number:", register_number)
    print("Current Total Solved:", profile["total_solved"])
    print("Recent feed returned:", len(profile["recent_submissions"]))
    print("Recent Today:", profile["solved_today"])
    print("Recent 7 Days:", profile["last_7_days"])
    print("Recent 14 Days:", profile["last_14_days"])
    print("Recent 30 Days:", profile["last_30_days"])
    print()
    print("FINAL Today:", result[4])
    print("FINAL 7 Days:", result[0])
    print("FINAL 14 Days:", result[1])
    print("FINAL 30 Days:", result[2])
    print(
        "Sources:",
        tracker.calculate_completed_day_counts.last_coverage,
    )
    print("===================================================")


if __name__ == "__main__":
    main()
