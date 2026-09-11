# Воздушный шар — экран входа

Frontend экрана авторизации на React + TypeScript + Vite. Сейчас работает на мок-данных, без backend.

## Запуск

```bash
npm install
npm run dev
```

Открыть адрес, который покажет Vite (обычно `http://localhost:5173`).

## Проверка мок-входа

- `demo` / `demo123`
- `demo@airballoon.ru` / `demo123`

## Где заменить мок на backend

`src/services/mockAuth.ts` — единственная точка, которую нужно заменить реальным API-вызовом. UI менять не требуется.

## Основные файлы

- `src/pages/LoginPage.tsx` — страница и логика формы.
- `src/styles/login.css` — адаптивный дизайн экрана.
- `src/assets/` — изображения из предоставленного архива и перекрашенные в золотой SVG-иконки.
