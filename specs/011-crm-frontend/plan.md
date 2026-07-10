# Implementation Plan: Фронтенд CRM

**Branch**: `011-crm-frontend` | **Date**: 2026-07-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/011-crm-frontend/spec.md`

## Summary

React + Vite SPA, потребляющее все backend API (F-04–F-10). Включает: авторизацию через Google OAuth (cookie-сессия), оболочку с боковой навигацией, CRUD-страницы аккаунтов/контактов/сделок с модальными формами, Kanban-доску с drag-and-drop, глобальную страницу активностей. Дополнительно: новый backend endpoint `GET /api/v1/activities` и минимальное изменение редиректа после OAuth.

## Technical Context

**Language/Version**: JavaScript (Node.js LTS для Vite dev-сервера), React 18

**Primary Dependencies**:
- `react` 18, `react-dom` 18
- `vite` 5 + `@vitejs/plugin-react`
- `react-router-dom` 6
- `@tanstack/react-query` 5
- `zustand`
- `tailwindcss` 3, `@tailwindcss/forms`
- `shadcn/ui` (компоненты копируются через CLI)
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- `react-hook-form`, `zod`
- `lucide-react`
- `sonner`
- `class-variance-authority`, `clsx`, `tailwind-merge` (shadcn/ui зависимости)

**Storage**: Нет (данные в PostgreSQL через backend API)

**Testing**: Ручное тестирование по quickstart.md (автотесты вне scope MVP)

**Target Platform**: Браузер (Chrome/Firefox/Safari последних версий); mobile-friendly (< 768px)

**Project Type**: SPA (Single Page Application)

**Performance Goals**: Первый рендер < 2 сек на локальном dev-сервере; не критично для внутреннего инструмента 4 человек

**Constraints**: Нет SSR; offline не поддерживается; темная и светлая темы

**Scale/Scope**: 4 пользователя; предполагаемый объём данных: < 500 аккаунтов, < 1000 контактов, < 200 сделок

## Constitution Check

| Принцип | Статус | Комментарий |
|---------|--------|-------------|
| Простота прежде всего | ✅ PASS | SPA без SSR; React+Vite — минимально достаточный стек; нет лишних абстракций |
| Spec-First | ✅ PASS | specify → clarify → plan → tasks → implement |
| Последовательность фич | ✅ PASS | F-01–F-10 завершены; F-11 начинается после |
| YAGNI | ✅ PASS | Только то, что в spec.md; нет фич «на будущее» |
| Стек (backend) | ✅ PASS | Backend не меняется (кроме 1 нового endpoint + 1 строка в auth.js) |
| Новые файлы | ✅ PASS | `client/` — новая директория; сервер без изменения структуры |

**Constitution gaps**: Конституция не описывает frontend-стек (помечен как «не выбран»). React+Vite зафиксирован в spec.md clarifications. При необходимости — обновить constitution.md отдельно.

## Project Structure

### Documentation (this feature)

```text
specs/011-crm-frontend/
├── plan.md              # Этот файл
├── research.md          # Библиотечные решения (D-01–D-12)
├── data-model.md        # View models и API shapes
├── contracts/
│   └── api-consumed.md  # Все endpoint-ы, потребляемые frontend-ом
├── quickstart.md        # Сценарии тестирования
├── checklists/
│   └── requirements.md  # Чеклист спецификации (все PASS)
└── tasks.md             # /speckit-tasks output (не создан)
```

### Source Code — новая директория `client/`

```text
client/
├── public/
│   └── favicon.ico
├── src/
│   ├── main.jsx                 # Vite entry point
│   ├── App.jsx                  # Router + QueryClient + ThemeProvider
│   ├── api/                     # API-клиент (fetch-обёртки)
│   │   ├── client.js            # Base fetch: baseURL, credentials, 401-handling
│   │   ├── accounts.js
│   │   ├── contacts.js
│   │   ├── deals.js
│   │   ├── notes.js
│   │   ├── attachments.js
│   │   ├── activities.js        # включает listActivities (глобальный)
│   │   └── users.js
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.jsx     # Sidebar + Header + Outlet
│   │   │   ├── Sidebar.jsx      # Навигационные ссылки + логотип
│   │   │   └── ThemeToggle.jsx  # Кнопка light/dark
│   │   ├── modals/
│   │   │   └── ConfirmDialog.jsx # Диалог подтверждения удаления
│   │   └── ui/                  # shadcn/ui компоненты (генерируются CLI)
│   ├── pages/
│   │   ├── Login.jsx            # Страница входа
│   │   ├── accounts/
│   │   │   ├── AccountsList.jsx
│   │   │   └── AccountDetail.jsx
│   │   ├── contacts/
│   │   │   ├── ContactsList.jsx
│   │   │   └── ContactDetail.jsx
│   │   ├── deals/
│   │   │   ├── DealsList.jsx
│   │   │   └── DealDetail.jsx
│   │   ├── kanban/
│   │   │   └── KanbanBoard.jsx
│   │   └── activities/
│   │       └── ActivitiesList.jsx
│   ├── hooks/
│   │   ├── useAuth.js           # Читает user из Zustand + guard
│   │   └── useTheme.js          # light/dark toggle + localStorage
│   ├── stores/
│   │   └── authStore.js         # Zustand: currentUser
│   └── lib/
│       └── utils.js             # cn() helper для Tailwind
├── index.html
├── vite.config.js               # Proxy /api/* и /auth/* → localhost:3000
├── tailwind.config.js           # darkMode: 'class', accent #e0503f
├── components.json              # shadcn/ui config
├── postcss.config.js
├── package.json
└── .env.example                 # VITE_API_URL=http://localhost:3000
```

### Backend-изменения (минимальные, в рамках F-11)

```text
server/
├── controllers/
│   └── activitiesController.js  # + функция listActivities (глобальный)
├── routes/
│   └── activities.js            # + GET / → listActivities (ПЕРЕД /:id)
├── app.js                       # + статика client/dist в production
└── routes/
    └── auth.js                  # + редирект на FRONTEND_URL после OAuth
```

## Complexity Tracking

*Нет нарушений конституции — таблица не заполняется.*

## Архитектурные решения

### Маршруты приложения

| URL | Компонент | Auth |
|-----|-----------|------|
| `/login` | `Login.jsx` | Public |
| `/accounts` | `AccountsList.jsx` | Protected |
| `/accounts/:id` | `AccountDetail.jsx` | Protected |
| `/contacts` | `ContactsList.jsx` | Protected |
| `/contacts/:id` | `ContactDetail.jsx` | Protected |
| `/deals` | `DealsList.jsx` | Protected |
| `/deals/:id` | `DealDetail.jsx` | Protected |
| `/kanban` | `KanbanBoard.jsx` | Protected |
| `/activities` | `ActivitiesList.jsx` | Protected |
| `*` | Redirect → `/accounts` | Protected |

### Защищённые маршруты

```jsx
// ProtectedRoute: проверяет user из Zustand store
// Если null → <Navigate to="/login" />
// Если загружается → spinner
// Иначе → <Outlet />
```

### Auth-инициализация

```jsx
// App.jsx: при монтировании — GET /api/v1/users/me
// 200 → setUser(data) → рендер приложения
// 401 → setUser(null) → рендер Login
// Без мерцания: показывать full-screen spinner пока запрос не завершён
```

### Tailwind accent-цвет

```js
// tailwind.config.js
theme: {
  extend: {
    colors: {
      primary: '#e0503f',
      'primary-dark': '#c44434',  // hover state
    }
  }
}
```

### Vite proxy

```js
// vite.config.js
server: {
  proxy: {
    '/api': 'http://localhost:3000',
    '/auth': 'http://localhost:3000',
    '/uploads': 'http://localhost:3000',
  }
}
```
