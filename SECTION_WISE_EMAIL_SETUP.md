# Section-wise Automatic Email Reports

## Routing

- ECE A -> `REPORT_ECE_A_EMAILS`
- ECE B -> `REPORT_ECE_B_EMAILS`
- ECE C -> `REPORT_ECE_C_EMAILS`
- ECE D -> `REPORT_ECE_D_EMAILS`
- ECE E -> `REPORT_ECE_E_EMAILS`
- ECE F -> `REPORT_ECE_F_EMAILS`
- Overall -> `REPORT_HOD_EMAILS`

Each section teacher receives only that section's students and section-filtered
Daily Challenge / Coding Test results.

Every email contains:
- HTML report body
- Excel attachment
- PDF attachment

Multiple recipients are supported:
`teacher1@gmail.com,teacher2@gmail.com`

Empty section recipient secrets are skipped safely.

`REPORT_TO_EMAILS` is kept only as an Overall/HOD fallback if
`REPORT_HOD_EMAILS` is empty.

## GitHub Action secrets

Keep:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GMAIL_ADDRESS`
- `GMAIL_APP_PASSWORD`

Add:
- `REPORT_ECE_A_EMAILS`
- `REPORT_ECE_B_EMAILS`
- `REPORT_ECE_C_EMAILS`
- `REPORT_ECE_D_EMAILS`
- `REPORT_ECE_E_EMAILS`
- `REPORT_ECE_F_EMAILS`
- `REPORT_HOD_EMAILS`

Optional:
- `REPORT_REPLY_TO`
- `REPORT_TO_EMAILS`

## Local dry-run

```powershell
python report_generator.py --mode daily --scope "ECE E" --dry-run
```

```powershell
python report_generator.py --mode weekly --scope "ECE F" --dry-run
```

```powershell
python report_generator.py --mode daily --scope OVERALL --dry-run
```

## GitHub test

1. Push the edited files.
2. Add the new repository secrets.
3. Manually run `Daily ECE Section-wise Performance Reports`.
4. Confirm each teacher receives only their section.
5. Confirm HOD receives Overall.
6. Run the Weekly workflow manually once.
