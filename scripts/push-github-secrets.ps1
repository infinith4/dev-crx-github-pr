param(
  [string]$Repo = "",
  [string]$EnvFile = ".env.local",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$requiredSecrets = @(
  "CWS_PUBLISHER_ID",
  "CWS_EXTENSION_ID",
  "GCP_WORKLOAD_IDENTITY_PROVIDER",
  "GCP_SERVICE_ACCOUNT"
)

function Get-RepoFromGitRemote {
  $remote = git remote get-url origin 2>$null
  if (-not $remote) {
    throw "Could not detect repository from git remote origin. Pass -Repo owner/name."
  }

  if ($remote -match "github\.com[:/](?<owner>[^/]+)/(?<name>[^/.]+)(\.git)?$") {
    return "$($Matches.owner)/$($Matches.name)"
  }

  throw "Could not parse GitHub repository from origin URL: $remote. Pass -Repo owner/name."
}

function Import-EnvFile {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return
  }

  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) {
      return
    }

    $parts = $line -split "=", 2
    if ($parts.Count -ne 2) {
      return
    }

    $name = $parts[0].Trim()
    $value = $parts[1].Trim()

    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
        ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    if ($name) {
      [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
  }
}

function Require-Command {
  param([string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    if ($Name -eq "gh") {
      throw @"
Required command not found: gh

Install GitHub CLI, then authenticate before running this script:

  winget install --id GitHub.cli
  gh auth login

If winget is unavailable, install GitHub CLI from:
  https://cli.github.com/
"@
    }

    throw "Required command not found: $Name"
  }
}

function Get-GitHubCliPath {
  $command = Get-Command "gh" -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $candidatePaths = @(
    "$env:ProgramFiles\GitHub CLI\gh.exe",
    "$env:LocalAppData\Programs\GitHub CLI\gh.exe"
  )

  foreach ($path in $candidatePaths) {
    if ($path -and (Test-Path -LiteralPath $path)) {
      return $path
    }
  }

  return $null
}

Require-Command -Name "git"

Import-EnvFile -Path $EnvFile

if (-not $Repo) {
  $Repo = Get-RepoFromGitRemote
}

$gh = $null
if (-not $DryRun) {
  $gh = Get-GitHubCliPath
  if (-not $gh) {
    Require-Command -Name "gh"
  }
  & $gh auth status | Out-Null
}

$missing = @()
foreach ($secretName in $requiredSecrets) {
  $value = [Environment]::GetEnvironmentVariable($secretName, "Process")
  if (-not $value) {
    $missing += $secretName
  }
}

if ($missing.Count -gt 0) {
  $joined = $missing -join ", "
  throw "Missing required secret values: $joined. Set them as environment variables or in $EnvFile."
}

Write-Host "Repository: $Repo"
Write-Host "Secrets: $($requiredSecrets -join ', ')"

foreach ($secretName in $requiredSecrets) {
  if ($DryRun) {
    Write-Host "[dry-run] Would set GitHub secret: $secretName"
    continue
  }

  $value = [Environment]::GetEnvironmentVariable($secretName, "Process")
  $value | & $gh secret set $secretName --repo $Repo
  Write-Host "Set GitHub secret: $secretName"
}

Write-Host "Done."
