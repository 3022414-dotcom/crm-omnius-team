# Research: Контакты (Contacts)

**Feature**: F-05 Контакты | **Date**: 2026-07-04 | **Plan**: [plan.md](plan.md)

## Design Decisions

### D-01: Multer v2 — конфигурация и обработка ошибок

**Decision**: `multer.memoryStorage()` + `fileFilter` по mimetype + `limits.fileSize`; MulterError обрабатывается inline в роуте через callback-форму `upload.single()(req, res, cb)`.

**Rationale**: memoryStorage даёт `req.file.buffer` для записи через `fs.promises.writeFile` без временных файлов. Inline обработка ошибок даёт точный контроль над кодами ответа (400/413) без глобального error handler.

**Implementation Pattern**:
```js
// server/middleware/upload.js
const multer = require('multer');

const ALLOWED_MIMETYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('INVALID_FILE_TYPE'), false);
    }
  },
});

module.exports = { upload };
```

**Inline error handling в роуте**:
```js
router.post('/:id/photo', requireRole(['admin', 'bdm']), (req, res, next) => {
  upload.single('photo')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'Payload Too Large', message: 'Файл не должен превышать 5 MB' });
      }
      if (err.message === 'INVALID_FILE_TYPE') {
        return res.status(400).json({ error: 'Bad Request', message: 'Допустимые форматы: jpeg, jpg, png, webp' });
      }
      return next(err);
    }
    uploadContactPhoto(req, res, next);
  });
});
```

**Alternatives considered**:
- diskStorage multer — менее гибко, путь файла нужно знать до парсинга (но ID контакта уже известен из params → OK); однако memoryStorage + manual write даёт больший контроль
- Глобальный Express error handler для MulterError — менее прозрачно, сложнее тестировать

---

### D-02: Хранение и именование файлов фото

**Decision**: `crypto.randomUUID()` для генерации имени файла; путь `uploads/contacts/{contact_id}/avatar_{uuid}.ext`; директория создаётся через `fs.mkdirSync(dir, { recursive: true })` при каждом запросе (идемпотентно).

**Rationale**: `crypto.randomUUID()` встроен в Node.js LTS 18+ — отдельный пакет `uuid` не нужен (пакет не установлен). Один аватар на контакт — поэтому путь предсказуем по contact_id; uuid обеспечивает уникальность и cache-busting.

**Implementation Pattern**:
```js
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');

async function savePhoto(contactId, file) {
  const ext = file.mimetype.split('/')[1].replace('jpeg', 'jpg');
  const uuid = randomUUID();
  const dir = path.join('uploads', 'contacts', contactId);
  const filename = `avatar_${uuid}.${ext}`;
  const filepath = path.join(dir, filename);
  fs.mkdirSync(dir, { recursive: true });
  await fs.promises.writeFile(filepath, file.buffer);
  return filepath; // сохраняется в photo_path
}
```

**Alternatives considered**:
- `uuid` пакет — не установлен; `crypto.randomUUID()` эквивалентен
- Статическое имя `avatar.jpg` (без uuid) — нет cache-busting при замене

---

### D-03: Замена фото (replace on re-upload)

**Decision**: При загрузке нового фото: прочитать текущий `photo_path` из БД → если есть файл → удалить `fs.promises.unlink(oldPath)` → записать новый → обновить `photo_path` в БД.

**Rationale**: Один файл на контакт. Старый файл нужно явно удалять, иначе накапливаются orphaned файлы.

**Implementation Pattern**:
```js
async function uploadContactPhoto(req, res) {
  const { id } = req.params;
  if (!req.file) return res.status(400).json({ error: 'Bad Request', message: 'Файл не загружен' });

  const { rows } = await pool.query('SELECT photo_path FROM contacts WHERE id = $1', [id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not Found' });

  // Удалить старый файл если есть
  if (rows[0].photo_path) {
    await fs.promises.unlink(rows[0].photo_path).catch(() => {}); // ignore if already gone
  }

  const newPath = await savePhoto(id, req.file);
  await pool.query('UPDATE contacts SET photo_path = $1, updated_at = NOW() WHERE id = $2', [newPath, id]);
  res.json({ photo_url: `/${newPath}` });
}
```

---

### D-04: Валидация account_id

**Decision**: Явная проверка `SELECT id FROM accounts WHERE id = $1` перед INSERT/UPDATE если account_id передан (не null/undefined).

**Rationale**: FK-нарушение в PostgreSQL возвращает код `23503` и без обработки даст 500. Явная 400-валидация с понятным сообщением — лучший UX и консистентно с F-03 (last-admin guard).

**Implementation Pattern**:
```js
async function validateAccountId(accountId) {
  if (!accountId) return; // null/undefined — OK, account_id optional
  const { rows } = await pool.query('SELECT id FROM accounts WHERE id = $1', [accountId]);
  if (!rows[0]) throw Object.assign(new Error('Account not found'), { status: 400, message: 'Аккаунт не найден' });
}
```

Вызывается в `createContact` и `updateContact` перед основным запросом.

**Alternatives considered**:
- Поймать PG error code 23503 в catch и вернуть 400 — работает, но хрупко (зависит от DB-специфичных кодов)

---

### D-05: Поиск по нескольким полям (multi-field ILIKE)

**Decision**: `WHERE ($1 = '' OR (first_name ILIKE '%' || $1 || '%' OR last_name ILIKE '%' || $1 || '%' OR email ILIKE '%' || $1 || '%'))` — один параметр, три ILIKE через OR.

**Rationale**: Простой одно-параметровый поиск — пользователь не выбирает поле, поиск по любому из трёх.

**Implementation Pattern**:
```sql
SELECT c.* FROM contacts c
WHERE ($1 = '' OR (
  c.first_name ILIKE '%' || $1 || '%' OR
  c.last_name  ILIKE '%' || $1 || '%' OR
  c.email      ILIKE '%' || $1 || '%'
))
ORDER BY c.created_at DESC
LIMIT $2 OFFSET $3
```

---

### D-06: Частичное обновление (Partial Update)

**Decision**: Идентичный D-01 паттерн из F-04 research.md — динамический SET-clause.

**Updatable fields**: `first_name`, `last_name`, `email`, `phone`, `position`, `account_id`

**Non-updatable**: `id`, `owner_id`, `photo_path` (управляется отдельно через /photo), `created_at`, `updated_at`

**Note**: `account_id` можно обнулить явно передав `null` в теле (отвязка от аккаунта).

```js
const UPDATABLE_FIELDS = ['first_name', 'last_name', 'email', 'phone', 'position', 'account_id'];
// ... идентично F-04 accountsController.js updateAccount
```

---

### D-07: Каскадное удаление контакта

**Decision**: При удалении контакта:
1. SELECT photo_path из contacts WHERE id = $1 (проверка существования + получение пути)
2. DELETE FROM contacts WHERE id = $1 (DB auto CASCADE: deal_contacts → удаляются)
3. Если photo_path был — удалить файл с диска через `fs.promises.unlink(path).catch(() => {})`

**Rationale**: deal_contacts удаляется через FK CASCADE автоматически на DB-уровне (проверено в migration: `onDelete: 'CASCADE'` на contact_id). Файл удаляется ПОСЛЕ удаления из БД: если unlink падает, данные уже удалены из БД (контакт удалён), orphaned файл приемлем для MVP.

**Alternatives considered**:
- Удалить файл перед DELETE из БД — риск: файл удалён, но DB-запрос падает; контакт остаётся без фото. Лучше удалять после успешного DELETE.

---

### D-08: GET /api/v1/accounts/:id/contacts — routing

**Decision**: Роут `GET /:id/contacts` добавляется в `server/routes/accounts.js` (монтирован на `/api/v1/accounts`). Контроллер `listContactsByAccount` живёт в `contactsController.js`.

**Rationale**: Избегает конфликтов монтирования. Логически: "контакты аккаунта" относятся к ресурсу accounts. Контроллер в contactsController — не в accountsController — поскольку возвращает contact-данные.

**Route ordering в accounts.js**: `router.get('/:id/contacts', ...)` должен регистрироваться ДО `router.get('/:id', ...)`, иначе Express перехватит "contacts" как :id параметр.

**Implementation**:
```js
// server/routes/accounts.js — добавить перед router.get('/:id', ...)
router.get('/:id/contacts', listContactsByAccount);
```
