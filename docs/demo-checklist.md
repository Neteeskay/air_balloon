# Demo checklist: Air Balloon

Цель: быстро проверить обязательные сценарии S1–S5 после появления integration/full-app. Этот checklist не требует закрытия optional S6–S8.

## Быстрый список перед показом

- [ ] REAL login/logout; три профиля, начальный баланс 5 000.
- [ ] GREEN 9 / RED 12; четыре связанных варианта ставка + booster.
- [ ] Rules и global history доступны до старта.
- [ ] Stake debit ровно один раз; cashout после первого уровня.
- [ ] WIN: payout, продолжение полёта, crash, points, reward, потенциальный максимум.
- [ ] LOSS: потеря ставки, crash, points, reward, history.
- [ ] Booster ×2/×3/×4 до cashout; после cashout не активируется.
- [ ] Play Again сохраняет тему; inactivity 10 секунд возвращает к ставке.
- [ ] S5: pointsPerLevel меняется без правки исходников; новый раунд видит новое значение.
- [ ] Refresh/reconnect, два пользователя, global/private history, fairness.
- [ ] Mobile 320 px, desktop, Chrome/Safari/Firefox.
- [ ] Docker clean-room и README воспроизводимы.
- [ ] Optional: live rating / tournament / upsell — только если включены.

Ниже — подробный протокол для первого REAL full-app прогона.

## 0. Preflight

- [ ] Ветка full-app содержит backend fix/backend-frontend-contracts @ 68b99ae (на базе integration/backend-tournament) или более новый совместимый commit.
- [ ] Ветка full-app содержит frontend fix/frontend-hardening @ f131634 или более новый.
- [ ] Frontend собран с VITE_API_MODE=real; в UI виден badge REAL API, не ДЕМО.
- [ ] Реальный adapter больше не содержит working-заглушек auth/catalog.
- [ ] /api/game/catalog отдаёт bounds/themes/boosters; adapter формирует согласованные четыре связанные карточки, не 16 независимых комбинаций.
- [ ] .env создан из .env.example; ADMIN_TOKEN не оставлен публичным за пределами локального demo.
- [ ] Docker Desktop отвечает на docker version.
- [ ] Порты 5173, 8080 и 5432 свободны либо переопределены.
- [ ] git status не содержит случайных локальных изменений.

Команды из корня full-app:

    docker compose up -d --build --wait
    docker compose ps
    docker compose logs --tail=100 backend
    docker compose logs --tail=100 frontend

Ожидается: frontend, backend и postgres healthy/running; http://127.0.0.1:5173 открывается; http://127.0.0.1:8080/actuator/health возвращает UP.

На хосте аудита Docker daemon был недоступен. Перед демо обязательно выполнить этот раздел на рабочем Docker Desktop.

## 1. Быстрый smoke входа

Тестовые пользователи:

| Профиль | Пароль | Начальный баланс |
|---|---|---|
| anna | balloon1 | 5 000 |
| maks | balloon2 | 5 000 |
| liza | balloon3 | 5 000 |

- [ ] Неверный пароль даёт пользовательскую ошибку, network response 401, не 5xx.
- [ ] Вход anna успешен; профиль справа показывает имя и 5 000.
- [ ] Refresh страницы сохраняет session.
- [ ] Logout возвращает на login; /api/auth/me после logout даёт 401.
- [ ] Вход вторым профилем не показывает private state/result первого.

## 2. S1 — выбор и старт

- [ ] Правила открываются до старта и содержат реальные server config values.
- [ ] GREEN показывает 9 уровней, RED — 12.
- [ ] Доступно ровно четыре ставки.
- [ ] Каждой позиции соответствует ×1/×2/×3/×4 согласно согласованному contract.
- [ ] Ставка выше баланса disabled и имеет понятное объяснение.
- [ ] После «Начать полёт» баланс уменьшается ровно на ставку один раз.
- [ ] Повторный start/click/retry не создаёт двойное списание.
- [ ] Network показывает реальный POST /api/rounds и последующий /ws/rounds.
- [ ] До crash в payload/UI нет serverSeed, crashMultiplier или boosterLevel.

Результат S1: PASS только если весь путь выполнен в REAL API без mock/dev lab.

## 3. S2 — успешный cashout

- [ ] Запустить GREEN с доступной ставкой.
- [ ] До первого уровня «Забрать» disabled.
- [ ] При первом запуске игры появляется подсказка у cashout примерно на 4 секунды.
- [ ] Нажать «Забрать» после первого уровня.
- [ ] Выплата = ставка × cashout multiplier по серверному правилу округления.
- [ ] Повторный cashout не меняет баланс/выплату.
- [ ] После cashout шар продолжает полёт до crash.
- [ ] Live UI показывает «Могли бы забрать больше».
- [ ] Result WIN показывает bet, cashout, crash, win, points, reward и потенциальный максимум.
- [ ] Result score = history round score = прирост user score = tournament projection.
- [ ] «Играть снова» сохраняет выбранную тему.
- [ ] При бездействии через 10 секунд происходит возврат к теме/ставке.

## 4. S3 — проигрыш

- [ ] Запустить раунд и не нажимать cashout.
- [ ] При crash ставка не возвращается.
- [ ] Достигнутые до crash level points сохраняются.
- [ ] Result LOSS показывает bet, crash multiplier, 0 win, points и reward.
- [ ] Раунд появляется в глобальной истории всех игроков.
- [ ] В другом профиле этот entry виден в глобальной истории, но private result/state защищены (исправлено в 68b99ae, нужен smoke).
- [ ] «Играть снова» сохраняет тему.

## 5. S4 — booster

Повторить для ×2, ×3 и ×4:

- [ ] Booster level заранее не раскрывается.
- [ ] При достижении скрытого уровня multiplier увеличивается ровно по server event.
- [ ] Есть заметный visual +X points; звук уровня/booster включается после user gesture и отключается mute.
- [ ] Cashout после активации использует boosted multiplier.
- [ ] Booster points входят во все проекции score ровно один раз.
- [ ] После cashout booster не активируется.
- [ ] Duplicate/reconnect события не удваивают points или payout.

## 6. S5 — runtime config

Текущий технический demo выполняется через защищённый Admin API. Для буквального S5 по PDF подготовить доступный эксперту config-file/admin workflow; текущий REST/PowerShell путь отмечен как PARTIAL в аудите. В PowerShell:

    $headers = @{ "X-Admin-Token" = "local-demo-admin" }
    $snapshot = Invoke-RestMethod -Headers $headers http://127.0.0.1:8080/api/admin/config
    $oldPoints = $snapshot.config.pointsPerLevel
    $snapshot.config.pointsPerLevel = $oldPoints + 100
    $body = @{ expectedVersion = $snapshot.version; config = $snapshot.config } | ConvertTo-Json -Depth 20
    Invoke-RestMethod -Method Put -Headers $headers -ContentType "application/json" -Body $body http://127.0.0.1:8080/api/admin/config

- [ ] GET без X-Admin-Token даёт 403.
- [ ] PUT создаёт новую version без перекомпиляции/рестарта.
- [ ] Раунд, начатый до PUT, сохраняет old points snapshot.
- [ ] Новый раунд начисляет new pointsPerLevel.
- [ ] После проверки вернуть исходное значение отдельным versioned PUT.
- [ ] Повторить GET и приложить old/new/final versions к demo evidence.

Примечание: updateIntervalMs в текущем integrated adapter не управляет scheduler tick. Не демонстрировать этот параметр как hot runtime setting, пока gap P2-01 не закрыт.

## 7. Reconnect и restart

- [ ] Во время RUNNING отключить сеть на 3–5 секунд.
- [ ] UI показывает disconnected/recovering, cashout временно недоступен.
- [ ] После возврата сети нет отката multiplier/sequence.
- [ ] Дубликаты events игнорируются.
- [ ] При sequence gap применяется replay или canonical snapshot.
- [ ] Обновление страницы восстанавливает active round по сохранённому roundId.
- [ ] Перезапуск backend во время active round восстанавливает state из PostgreSQL.
- [ ] После restart завершённые balance/history/score/config не теряются.

## 8. Fairness

- [ ] Commitment виден до старта/во время раунда.
- [ ] Reveal отсутствует до crash, включая состояние после cashout.
- [ ] После crash доступны seed, crash, boosterLevel и canonical payload.
- [ ] scripts/verify-fairness.mjs подтверждает корректный reveal.
- [ ] Изменение seed/crash/boosterLevel приводит к verify failure.
- [ ] UI не выдаёт server boolean за независимое доказательство.

## 9. History и multi-user

- [ ] Завершить минимум по одному WIN/LOSS за anna и maks.
- [ ] Глобальная история показывает записи обоих, newest first, с username.
- [ ] Pagination не теряет/не дублирует записи.
- [ ] Заголовок UI говорит «все игроки», а не «ваши».
- [ ] Personal history /api/current-user/history из 68b99ae имеет отдельный scope и не заменяет global history.
- [ ] anna не может прочитать private state/result maks по подменённому UUID.

## 10. Mobile, browsers, performance

- [ ] Viewports: 320×568, 375×812, 768×1024, 1440×900, 1920×1080.
- [ ] Нет горизонтального scroll; profile, modal, history, result и cashout доступны.
- [ ] Проверены Android Chrome, desktop Chrome, Firefox и Safari/iOS.
- [ ] Keyboard focus видим; dialog закрывается; controls имеют доступные labels.
- [ ] prefers-reduced-motion не скрывает критическую информацию.
- [ ] Realtime визуально плавный; записан performance trace/FPS на среднем телефоне.
- [ ] При slow network UI показывает loading/error/retry без вечного loader.

Статус до реального device run: NEEDS PERFORMANCE TEST, не FAIL.

## 11. Docker и clean-room

- [ ] Повторить запуск из свежего clone с одной документированной командой.
- [ ] Миграции применяются автоматически.
- [ ] Nginx проксирует /api и upgrade /ws/rounds.
- [ ] Если включён tournament frontend, отдельный STOMP endpoint /ws и topic работают через тот же ingress.
- [ ] Refresh SPA route не даёт 404.
- [ ] В browser console нет ошибок; backend logs не содержат stack traces/5xx.
- [ ] docker compose down и повторный up сохраняет PostgreSQL data.
- [ ] README содержит точные stack, demo credentials, run/test/config/limitations.

## 12. Optional S6–S8

- [ ] S6 live rating — если включён, top/current score обновляются после round points.
- [ ] S7 tournament — timer, top-3, currentPlayer, pagination и REST resync по revision.
- [ ] Tournament использует отдельный realtime channel, не смешанный с /ws/rounds.
- [ ] S8 upsell — если включён, не мешает Result/Play Again.

Отсутствие S6–S8 не делает обязательный MVP неготовым.

## 13. Evidence pack перед показом

- [ ] Commit SHA full-app и clean git status.
- [ ] docker compose ps.
- [ ] Скриншоты login, S1, WIN, LOSS, booster, history, admin old/new config.
- [ ] Network evidence 401/403, start, cashout, result, history, WebSocket.
- [ ] Test summaries frontend/backend/acceptance.
- [ ] Mobile screenshots и performance result.
- [ ] Список известных ограничений P1/P2 с ответственными.

## Pass rule

Mandatory demo READY, если S1–S5 проходят в REAL API, нет P0, score/balance не расходятся, private endpoints защищены, Docker clean-room воспроизводим, а mobile/browser smoke не выявил критического дефекта. Optional S6–S8 могут оставаться незавершёнными.
