# Research: Фронтенд CRM

**Branch**: `011-crm-frontend` | **Date**: 2026-07-05

## D-01: Фреймворк и сборщик

**Decision**: React 18 + Vite 5
**Rationale**: Зафиксировано в spec.md (speckit-clarify). SPA — правильный выбор для внутреннего инструмента без SEO-требований.
**Alternatives considered**: Next.js App Router — избыточен для закрытого CRM.

---

## D-02: Роутинг

**Decision**: React Router v6 (`react-router-dom`)
**Rationale**: Де-факто стандарт для Vite/SPA. File-based routing (Tanstack Router) не нужен при < 10 маршрутов. React Router v6 `createBrowserRouter` + `Outlet` — достаточно.
**Alternatives considered**: TanStack Router — мощнее, но избыточен; Wouter — слишком минималистичен для вложенных маршрутов.

---

## D-03: Серверный стейт

**Decision**: TanStack Query (React Query) v5
**Rationale**: Кеширование, фоновое обновление, инвалидация после мутаций — всё необходимо для списков + детальных страниц с несколькими вкладками. Без него каждый switch tab делает лишний fetch.
**Alternatives considered**: SWR — проще, но слабее (нет оптимистичных обновлений из коробки); useFetch руками — повторение кода.

---

## D-04: Клиентский стейт

**Decision**: Zustand (минимальный стор: тема + текущий пользователь)
**Rationale**: Глобальный стейт нужен только для двух вещей: текущий пользователь (из GET /api/v1/users/me) и тема (light/dark). Zustand — 1 KB, нет boilerplate.
**Alternatives considered**: React Context — достаточно, но при нескольких провайдерах растёт вложенность; Redux — излишен.

---

## D-05: UI и стилизация

**Decision**: shadcn/ui + Tailwind CSS v3
**Rationale**: shadcn/ui = копируемые компоненты (не зависимость), встроенная поддержка dark mode через CSS-переменные, кастомизация через `tailwind.config.js`. Акцент #e0503f задаётся как CSS-переменная `--primary`. Генерация компонентов: `npx shadcn@latest add button dialog table ...`
**Alternatives considered**: MUI — тяжёлый, сложная кастомизация цвета; Ant Design — не подходит под минималистичный бренд; чистый Tailwind без shadcn — больше ручной работы.

---

## D-06: Drag-and-drop (Kanban)

**Decision**: `@dnd-kit/core` + `@dnd-kit/sortable`
**Rationale**: Упомянут в spec.md как предпочтительный. Accessibility-first, ~10 KB gzip, работает с touch. Для Kanban: `DndContext` на уровне доски, `useDroppable` на колонках, `useDraggable` на карточках.
**Alternatives considered**: react-beautiful-dnd — заморожен (Atlassian); @hello-pangea/dnd — форк rbd, тяжелее.

---

## D-07: Формы

**Decision**: `react-hook-form`
**Rationale**: Uncontrolled inputs — меньше re-renders. Совместим с shadcn/ui `<Form>` компонентами. Валидация через `zod` (минимальные схемы).
**Alternatives considered**: Formik — устарел, больше boilerplate.

---

## D-08: Иконки и уведомления

**Decision**: `lucide-react` (иконки) + `sonner` (toast)
**Rationale**: lucide-react — официально рекомендован shadcn/ui. sonner — 1 KB, красивые toasts, встраивается в shadcn/ui тему.
**Alternatives considered**: heroicons — меньше иконок; react-hot-toast — менее интегрирован.

---

## D-09: Auth-интеграция (SPA + серверные сессии)

**Decision**: Прокси-подход через Vite dev server; в production — Express статически раздаёт `client/dist/`

**Детали**:
- Backend: сессии через `express-session` + `connect-pg-simple` (cookie-based)
- Login flow: SPA → `window.location.href = '/auth/google'` → OAuth → backend редирект на `FRONTEND_URL` (env var)
- Auth check: `GET /api/v1/users/me` → 401 = перенаправить на `/login`; 200 = записать user в Zustand store
- Logout: `window.location.href = '/auth/logout'` (делает req.logout() на бэке + редирект)
- Vite proxy: `/api/*` и `/auth/*` → `http://localhost:3000`
- `GOOGLE_CALLBACK_URL` в .env: `http://localhost:3000/auth/google/callback`
- Backend добавляет `FRONTEND_URL` в .env: при успешном OAuth редиректит на `${FRONTEND_URL}/` вместо `/`

**Минимальное изменение бэкенда**: в `server/routes/auth.js` после `req.logIn` изменить редирект с `res.redirect('/')` на `res.redirect(process.env.FRONTEND_URL || '/')`.

**Alternatives considered**: JWT — требует смены auth-стратегии всего бэкенда; не оправдано.

---

## D-10: Глобальный endpoint активностей

**Decision**: Добавить `GET /api/v1/activities` в backend (activitiesController.js + activities.js)

**Проблема**: FR-012 требует глобальной страницы активностей, но backend имеет только entity-scoped эндпоинты (`GET /api/v1/accounts/:id/activities` и т.д.).

**Решение**: Минимальный новый эндпоинт:
```
GET /api/v1/activities?owner_id=&completed=&type=
```
- Без `owner_id`: admin видит все; bdm/viewer — автоматически фильтруется по `req.user.id`
- `completed` (true/false): фильтр по статусу
- `type` (call/email/meeting/task): фильтр по типу
- Сортировка: `due_date ASC NULLS LAST, created_at DESC`

**SQL**: SELECT из activities + JOIN users; WHERE owner_id по роли; pagination не нужна (небольшой объём данных).

**Scope**: Добавляется как часть F-11 реализации (1 функция в activitiesController.js, 1 GET-маршрут).

---

## D-11: Тёмная тема

**Decision**: Tailwind `darkMode: 'class'` + CSS-переменные shadcn/ui + localStorage

**Реализация**:
- `tailwind.config.js`: `darkMode: 'class'`
- shadcn/ui CSS-переменные в `index.css`: `:root { ... }` и `.dark { ... }` с переопределениями
- `useTheme` hook: читает/пишет в localStorage `theme`, добавляет/убирает класс `dark` на `<html>`
- При инициализации: читает `localStorage.theme`, fallback → `prefers-color-scheme`
- Zustand store: `theme: 'light' | 'dark'`, `toggleTheme()`

---

## D-12: Production-сборка

**Decision**: Express раздаёт `client/dist/` как статику; SPA fallback на `index.html`

**Реализация в server/app.js** (добавляется в F-11):
```js
// Serve built frontend — добавить ПОСЛЕ всех API-маршрутов
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}
```

**Dockerfile**: добавить `COPY client/dist/ ./client/dist/` — сборка `npm run build` запускается вне Docker (или в multi-stage build).

**Development**: две команды параллельно — `npm start` (Express на 3000) и `cd client && npm run dev` (Vite на 5173).
