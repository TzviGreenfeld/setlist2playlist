<#
.SYNOPSIS
  Package the setlist2playlist project and (re)deploy it to the Azure VM.

.DESCRIPTION
  - Tars up the repo (excluding .git, node_modules, __pycache__, build, deploy)
  - Uploads it via scp
  - Extracts on the VM and runs `docker compose up -d --build`

.PARAMETER VmHost
  DNS name of the VM (defaults to the provisioned one).

.PARAMETER SshKey
  Path to the private SSH key (defaults to the one generated at provisioning).

.PARAMETER Service
  Optional: rebuild only a specific service (backend | frontend | caddy).
  Omit to rebuild everything.

.EXAMPLE
  .\deploy.ps1                       # full redeploy
  .\deploy.ps1 -Service backend      # only rebuild backend
#>
[CmdletBinding()]
param(
    [string]$VmHost  = "setlist2playlist-46687.westeurope.cloudapp.azure.com",
    [string]$SshUser = "azureuser",
    [string]$SshKey  = "$env:LOCALAPPDATA\Temp\s2p-deploy\id_rsa",
    [string]$Service = ""
)

$ErrorActionPreference = "Stop"

$repoRoot    = Split-Path -Parent $PSScriptRoot
$deployDir   = $PSScriptRoot
$stagingRoot = Join-Path $env:TEMP "s2p-deploy-stage"
$stagingSrc  = Join-Path $stagingRoot "src"
$tarball     = Join-Path $stagingRoot "s2p.tgz"

$sshTarget = "$SshUser@$VmHost"

$redirectUri = "https://$VmHost/callback"
$backendUrl  = "https://$VmHost/api"

# --- Git: stage & commit & push (skips gitignored env files) --------------
Write-Host "==> git stage / commit / push" -ForegroundColor Cyan
Push-Location $repoRoot
try {
    git add -A
    $hasStaged = (git diff --cached --name-only) -ne $null
    if ($hasStaged) {
        $now = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        git commit -m "$now deployment" | Out-Null
        Write-Host "    committed: $now deployment"
    } else {
        Write-Host "    nothing to commit"
    }
    git push
    if ($LASTEXITCODE -ne 0) { throw "git push failed" }
}
finally {
    Pop-Location
}

# Read local client/.env, override just the two URL vars, keep everything else
$envFile = Join-Path $repoRoot "client\.env"
if (-not (Test-Path $envFile)) { throw "Missing $envFile" }

$overrides = [ordered]@{
    "REACT_APP_SPOTIFY_REDIRECT_URI" = $redirectUri
    "REACT_APP_BACKEND_URL"          = $backendUrl
}

$mergedLines = New-Object System.Collections.Generic.List[string]
$seen = @{}
foreach ($line in Get-Content $envFile) {
    $m = [regex]::Match($line, '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=')
    if ($m.Success -and $overrides.Contains($m.Groups[1].Value)) {
        $k = $m.Groups[1].Value
        $mergedLines.Add("$k=$($overrides[$k])") | Out-Null
        $seen[$k] = $true
    } else {
        $mergedLines.Add($line) | Out-Null
    }
}
# Append overrides that weren't in the file
foreach ($k in $overrides.Keys) {
    if (-not $seen.ContainsKey($k)) {
        $mergedLines.Add("$k=$($overrides[$k])") | Out-Null
    }
}
$mergedEnv = ($mergedLines -join "`n") + "`n"

# Read setlist.fm API key (backend search). Optional: warn if absent.
$setlistApiKeyMatch = (Select-String -Path $envFile -Pattern '^SETLIST_FM_API_KEY=(.*)')
$setlistApiKey = if ($setlistApiKeyMatch) { $setlistApiKeyMatch.Matches[0].Groups[1].Value } else { "" }
if (-not $setlistApiKey) {
    Write-Host "    WARNING: SETLIST_FM_API_KEY not found in $envFile - artist search will be disabled in prod" -ForegroundColor Yellow
}

Write-Host "==> Staging project" -ForegroundColor Cyan
if (Test-Path $stagingRoot) { Remove-Item -Recurse -Force $stagingRoot }
New-Item -ItemType Directory -Path $stagingSrc -Force | Out-Null

robocopy $repoRoot $stagingSrc /E `
    /XD .git node_modules __pycache__ build deploy `
    /XF *.log `
    /NFL /NDL /NJH /NJS /NP | Out-Null

# Overlay prod compose + Caddyfile
Copy-Item (Join-Path $deployDir "docker-compose.prod.yml") $stagingSrc -Force
Copy-Item (Join-Path $deployDir "Caddyfile") $stagingSrc -Force

# Overwrite client/.env for prod (baked into React build)
Set-Content -Path (Join-Path $stagingSrc "client\.env") -Value $mergedEnv -Encoding ASCII -NoNewline

# .env for docker compose (feeds build args)
Set-Content -Path (Join-Path $stagingSrc ".env") -Value $mergedEnv -Encoding ASCII -NoNewline

Write-Host "==> Creating tarball" -ForegroundColor Cyan
tar -czf $tarball -C $stagingRoot src

Write-Host "==> Uploading to $sshTarget" -ForegroundColor Cyan
scp -i $SshKey -o StrictHostKeyChecking=no $tarball "${sshTarget}:~/s2p.tgz"
if ($LASTEXITCODE -ne 0) { throw "scp failed" }

Write-Host "==> Extracting and (re)building on VM" -ForegroundColor Cyan
$svcArg = if ($Service) { $Service } else { "" }
$remoteCmd = "set -e; rm -rf ~/src; tar -xzf ~/s2p.tgz -C ~; cd ~/src; sudo docker compose -f docker-compose.prod.yml up -d --build $svcArg; sudo docker compose -f docker-compose.prod.yml ps"

ssh -i $SshKey -o StrictHostKeyChecking=no $sshTarget $remoteCmd
if ($LASTEXITCODE -ne 0) { throw "remote deploy failed" }

Write-Host "==> Done. https://$VmHost" -ForegroundColor Green
