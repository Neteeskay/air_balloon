# Воздушный шар — интегрированный frontend

Ветка объединяет готовые экраны авторизации и выбора режима полёта с пошаговым onboarding.

## Запуск

```bash
npm install
npm run dev
```

Vite по умолчанию открывает приложение на `http://localhost:${FRONTEND_PORT:-5173}`.
Для прямого подключения к backend задайте `VITE_API_BASE_URL` (например,
`http://localhost:${BACKEND_PORT:-8080}`) в окружении Vite; Docker/Nginx
использует относительные `/api` и `/ws` маршруты.

## Demo-пользователи

- `demo` / `demo123`
- `demo@airballoon.ru` / `demo123`

У пользователей разные стабильные `userId`, поэтому session, выбранный режим и завершение onboarding проверяются независимо.

## Проверки

```bash
npm run typecheck
npm run build
```

## Основные файлы

- `src/pages/LoginPage.tsx` — форма входа.
- `src/pages/FlightModePage.tsx` — выбор красного/зелёного режима и onboarding.
- `src/app/App.tsx` — минимальная связка auth session → current user → flight mode.
- `src/styles/login.css` и `src/styles/index.css` — раздельные стили экранов.
