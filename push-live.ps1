$ErrorActionPreference = "Stop"

if (-not (Test-Path (Join-Path $PSScriptRoot ".git"))) {
    Write-Host "This folder is not a Git repository yet." -ForegroundColor Yellow
    Write-Host "Run git init / remote setup first. See START_HERE_FULL_FEATURED.md."
    exit 1
}

Push-Location $PSScriptRoot

try {
    git status

    git add .

    $staged = git diff --cached --name-only

    if (-not $staged) {
        Write-Host "No changes to commit." -ForegroundColor Yellow
        exit 0
    }

    git commit -m "Update ECE LeetCode platform"
    git push

    if ($LASTEXITCODE -ne 0) {
        throw "Git push failed."
    }

    Write-Host ""
    Write-Host "Push completed successfully." -ForegroundColor Green
    Write-Host "GitHub Pages / linked Render services can redeploy from this commit."
}
finally {
    Pop-Location
}
