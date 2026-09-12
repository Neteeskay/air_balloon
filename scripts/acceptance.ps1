[CmdletBinding()]
param(
  [ValidateSet('self-check', 'live', 'full')]
  [string]$Mode = 'full',
  [switch]$FreshDatabase,
  [switch]$SkipBrowserInstall,
  [string]$ComposeProject = 'air-balloon-acceptance'
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$e2eRoot = Join-Path $repoRoot 'e2e'
$artifactRoot = Join-Path $repoRoot 'artifacts\acceptance'
$phaseResults = [System.Collections.Generic.List[object]]::new()
$startedAt = [DateTimeOffset]::UtcNow
$exitCode = 0

New-Item -ItemType Directory -Force -Path $artifactRoot | Out-Null

function Add-PhaseResult {
  param([string]$Name, [string]$Status, [string]$Reason = '')
  $phaseResults.Add([pscustomobject]@{ name = $Name; status = $Status; reason = $Reason })
  Write-Host ("{0}: {1}{2}" -f $Name, $Status, $(if ($Reason) { " - $Reason" } else { '' }))
}

function Save-RunnerSummary {
  $summary = [ordered]@{
    startedAt = $startedAt.ToString('o')
    finishedAt = [DateTimeOffset]::UtcNow.ToString('o')
    mode = $Mode
    composeProject = $ComposeProject
    phases = $phaseResults
    exitCode = $exitCode
  }
  $summary | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 -LiteralPath (Join-Path $artifactRoot 'runner-summary.json')
  $lines = @('# Acceptance runner summary', '', "Mode: $Mode", '', '| Phase | Status | Reason |', '| --- | --- | --- |')
  foreach ($phase in $phaseResults) {
    $reason = ([string]$phase.reason).Replace('|', '\|').Replace("`r", ' ').Replace("`n", ' ')
    $lines += "| $($phase.name) | $($phase.status) | $reason |"
  }
  $lines += @('', "Exit code: $exitCode", '')
  $lines | Set-Content -Encoding utf8 -LiteralPath (Join-Path $artifactRoot 'runner-summary.md')
}

function Invoke-NpmPhase {
  param([string]$Name, [string[]]$Arguments)
  Push-Location $e2eRoot
  try {
    & npm @Arguments
    if ($LASTEXITCODE -ne 0) {
      Add-PhaseResult $Name 'FAIL' "npm $($Arguments -join ' ') exited $LASTEXITCODE"
      $script:exitCode = 1
      return $false
    }
    Add-PhaseResult $Name 'PASS'
    return $true
  } finally { Pop-Location }
}

try {
  if (-not (Get-Command node -ErrorAction SilentlyContinue) -or -not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Add-PhaseResult 'tooling' 'BLOCKED' 'Node.js 18+ and npm are required'
    $exitCode = 2
    Save-RunnerSummary
    exit $exitCode
  }
  $nodeMajor = [int]((& node --version).TrimStart('v').Split('.')[0])
  if ($nodeMajor -lt 18) {
    Add-PhaseResult 'tooling' 'BLOCKED' "Node.js 18+ is required; found $(& node --version)"
    $exitCode = 2
    Save-RunnerSummary
    exit $exitCode
  }
  Add-PhaseResult 'tooling' 'PASS' "Node $(& node --version)"

  if (-not (Invoke-NpmPhase 'dependencies' @('ci', '--no-audit', '--no-fund'))) { Save-RunnerSummary; exit $exitCode }
  if (-not (Invoke-NpmPhase 'typecheck' @('exec', '--', 'tsc', '--noEmit'))) { Save-RunnerSummary; exit $exitCode }
  if (-not (Invoke-NpmPhase 'harness-self-check' @('run', 'self-check'))) { Save-RunnerSummary; exit $exitCode }
  if ($Mode -eq 'self-check') { Save-RunnerSummary; exit 0 }

  if ($Mode -eq 'full') {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
      Add-PhaseResult 'docker-compose' 'BLOCKED' 'Docker with Compose is required for full acceptance'
      $exitCode = 2
      Save-RunnerSummary
      exit $exitCode
    }
    & docker compose version *> $null
    if ($LASTEXITCODE -ne 0) {
      Add-PhaseResult 'docker-compose' 'BLOCKED' 'Docker Compose v2 is required for full acceptance'
      $exitCode = 2
      Save-RunnerSummary
      exit $exitCode
    }
    Push-Location $repoRoot
    try {
      $services = @(& docker compose config --services)
      if ($LASTEXITCODE -ne 0) { throw 'docker compose config failed' }
      $missing = @('postgres', 'backend', 'frontend') | Where-Object { $_ -notin $services }
      if ($missing.Count -gt 0) {
        Add-PhaseResult 'docker-compose' 'BLOCKED' "Required services not integrated: $($missing -join ', ')"
        $exitCode = 2
        Save-RunnerSummary
        exit $exitCode
      }
      if ($FreshDatabase) {
        & docker compose -p $ComposeProject down --volumes --remove-orphans
        if ($LASTEXITCODE -ne 0) { throw 'Unable to reset the dedicated acceptance Compose project' }
        Add-PhaseResult 'fresh-database-reset' 'PASS' "Removed only Compose project $ComposeProject"
      }
      & docker compose -p $ComposeProject up -d --build --wait
      if ($LASTEXITCODE -ne 0) { throw 'docker compose up failed' }
      Add-PhaseResult 'docker-compose-start' 'PASS'
      & docker compose -p $ComposeProject up -d --build --wait
      if ($LASTEXITCODE -ne 0) { throw 'repeated docker compose startup failed' }
      Add-PhaseResult 'repeated-startup' 'PASS'

      $dbName = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { 'air_balloon' }
      $dbUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { 'air_balloon' }
      & docker compose -p $ComposeProject exec -T postgres psql -v ON_ERROR_STOP=1 -U $dbUser -d $dbName -c 'SELECT version();'
      if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL query failed' }
      Add-PhaseResult 'postgresql-real' 'PASS'
      & docker compose -p $ComposeProject exec -T postgres psql -v ON_ERROR_STOP=1 -U $dbUser -d $dbName -c 'SELECT count(*) AS successful_migrations FROM flyway_schema_history WHERE success = true;'
      if ($LASTEXITCODE -ne 0) { throw 'Flyway migrations are missing or unsuccessful' }
      Add-PhaseResult 'migrations' 'PASS'
      & docker compose -p $ComposeProject exec -T postgres psql -v ON_ERROR_STOP=1 -U $dbUser -d $dbName -c "SELECT count(*) AS constraints FROM information_schema.table_constraints WHERE table_schema = 'public' AND constraint_type IN ('PRIMARY KEY','FOREIGN KEY','UNIQUE','CHECK');"
      if ($LASTEXITCODE -ne 0) { throw 'Unable to inspect PostgreSQL constraints' }
      Add-PhaseResult 'database-constraints' 'PASS'
      # Canonical paired stake options (100/250/500/1000) make the full
      # black-box suite intentionally spend more than the demo seed balance.
      # Top up only the dedicated acceptance fixtures; product defaults remain
      # unchanged and this command never targets a non-Compose database.
      & docker compose -p $ComposeProject exec -T postgres psql -v ON_ERROR_STOP=1 -U $dbUser -d $dbName -c "UPDATE users SET bonus_balance = 100000, game_score = 0, game_score_version = 0, lottery_ticket_count = 0;"
      if ($LASTEXITCODE -ne 0) { throw 'Unable to seed acceptance fixture balances' }
      Add-PhaseResult 'acceptance-fixtures' 'PASS' 'Demo users topped up for canonical stake matrix'
    } catch {
      Add-PhaseResult 'docker-postgres' 'BLOCKED' $_.Exception.Message
      $exitCode = 2
      Save-RunnerSummary
      exit $exitCode
    } finally { Pop-Location }
  }

  # Auth setup must always create a fresh server session; a stale cookie can
  # belong to another demo user after a previous local run.
  # Keep Playwright targets in sync with the Compose ports selected by the
  # caller; otherwise its defaults (18080/5173) can silently hit another app.
  if (-not $env:ACCEPTANCE_API_URL) {
    $backendPort = if ($env:BACKEND_PORT) { $env:BACKEND_PORT } else { '8080' }
    $env:ACCEPTANCE_API_URL = "http://127.0.0.1:$backendPort"
  }
  if (-not $env:ACCEPTANCE_FRONTEND_URL) {
    $frontendPort = if ($env:FRONTEND_PORT) { $env:FRONTEND_PORT } else { '5173' }
    $env:ACCEPTANCE_FRONTEND_URL = "http://127.0.0.1:$frontendPort"
  }
  $authState = Join-Path $e2eRoot '.auth\anna.json'
  if (Test-Path -LiteralPath $authState) { Remove-Item -LiteralPath $authState -Force }
  if (-not $SkipBrowserInstall) {
    if (-not (Invoke-NpmPhase 'browser-install' @('run', 'install:browsers'))) { Save-RunnerSummary; exit $exitCode }
  }
  Invoke-NpmPhase 'real-api-browser-acceptance' @('run', 'acceptance') | Out-Null

  if ($Mode -eq 'full' -and $exitCode -eq 0) {
    if (Invoke-NpmPhase 'persistence-prepare' @('run', 'persistence:prepare')) {
      Push-Location $repoRoot
      try {
        & docker compose -p $ComposeProject restart backend
        if ($LASTEXITCODE -ne 0) { throw 'backend restart failed' }
        & docker compose -p $ComposeProject up -d --wait
        if ($LASTEXITCODE -ne 0) { throw 'backend did not become healthy after restart' }
        Add-PhaseResult 'backend-restart' 'PASS'
      } catch {
        Add-PhaseResult 'backend-restart' 'FAIL' $_.Exception.Message
        $exitCode = 1
      } finally { Pop-Location }
      if ($exitCode -eq 0) { Invoke-NpmPhase 'persistence-verify' @('run', 'persistence:verify') | Out-Null }
    }
  } elseif ($Mode -eq 'live') {
    Add-PhaseResult 'restart-persistence' 'NOT RUN' 'Use -Mode full for controlled Docker restart'
  }
} finally {
  if ($exitCode -ne 0 -and $Mode -eq 'full' -and (Get-Command docker -ErrorAction SilentlyContinue)) {
    Push-Location $repoRoot
    try {
      & docker compose -p $ComposeProject logs --no-color backend frontend postgres 2>&1 |
        Set-Content -Encoding utf8 -LiteralPath (Join-Path $artifactRoot 'compose.log')
    } catch { }
    finally { Pop-Location }
  }
  Save-RunnerSummary
}

exit $exitCode
