# Research: Вложения (Attachments)

**Feature**: F-08 | **Branch**: `008-attachments-crud` | **Date**: 2026-07-05

---

## D-01: multer diskStorage — путь и имя файла

**Decision**: `multer.diskStorage` с динамическим `destination` (создаёт папку при необходимости) и `filename` с UUID-префиксом. Паттерн из F-05 (фото контакта), обобщённый на entity_type.

**Pattern**:
```js
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const entityDir = ENTITY_DIRS[req.body.entity_type] || 'unknown';
    const entityId  = req.body.entity_id || 'unknown';
    const dir = path.join(__dirname, '../../uploads', entityDir, entityId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uuid = require('crypto').randomUUID();
    cb(null, `${uuid}_${file.originalname}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });
```

**Caveat**: При multipart/form-data поля body доступны в `destination` только если идут до файла в форме. При невалидном entity_type/entity_id файл сохранится во временную папку — контроллер должен удалить его (D-02).

**Alternatives considered**: Временный storage → перемещение после валидации — избыточно для MVP с 4 пользователями.

---

## D-02: Rollback файла при ошибке валидации

**Decision**: После multer-upload — валидировать entity_type и entity_id. При ошибке — удалять файл синхронно (`fs.unlinkSync`) до возврата ответа.

**Pattern**:
```js
async function createAttachment(req, res) {
  if (!req.file) return res.status(400).json({ error: 'Bad Request', message: 'Файл обязателен' });

  const entity_type = req.body.entity_type;
  const entity_id   = req.body.entity_id;

  if (!VALID_ENTITY_TYPES.includes(entity_type)) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Bad Request', message: 'Невалидный entity_type' });
  }
  if (!entity_id) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Bad Request', message: 'entity_id обязателен' });
  }

  const table = ENTITY_TABLES[entity_type];
  const { rows: ent } = await pool.query(`SELECT id FROM ${table} WHERE id=$1`, [entity_id]);
  if (!ent[0]) {
    fs.unlinkSync(req.file.path);
    return res.status(404).json({ error: 'Not Found' });
  }
  // ... INSERT в БД
}
```

**Rationale**: Максимальная простота (нет переноса файлов). Rollback надёжен: файл всегда существует при входе в контроллер — multer успешно загрузил его.

---

## D-03: Upload — сохранение в БД и формат ответа

**Decision**: После успешного multer + валидации — INSERT в attachments, возвращаем 201 без поля file_path (clarification Q1).

**file_path в БД**: Относительный путь от корня проекта, например `uploads/accounts/{id}/uuid_file.pdf`. Это позволяет формировать абсолютный путь при download через `path.join(__dirname, '../../', att.file_path)`.

**Pattern**:
```js
const relPath = path.relative(
  path.join(__dirname, '../../'),
  req.file.path
);
const { rows: [att] } = await pool.query(
  `INSERT INTO attachments (entity_type, entity_id, file_name, file_path, file_size, mime_type, uploaded_by)
   VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
  [entity_type, entity_id, req.file.originalname, relPath,
   req.file.size, req.file.mimetype, req.user.id]
);

// Ответ без file_path:
const { rows: [uploader] } = await pool.query('SELECT name FROM users WHERE id=$1', [req.user.id]);
return res.status(201).json({
  id: att.id, file_name: att.file_name, file_size: att.file_size, mime_type: att.mime_type,
  entity_type: att.entity_type, entity_id: att.entity_id,
  uploaded_by: { id: req.user.id, name: req.user.name },
  created_at: att.created_at,
});
```

**Note**: `req.user.name` доступен из deserializeUser (аналогично F-07).

---

## D-04: Download — res.download() с явным Content-Type

**Decision**: `res.download(filePath, att.file_name)` после проверки существования записи и файла. Content-Type устанавливается из `att.mime_type`.

**Pattern**:
```js
async function downloadAttachment(req, res) {
  const { id } = req.params;
  const { rows: [att] } = await pool.query('SELECT * FROM attachments WHERE id=$1', [id]);
  if (!att) return res.status(404).json({ error: 'Not Found' });

  const filePath = path.join(__dirname, '../../', att.file_path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not Found' });

  res.setHeader('Content-Type', att.mime_type || 'application/octet-stream');
  res.download(filePath, att.file_name, (err) => {
    if (err && !res.headersSent)
      res.status(500).json({ error: 'Internal Server Error', message: 'Ошибка при отправке файла' });
  });
}
```

**Note**: `res.download()` устанавливает `Content-Disposition: attachment; filename="..."` автоматически. Явный Content-Type важен для корректного отображения в браузере.

---

## D-05: Admin delete — fs.unlink + DELETE FROM DB

**Decision**: Сначала удаляем запись из БД, затем файл с диска. Если файл отсутствует — не блокируем операцию (idempotent cleanup).

**Pattern**:
```js
async function deleteAttachment(req, res) {
  const { id } = req.params;
  const { rows: [att] } = await pool.query('SELECT * FROM attachments WHERE id=$1', [id]);
  if (!att) return res.status(404).json({ error: 'Not Found' });

  await pool.query('DELETE FROM attachments WHERE id=$1', [id]);

  const filePath = path.join(__dirname, '../../', att.file_path);
  try { fs.unlinkSync(filePath); } catch (e) { /* файл уже отсутствует — ok */ }

  return res.status(204).send();
}
```

**Порядок**: DB delete первым — если fs.unlink упадёт, запись уже удалена, файл станет orphaned (приемлемо для MVP). Обратный порядок хуже: файл удалён, БД упала — запись-призрак.

---

## D-06: Каскадное удаление вложений при удалении родителя

**Decision**: Модифицировать `deleteAccount`, `deleteContact`, `deleteDeal` — добавить удаление файлов и записей attachments ПЕРЕД удалением сущности.

**Pattern** (добавить в accountsController.js, contactsController.js, dealsController.js):
```js
// Удалить физические файлы вложений
const { rows: attachments } = await pool.query(
  'SELECT file_path FROM attachments WHERE entity_type=$1 AND entity_id=$2',
  ['account', id]  // 'contact' / 'deal' соответственно
);
for (const att of attachments) {
  try { fs.unlinkSync(path.join(__dirname, '../../', att.file_path)); } catch (e) {}
}
await pool.query('DELETE FROM attachments WHERE entity_type=$1 AND entity_id=$2', ['account', id]);
// Затем: DELETE FROM notes, DELETE FROM activities, DELETE FROM <entity>
```

**Важно**: Это модификация существующих контроллеров F-04/F-05/F-06. F-07 (notes) добавлял только DB-delete; attachments требует ещё и fs.unlink.

---

## D-07: listAttachmentsForEntity — factory function

**Decision**: `listAttachmentsForEntity(entityType)` — аналог `listNotesForEntity` из F-07. Реиспользуется в accounts/contacts/deals роутерах. Явный маппинг полей (без file_path).

**Pattern**:
```js
function listAttachmentsForEntity(entityType) {
  return async function(req, res) {
    const entityId = req.params.id;
    const table = ENTITY_TABLES[entityType];

    const { rows: ent } = await pool.query(`SELECT id FROM ${table} WHERE id=$1`, [entityId]);
    if (!ent[0]) return res.status(404).json({ error: 'Not Found' });

    const { rows } = await pool.query(
      `SELECT a.id, a.file_name, a.file_size, a.mime_type,
              a.entity_type, a.entity_id, a.created_at,
              u.id AS uploader_id, u.name AS uploader_name
       FROM attachments a
       JOIN users u ON a.uploaded_by = u.id
       WHERE a.entity_type=$1 AND a.entity_id=$2
       ORDER BY a.created_at DESC`,
      [entityType, entityId]
    );

    return res.json(rows.map(r => ({
      id: r.id, file_name: r.file_name, file_size: r.file_size, mime_type: r.mime_type,
      entity_type: r.entity_type, entity_id: r.entity_id,
      uploaded_by: { id: r.uploader_id, name: r.uploader_name },
      created_at: r.created_at,
    })));
  };
}
```

---

## D-08: Порядок маршрутов в роутерах

**Decision**: `/:id/attachments` регистрируется ПЕРЕД `/:id` (аналог F-07 notes).

**Pattern**:
```js
// В accounts.js, contacts.js, deals.js:
router.get('/:id/attachments', listAttachmentsForEntity('account')); // BEFORE /:id
router.get('/:id', getAccountById);
```

---

## D-09: Константы контроллера

```js
const VALID_ENTITY_TYPES = ['account', 'contact', 'deal'];
const ENTITY_TABLES      = { account: 'accounts', contact: 'contacts', deal: 'deals' };
const ENTITY_DIRS        = { account: 'accounts', contact: 'contacts', deal: 'deals' };
// Лимит размера: 50 * 1024 * 1024 = 52428800 bytes
```

---

## D-10: multer 413 при превышении размера

**Decision**: multer автоматически выбрасывает `MulterError` с кодом `LIMIT_FILE_SIZE` при превышении `limits.fileSize`. Обрабатывать в обёртке над upload middleware (аналог F-05).

**Pattern**:
```js
router.post('/', requireRole(['admin', 'bdm']), (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE')
        return res.status(413).json({ error: 'Payload Too Large', message: 'Файл не должен превышать 50 MB' });
      return next(err);
    }
    createAttachment(req, res, next);
  });
});
```

Поле формы для файла: **`file`** (стандартное имя для multer single upload).
