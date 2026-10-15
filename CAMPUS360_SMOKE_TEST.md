# Smoke test checklist

- [ ] `index.html` opens without console errors.
- [ ] Three role buttons lead to the correct `login.html?role=...` URL.
- [ ] Wrong password shows a message and does not navigate.
- [ ] Student account with role `student` reaches `student-dashboard.html`.
- [ ] Faculty account with role `faculty` reaches `faculty-dashboard.html`.
- [ ] Admin account with role `admin` reaches `admin-dashboard.html`.
- [ ] Selecting the wrong portal for an account is rejected and signs the session out.
- [ ] Sign out clears local portal state and returns home.
- [ ] Existing CodeMetrix pages open directly and their existing config values remain unchanged.
- [ ] RLS/grants tested for all tables and storage before production use.
- [ ] Existing Python trackers, GitHub Actions, reports and code runner separately tested.
