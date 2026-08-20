$ErrorActionPreference = "Stop"

# ── Auto-bump patch version ──
$currentVersion = (Get-Content package.json | ConvertFrom-Json).version
$parts = $currentVersion.Split(".")
$parts[2] = [int]$parts[2] + 1
$newVersion = $parts -join "."
$pkg = Get-Content package.json | ConvertFrom-Json
$pkg.version = $newVersion
$pkg | ConvertTo-Json -Depth 10 | Set-Content package.json
Write-Host "Version: $currentVersion -> $newVersion" -ForegroundColor Yellow

# ── Prompt for token ──
$secureToken = Read-Host -Prompt "Enter your GitHub Personal Access Token" -AsSecureString
$BSTR = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
$token = [Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

if (-not $token) {
    Write-Host "No token provided. Aborting." -ForegroundColor Red
    exit 1
}

$env:GH_TOKEN = $token

# ── Git commit + tag ──
Write-Host ""
Write-Host "=== Committing changes ===" -ForegroundColor Cyan
git add -A
git commit -m "Release v$newVersion"
if ($LASTEXITCODE -ne 0) { Write-Host "Nothing to commit or git commit failed." -ForegroundColor Yellow }

git tag "v$newVersion"
if ($LASTEXITCODE -ne 0) { Write-Host "Git tag failed." -ForegroundColor Red; exit 1 }

Write-Host "Tagged v$newVersion" -ForegroundColor Green

# ── Build Vite ──
Write-Host ""
Write-Host "=== Building Vite app ===" -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "Vite build failed." -ForegroundColor Red; exit 1 }

# ── Build + Publish Electron ──
Write-Host ""
Write-Host "=== Building + Publishing Electron to GitHub Releases ===" -ForegroundColor Cyan
npx electron-builder --win --publish always
if ($LASTEXITCODE -ne 0) { Write-Host "Electron build/publish failed." -ForegroundColor Red; exit 1 }

# ── Push git + tag ──
Write-Host ""
Write-Host "=== Pushing to GitHub ===" -ForegroundColor Cyan
git push origin HEAD
git push origin "v$newVersion"
if ($LASTEXITCODE -ne 0) { Write-Host "Git push failed." -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "=== Done! v$newVersion published ===" -ForegroundColor Green
