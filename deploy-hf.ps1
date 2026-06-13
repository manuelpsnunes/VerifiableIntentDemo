# Redeploy the current `main` to the Hugging Face Space.
#
# The Space lives on a dedicated `hf-deploy` branch (binaries tracked via Git
# LFS, which HF requires). This script syncs the latest `main` onto that branch
# and pushes it to the Space's `main`, then returns you to `main`.
#
# Prerequisites (one-time):
#   - `hf` remote configured:
#       git remote add hf https://huggingface.co/spaces/manuelpsnunes/verifiable-intent-demo
#   - Logged in so git has a write credential:
#       hf auth login   (paste a WRITE token, answer Y to add as git credential)
#
# Usage:
#   ./deploy-hf.ps1                 # deploy current committed main
#   ./deploy-hf.ps1 -Message "msg"  # custom commit message on the deploy branch

param(
    [string]$Message = "Deploy latest main to Hugging Face Space"
)

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

# Guard: refuse to deploy with uncommitted changes (deploy what's committed).
if (git status --porcelain) {
    Write-Error "Working tree is dirty. Commit or stash changes before deploying."
}

$startBranch = (git rev-parse --abbrev-ref HEAD).Trim()

try {
    # Ensure the deploy branch exists; create it from main if missing.
    git show-ref --verify --quiet refs/heads/hf-deploy
    if ($LASTEXITCODE -ne 0) {
        git checkout main
        git checkout --orphan hf-deploy
        git add -A
        git commit -q -m "Initialize Hugging Face deploy branch"
    } else {
        git checkout hf-deploy
        # Overwrite the deploy tree with main's exact contents.
        git checkout main -- .
        git add -A
        if (git status --porcelain) {
            git commit -q -m $Message
        } else {
            Write-Host "hf-deploy already matches main; pushing existing commit."
        }
    }

    Write-Host "Pushing to Hugging Face Space..." -ForegroundColor Cyan
    git push hf hf-deploy:main
    Write-Host "Deployed. Watch the build at:" -ForegroundColor Green
    Write-Host "  https://huggingface.co/spaces/manuelpsnunes/verifiable-intent-demo" -ForegroundColor Green
}
finally {
    # Always return to the branch you started on.
    git checkout $startBranch | Out-Null
}
