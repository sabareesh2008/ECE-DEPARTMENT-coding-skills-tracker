#!/usr/bin/env python3
"""
Sync all 368 students from local CSV files to Supabase students table.
"""

import os
import sys
from pathlib import Path
import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent
STUDENTS_CSV = ROOT / "students.csv"
GITHUB_STUDENTS_CSV = ROOT / "github_students.csv"

SUPABASE_URL = (os.getenv("SUPABASE_URL") or "").rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY") or ""


def load_merged_students() -> list[dict]:
    s_df = pd.read_csv(STUDENTS_CSV, dtype=str).fillna("") if STUDENTS_CSV.exists() else pd.DataFrame()
    g_df = pd.read_csv(GITHUB_STUDENTS_CSV, dtype=str).fillna("") if GITHUB_STUDENTS_CSV.exists() else pd.DataFrame()

    merged = {}
    for _, row in s_df.iterrows():
        reg = str(row.get("Register Number", "")).strip()
        if not reg:
            continue
        merged[reg] = {
            "register_number": reg,
            "student_name": str(row.get("Student Name", "")).strip(),
            "leetcode_username": str(row.get("LeetCode Username", "")).strip() or None,
            "github_username": None,
            "section": str(row.get("Section", "ECE A")).strip() or "ECE A",
            "year": 2,
        }

    for _, row in g_df.iterrows():
        reg = str(row.get("Register Number", "")).strip()
        if not reg:
            continue
        gh = str(row.get("GitHub Username", "")).strip() or None
        if reg in merged:
            if gh:
                merged[reg]["github_username"] = gh
            if not merged[reg]["student_name"]:
                merged[reg]["student_name"] = str(row.get("Student Name", "")).strip()
            if not merged[reg]["section"]:
                merged[reg]["section"] = str(row.get("Section", "ECE A")).strip()
        else:
            merged[reg] = {
                "register_number": reg,
                "student_name": str(row.get("Student Name", "")).strip(),
                "leetcode_username": None,
                "github_username": gh,
                "section": str(row.get("Section", "ECE A")).strip() or "ECE A",
                "year": 2,
            }

    return list(merged.values())


def sync_to_supabase():
    students = load_merged_students()
    print(f"Loaded {len(students)} student(s) from local CSV datasets.")

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("\n[!] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.")
        print("To run automatically, set the environment variables:")
        print("  $env:SUPABASE_URL = 'https://<your-project>.supabase.co'")
        print("  $env:SUPABASE_SERVICE_ROLE_KEY = '<your-service-role-key>'")
        print("\nAlternatively, execute SYNC_ALL_STUDENTS_TO_SUPABASE.sql in the Supabase SQL Editor.")
        return 1

    url = f"{SUPABASE_URL}/rest/v1/students"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    params = {
        "on_conflict": "register_number",
    }

    chunk_size = 50
    total_synced = 0
    for i in range(0, len(students), chunk_size):
        chunk = students[i:i + chunk_size]
        response = requests.post(url, headers=headers, params=params, json=chunk, timeout=30)
        
        if response.status_code != 201 and "year" in response.text.lower():
            no_year_chunk = [{k: v for k, v in item.items() if k != "year"} for item in chunk]
            response = requests.post(url, headers=headers, params=params, json=no_year_chunk, timeout=30)
            
        if response.status_code not in (200, 201):
            print(f"[!] Supabase sync failed on chunk {i}-{i+len(chunk)}: {response.status_code} - {response.text}")
            return 1
            
        total_synced += len(chunk)
        print(f"Synced {total_synced}/{len(students)} students...")

    print(f"\nSUCCESS: All {total_synced} students successfully synchronized to Supabase 'students' table!")
    return 0


if __name__ == "__main__":
    sys.exit(sync_to_supabase())
