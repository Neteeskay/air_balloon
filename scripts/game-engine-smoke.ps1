param(
  [string]$BaseUrl = 'http://localhost:8080'
)

$ErrorActionPreference = 'Stop'
$socket = [System.Net.WebSockets.ClientWebSocket]::new()
$deadline = [System.Threading.CancellationTokenSource]::new([TimeSpan]::FromSeconds(45))
$buffer = [byte[]]::new(65536)
$wsUrl = $BaseUrl.TrimEnd('/') -replace '^http', 'ws'

function Read-GameEvent {
  $message = [System.IO.MemoryStream]::new()
  try {
    do {
      $received = $socket.ReceiveAsync([ArraySegment[byte]]::new($buffer), $deadline.Token).GetAwaiter().GetResult()
      if ($received.MessageType -eq [System.Net.WebSockets.WebSocketMessageType]::Close) {
        throw 'WebSocket closed before ROUND_FINISHED'
      }
      $message.Write($buffer, 0, $received.Count)
    } while (!$received.EndOfMessage)
    return [System.Text.Encoding]::UTF8.GetString($message.ToArray()) | ConvertFrom-Json
  } finally { $message.Dispose() }
}

try {
  $null = $socket.ConnectAsync([Uri]"$wsUrl/ws/rounds", $deadline.Token).GetAwaiter().GetResult()
  $ready = Read-GameEvent
  if ($ready.type -ne 'CONNECTION_READY') { throw 'WebSocket subscription was not ready' }
  $round = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/rounds" -ContentType 'application/json' `
    -Body '{"theme":"GREEN","betAmount":100,"boosterMultiplier":3}' -TimeoutSec 5
  $boosterCount = 0
  $cashoutCount = 0
  $crashCount = 0
  $payout = $null
  $cashoutSequence = 0
  $continuedFlight = $false
  $previousSequence = 0
  do {
    $event = Read-GameEvent
    if ($event.roundId -ne $round.id) { continue }
    if ($event.sequence -le $previousSequence) { throw 'Events are not strictly ordered' }
    $previousSequence = $event.sequence
    if ($event.type -ne 'MULTIPLIER_UPDATE') { Write-Output "$($event.sequence): $($event.type)" }
    switch ($event.type) {
      'BOOSTER_ACTIVATED' {
        $boosterCount++
        if ([decimal]$event.data.beforeMultiplier -ne 2 -or [decimal]$event.data.afterMultiplier -ne 6) {
          throw 'Demo booster must transform 2.00 into 6.00'
        }
        $payout = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/rounds/$($round.id)/cashout" -TimeoutSec 5
        if ($payout.status -ne 'CASHED_OUT') { throw 'Cashout did not succeed' }
      }
      'CASHOUT_SUCCESS' { $cashoutCount++; $cashoutSequence = $event.sequence }
      'MULTIPLIER_UPDATE' {
        if ($cashoutSequence -gt 0 -and $event.sequence -gt $cashoutSequence `
            -and [decimal]$event.data.multiplier -gt [decimal]$payout.cashoutMultiplier) {
          $continuedFlight = $true
        }
      }
      'CRASH' { $crashCount++ }
    }
  } while ($event.type -ne 'ROUND_FINISHED' -or $event.roundId -ne $round.id)

  $final = $event.data.round
  if ($boosterCount -ne 1 -or $cashoutCount -ne 1 -or $crashCount -ne 1 -or !$continuedFlight `
      -or $final.status -ne 'FINISHED' -or $final.outcome -ne 'CASHED_OUT' `
      -or [decimal]$final.winAmount -ne [decimal]$payout.winAmount -or [decimal]$final.crashMultiplier -ne 8.42) {
    throw 'Final state or lifecycle assertions failed'
  }
  Write-Output "SMOKE PASS: round=$($round.id), cashout=$($payout.cashoutMultiplier), win=$($final.winAmount), crash=8.42"
} finally {
  $socket.Abort()
  $socket.Dispose()
  $deadline.Dispose()
}
