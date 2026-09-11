# Scripts

Сюда складывать скрипты запуска, seed демо-данных и вспомогательные утилиты команды.

`verify-fairness.mjs` — независимый SHA-256 verifier, Node.js 18+, без npm-зависимостей.
Из корня проекта:

```powershell
node scripts/verify-fairness.mjs --demo
node --test scripts/verify-fairness.test.mjs
node scripts/verify-fairness.mjs proof.json 'sha256:<commitment-сохранённый-при-старте>'
```

Формат, ограничения и проверка подмены: [fairness.md](../docs/fairness.md).
