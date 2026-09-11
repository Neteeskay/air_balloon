# API / WebSocket contract

Реализованная часть Backend №3 приведена ниже. Контракты Game Engine и data/economy API ещё не предоставлены Backend №1/№2.

## REST

### Tournament (реализовано)

| Method | Path | Response |
|---|---|---|
| GET | `/api/tournaments/active` | `200 {active:false}` или `{active:true,tournament}` |
| GET | `/api/tournaments/{id}/leaderboard?page=0&size=50` | `{tournament,top3,participants,currentPlayer,totalParticipants,page,size,updatedAt}` |
| POST | `/api/tournaments/{id}/participants/me` | `204`, требуется проверенный Principal, общий score читается на сервере |

Tournament: `id,name,description,status,startsAt,endsAt,secondsRemaining,serverTime,revision`.
Leaderboard entry: `position,userId,username,score`. `currentPlayer=null` для анонимного/не вступившего пользователя. Top3 не зависит от страницы; currentPlayer тоже. Размер страницы 1–100.

Игровые REST endpoints и auth: TBD, не выдумывать пути до согласования.

## WebSocket events

STOMP `/ws`, topic `/topic/tournaments/{id}/leaderboard`.

`LEADERBOARD_UPDATE`: `{type,tournamentId,revision,topPlayers:[{userId,position,score}],changedPlayer:{userId,position,score},totalParticipants,updatedAt}`.

В broadcast нет username. Подписаться, затем GET snapshot; учитывать только большие revision. После reconnect и при необходимости обновить свою страницу — повторить GET. Клиентские SEND запрещены. Timer считается frontend по dates/serverTime. Игровые ROUND_STARTED/LEVEL_REACHED/BOOSTER_ACTIVATED/CRASH/ROUND_FINISHED: TBD.

## Error format

Tournament API: `{code,message}`. 400 INVALID_ARGUMENT/INVALID_PAGINATION, 401 AUTHENTICATION_REQUIRED, 404 TOURNAMENT_NOT_FOUND/PLAYER_NOT_FOUND, 409 TOURNAMENT_NOT_ACTIVE, 503 SCORE_SOURCE_UNAVAILABLE. Общая ошибка game/data API: TBD.

## Внутренние DI contracts Backend №2 → №3

`PlayerScoreSource.find(UUID)` возвращает `Optional<PlayerScore>` с общим gameScore. В score-транзакции публикуется Spring `ScoreChanged(PlayerScore)`: `userId,username,gameScore,version,changedAt`. Version строго возрастает для пользователя и сохраняется после рестарта. Details, transaction/cutoff rules и варианты замены adapters: [tournament.md](tournament.md).
