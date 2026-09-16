# CodeMetrix LeetCode Sync — Extension & Setup Guide

Automated connection between students' LeetCode accounts and the **CodeMetrix ECE Department Platform**.

---

## ⚡ How It Works
1. **Student solves a problem** on LeetCode and clicks **Submit**.
2. When LeetCode returns **Accepted**, the **CodeMetrix Browser Extension**:
   - Captures the **Problem Name & Number**.
   - Captures the **Programming Language** (Python, Java, C++, C, etc.).
   - Captures the **Full Submitted Source Code**.
   - Captures **Runtime (ms) & Memory (MB)**.
   - Securely sends it to Supabase and attaches it to the student's **Register Number**.
3. The solution immediately appears in the student's CodeMetrix Coding Profile and Solutions Archive.

---

## 🛠️ Step 1: Run the Database Migration in Supabase (1-Click)
1. Open your **Supabase Dashboard** -> Click **SQL Editor**.
2. Open [`ADD_LEETCODE_SYNC_EXTENSION.sql`](file:///c:/Sabareesh/ECE_LEETCODE_FULL_FEATURED_FINAL/ADD_LEETCODE_SYNC_EXTENSION.sql).
3. Copy and paste into the SQL Editor -> Click **Run** (`Ctrl + Enter`).
4. Creates the `student_leetcode_submissions` table with optimized indexes and security policies.

---

## 📦 Step 2: Install the CodeMetrix Extension in Chrome / Edge
1. Open Google Chrome or Microsoft Edge.
2. Go to `chrome://extensions/` (or `edge://extensions/`).
3. Turn on **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** (top-left button).
5. Select the folder:
   `c:\Sabareesh\ECE_LEETCODE_FULL_FEATURED_FINAL\extensions\codemetrix-sync`
6. Pin the **CodeMetrix LeetCode Sync** extension to your browser toolbar!

---

## 🧑‍🎓 Step 3: Student Setup (One-time, 10 seconds)
1. Click the **CodeMetrix Sync** icon on the browser toolbar.
2. Enter your **Register Number** (e.g. `922525106264`).
3. It automatically verifies your name from the department directory.
4. Click **Save Profile**.

Done! Every time the student solves a problem on `leetcode.com`, a sleek green notification **"⚡ CodeMetrix Synced!"** will pop up on LeetCode confirming their solution was logged into CodeMetrix.
