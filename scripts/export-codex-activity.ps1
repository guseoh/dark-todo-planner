#requires -Version 5.1
<#
.SYNOPSIS
  Export Codex daily session starts as a privacy-preserving JSON summary.
.DESCRIPTION
  Reads FILE NAMES ONLY below ~/.codex/sessions and archived_sessions.
  Never opens the JSONL content or reads prompts, projects, code or auth.
  No network requests. The generated JSON can be manually imported into
  Dark Todo Planner > 개발 활동. A session is counted on the date in its
  rollout filename; this is not token usage or productive time.
.EXAMPLE
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\export-codex-activity.ps1
#>
param(
  [string]$CodexHome = $(if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }),
  [string]$OutputFile = $(Join-Path (Get-Location).Path "codex-activity.json")
)

$ErrorActionPreference = "Stop"
$locations = @("sessions", "archived_sessions")
$counts = @{}
$seen = New-Object "System.Collections.Generic.HashSet[string]"
$found = 0

foreach ($location in $locations) {
  $folder = Join-Path $CodexHome $location
  if (-not (Test-Path -LiteralPath $folder -PathType Container)) { continue }
  # -Filter prunes names at the filesystem provider level; do not read file content.
  $files = @(Get-ChildItem -LiteralPath $folder -Filter "rollout-*.jsonl*" -File -Recurse -ErrorAction Stop)
  foreach ($file in $files) {
    if ($file.Name -notmatch '^rollout-(\d{4}-\d{2}-\d{2})T.+\.jsonl(\.zst)?$') { continue }
    $dateKey = $Matches[1]
    $date = [datetime]::MinValue
    if (-not [datetime]::TryParseExact($dateKey, "yyyy-MM-dd",
        [System.Globalization.CultureInfo]::InvariantCulture,
        [System.Globalization.DateTimeStyles]::None, [ref]$date)) { continue }
    # Archived copies and active copies of the same rollout are one session.
    if (-not $seen.Add($file.Name)) { continue }
    if (-not $counts.ContainsKey($dateKey)) { $counts[$dateKey] = 0 }
    $counts[$dateKey] += 1
    $found += 1
  }
}

$days = @($counts.Keys | Sort-Object | ForEach-Object {
  [ordered]@{ date = [string]$_; count = [int]$counts[$_] }
})
$result = [ordered]@{
  version = 1
  source = "codex-local-sessions"
  metric = "sessions"
  days = $days
}
$json = ConvertTo-Json -InputObject $result -Depth 6
$path = [System.IO.Path]::GetFullPath($OutputFile)
[System.IO.File]::WriteAllText($path, $json + [Environment]::NewLine, (New-Object System.Text.UTF8Encoding($false)))
Write-Host ("Codex 세션 " + $found + "개, 활동일 " + $days.Count + "일 집계.")
Write-Host ("파일: " + $path)
Write-Host "이 파일에는 날짜와 세션 수만 있습니다. Todo Planner의 '개발 활동'에서 수동으로 가져오세요."
