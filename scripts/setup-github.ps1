# ============================================================================
# Notes++ — one-shot GitHub setup
# ============================================================================
# Run this AFTER `gh auth login`. It creates the public repo, pushes both
# branches, and configures the settings the automation depends on:
#
#   - Allow auto-merge        (required by auto-merge.yml)
#   - Actions read/write      (required to tag, release, open PRs)
#   - Branch protection on main (required checks + review + linear history)
#   - A ruleset on contrib    (allow fork PRs, block force-push)
#
# Every step is idempotent — re-running is safe.
# ============================================================================

# NOTE: "Continue" not "Stop". With "Stop", PowerShell treats *any* stderr
# write from a native command (gh/git) as a terminating error — `gh repo view`
# on a not-yet-created repo writes to stderr and would abort the whole script.
$ErrorActionPreference = "Continue"
$env:Path = "C:\Program Files\GitHub CLI;C:\Program Files\Git\cmd;$env:Path"

$OWNER = "MaskirovkaOtdel"
$REPO  = "notes-plus-plus"
$FULL  = "$OWNER/$REPO"

Write-Host "==> Checking authentication..." -ForegroundColor Cyan
gh auth status | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Error "Not authenticated. Run 'gh auth login' first."
  exit 1
}

Write-Host "==> Creating public repo $FULL (if missing)..." -ForegroundColor Cyan
gh repo view $FULL 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  gh repo create $FULL --public --source . --remote origin --push `
    --description "Notes++ - fast, offline-capable, scalable notes app"
} else {
  Write-Host "    Repo already exists; ensuring remote + pushing."
  git remote add origin "https://github.com/$FULL.git" 2>$null
}

Write-Host "==> Pushing main and contrib..." -ForegroundColor Cyan
git push -u origin main 2>$null
git push -u origin contrib 2>$null

Write-Host "==> Enabling auto-merge + squash merge..." -ForegroundColor Cyan
gh api -X PATCH "repos/$FULL" `
  -f allow_auto_merge=true `
  -f allow_squash_merge=true `
  -f allow_merge_commit=false `
  -f allow_rebase_merge=true | Out-Null

Write-Host "==> Setting Actions to read/write..." -ForegroundColor Cyan
gh api -X PUT "repos/$FULL/actions/permissions/workflow" `
  -f default_workflow_permissions=write | Out-Null

Write-Host "==> Applying branch protection on main..." -ForegroundColor Cyan
# Requires: a PR, the CI status checks, one approving review, linear history.
$protection = @'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "lint & typecheck",
      "unit tests & coverage",
      "build & e2e",
      "conventional commits"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
'@
$protection | gh api -X PUT "repos/$FULL/branches/main/protection" --input - | Out-Null

Write-Host "==> Creating 'third-party' label..." -ForegroundColor Cyan
gh label create "third-party" --color FBCA04 `
  --description "External contribution held on the contrib landing zone" 2>$null | Out-Null

Write-Host "==> Creating ruleset on contrib (block force-push + deletion)..." -ForegroundColor Cyan
# NOTE: intentionally NO required_pull_request_reviews here. The auto-sync
# workflow fast-forwards contrib with a direct push; requiring PRs on contrib
# would reject that push (the Actions bot has no bypass). Containment of
# third-party work is enforced by the workflows + main's branch protection,
# not by contrib. contrib only needs to resist force-push and deletion.
$ruleset = @'
{
  "name": "protect-contrib",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/contrib"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" }
  ]
}
'@
$ruleset | gh api -X POST "repos/$FULL/rulesets" --input - 2>$null | Out-Null

Write-Host ""
Write-Host "Done. Repo is live at https://github.com/$FULL" -ForegroundColor Green
Write-Host "Next: push a 'feat:' commit to main and watch Actions cut v0.1.0." -ForegroundColor Green
