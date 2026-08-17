$ErrorActionPreference = "Stop"

$envFile = Join-Path $PSScriptRoot ".env.runner"

if (-not (Test-Path $envFile)) {
    Write-Host "Missing .env.runner" -ForegroundColor Red
    Write-Host "Copy .env.runner.example to .env.runner and fill the values."
    exit 1
}

Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Docker CLI was not found. Install/start Docker Desktop first." -ForegroundColor Red
    exit 1
}

Push-Location (Join-Path $PSScriptRoot "code-runner")

try {
    docker build -t ece-java-runner .

    if ($LASTEXITCODE -ne 0) {
        throw "Docker image build failed."
    }

    $existingContainer = docker ps -a -q -f "name=^ece-java-runner$"

    if ($existingContainer) {
        docker rm -f ece-java-runner | Out-Null
    }

    docker run -d `
      --name ece-java-runner `
      --restart unless-stopped `
      -p 8080:8080 `
      --memory="768m" `
      --cpus="1.5" `
      --pids-limit="128" `
      -e SUPABASE_URL="$env:SUPABASE_URL" `
      -e SUPABASE_SERVICE_ROLE_KEY="$env:SUPABASE_SERVICE_ROLE_KEY" `
      -e ALLOWED_ORIGINS="$env:ALLOWED_ORIGINS" `
      ece-java-runner

    if ($LASTEXITCODE -ne 0) {
        throw "Docker runner start failed."
    }
}
finally {
    Pop-Location
}

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "Java runner health:" -ForegroundColor Green
Invoke-RestMethod http://localhost:8080/health | ConvertTo-Json
