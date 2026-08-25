import sys
import tracker


def main() -> None:
    if len(sys.argv) != 2:
        print(
            "Usage: python tracker_diagnostic.py <leetcode_username>"
        )
        raise SystemExit(1)

    username = sys.argv[1].strip()

    profile = tracker.fetch_leetcode(username)

    print()
    print("============================================================")
    print(" CODEMETRIX V4 TRACKER DIAGNOSTIC")
    print("============================================================")
    print("Username:", username)
    print("Status:", profile.get("status"))
    print("Total solved:", profile.get("total_solved"))
    print("Easy:", profile.get("easy"))
    print("Medium:", profile.get("medium"))
    print("Hard:", profile.get("hard"))
    print("Total submissions:", profile.get("submissions"))
    print()
    print("Solved Today:", profile.get("solved_today"))
    print("Last 7 Days:", profile.get("last_7_days"))
    print("Last 14 Days:", profile.get("last_14_days"))
    print("Last 30 Days:", profile.get("last_30_days"))
    print("7D Submissions:", profile.get("last_7_days_submissions"))
    print()
    print(
        "Accepted submissions returned:",
        profile.get("recent_accepted_returned"),
    )
    print(
        "Lifetime accepted submissions:",
        profile.get("accepted_submission_total"),
    )
    print(
        "Window coverage:",
        profile.get("window_coverage"),
    )

    t = int(profile.get("solved_today", 0) or 0)
    d7 = int(profile.get("last_7_days", 0) or 0)
    d14 = int(profile.get("last_14_days", 0) or 0)
    d30 = int(profile.get("last_30_days", 0) or 0)

    print()
    print(
        "Invariant Today <= 7 <= 14 <= 30:",
        tracker.validate_window_order(
            t,
            d7,
            d14,
            d30,
        ),
    )
    print("============================================================")


if __name__ == "__main__":
    main()
