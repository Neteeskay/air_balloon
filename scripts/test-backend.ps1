param(
    [ValidateSet('unit', 'tournament', 'all', 'acceptance')]
    [string]$Suite = 'all',
    [string[]]$MavenArguments = @()
)
$ErrorActionPreference = 'Stop'
$taskBackend = Join-Path $PSScriptRoot '..\backend'
$taskStarted = Get-Date
$taskArgs = @('-B', '-ntp') + $MavenArguments
switch ($Suite) {
    'unit' { $taskArgs += 'test' }
    'tournament' { $taskArgs += @('verify', '-Dit.test=LeaderboardIT,LeaderboardWebSocketIT,TournamentConcurrencyIT,DemoAndRecoveryIT,TournamentSecurityIT,TournamentAcceptanceIT') }
    'all' { $taskArgs += 'verify' }
    'acceptance' { $taskArgs += @('verify', '-Pacceptance') }
}
Push-Location $taskBackend
try {
    & .\mvnw.cmd @taskArgs
    $taskExit = $LASTEXITCODE
    if ($Suite -in @('all', 'acceptance')) {
        $taskReport = Join-Path $taskBackend 'target\failsafe-reports\TEST-ru.hackathon.airballoon.acceptance.GameScenariosIT.xml'
        $taskXml = $null
        if ((Test-Path -LiteralPath $taskReport) -and (Get-Item -LiteralPath $taskReport).LastWriteTime -ge $taskStarted) {
            $taskXml = [xml](Get-Content -LiteralPath $taskReport -Raw)
        }
        foreach ($taskNumber in 1..5) {
            $taskCase = @($taskXml.testsuite.testcase | Where-Object { $_.name -like "scenario$taskNumber*" })
            $taskStatus = 'BLOCKED'
            if ($taskCase.Count -eq 1) {
                if ($taskCase[0].OuterXml -match 'BLOCKED' -or $taskCase[0].skipped) { $taskStatus = 'BLOCKED' }
                elseif ($taskCase[0].failure -or $taskCase[0].error) { $taskStatus = 'FAIL' }
                else { $taskStatus = 'PASS' }
            }
            Write-Host "SCENARIO $taskNumber $taskStatus"
        }
    }
} finally { Pop-Location }
exit $taskExit
