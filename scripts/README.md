# Scripts

Сюда складывать скрипты запуска, seed демо-данных и вспомогательные утилиты команды.

## Acceptance

Строгий E2E/acceptance runner:

```powershell
.\scripts\acceptance.ps1 -Mode self-check
.\scripts\acceptance.ps1 -Mode full -FreshDatabase
```

Подробности и статусы: [`docs/acceptance-tests.md`](../docs/acceptance-tests.md).
