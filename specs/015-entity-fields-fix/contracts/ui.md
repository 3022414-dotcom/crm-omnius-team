# UI Contracts: Entity Field Fixes — F-15

## DealDetailPage.jsx — полный новый порядок полей в leftPanel

```jsx
// Константы
const OUR_SERVICES = ['Workshop', 'Webinar', 'Consulting', 'POC', 'Development', 'Accelerator', 'Performance']

// Запрос пользователей (аналог AccountDetailPage)
const { data: usersData } = useQuery({
  queryKey: ['users'],
  queryFn: getUsers,
  enabled: canWrite,
})
const allUsers = Array.isArray(usersData) ? usersData : (usersData?.data ?? [])
const userLabel = (u) => u.name || u.email || u.id

// leftPanel — новый порядок:
<InlineField label="Deal Name" ... />               // 1
<InlineField label="Stage" ... />                   // 2
<InlineField label="Account" ... />                 // 3
<InlineField label="Location" ... />                // 4
<InlineField label="Deal Type" ... />               // 5
<InlineField label="Source" ... />                  // 6
<InlineField label="Project Domain" ... />          // 7
<InlineField label="Description" ... />             // 8
<InlineMultiSelect label="Our Services" options={OUR_SERVICES} ... />  // 9
<InlineField label="Amount"
  value={deal.value != null ? formatAmount(deal.value) : null}
  type="text" readOnly={!canWrite}
  onSave={(val) => save({ value: val ? Number(String(val).replace(/[\s ]/g, '')) : null })} />  // 10
{/* value показывает форматированное число (5 000 000); onSave стрипает пробелы перед сохранением */}
<InlineField label="Currency" ... />                // 11
<InlineField label="Storage URL" ... />             // 12
<InlineField label="Deal Owner"                     // 13
  value={deal.owner_id ?? ''}
  displayValue={deal.owner?.name ?? '—'}
  type="select"
  optionObjects={[{ value: '', label: '—' }, ...allUsers.map((u) => ({ value: u.id, label: userLabel(u) }))]}
  readOnly={!canWrite}
  onSave={(val) => save({ owner_id: val || null })} />
<InlineField label="Created By"                     // 14
  value={deal.created_by?.name ?? '—'}
  type="text" readOnly={true} />
<InlineField label="Created Date"                   // 15
  value={deal.created_at ? formatDate(deal.created_at) : '—'}
  type="text" readOnly={true} />
<InlineField label="Expected Start Date" ... />     // 16
<InlineField label="Close Date" ... />              // 17
{deal.stage === 'lost' && <InlineField label="Lost Reason" ... />}  // 18 (conditional)
```

**Imports to add to DealDetailPage.jsx**:
```js
import { getUsers } from '../../api/users'
import { formatDate, formatAmount } from '../../lib/date'
```

---

## AccountDetailPage.jsx — добавить Created By (read-only)

Добавить ПОСЛЕ поля Account Manager:

```jsx
<InlineField
  label="Created By"
  value={account.created_by?.name ?? '—'}
  type="text"
  readOnly={true}
/>
```

**Note**: `getUsers` уже импортирован. `account.created_by` будет доступен после обновления backend.

---

## ContactDetailPage.jsx — добавить Created By (read-only)

Добавить в конец leftPanel (после "Comments"):

```jsx
<InlineField
  label="Created By"
  value={contact.created_by?.name ?? '—'}
  type="text"
  readOnly={true}
/>
```

---

## date.js — изменение formatAmount

```js
// было
export function formatAmount(amount) {
  if (amount == null) return '—'
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(amount)
}

// стало
export function formatAmount(amount) {
  if (amount == null) return '—'
  return new Intl.NumberFormat('ru-RU', { style: 'decimal', maximumFractionDigits: 0 }).format(amount)
}
```

**Результат**: `5000000` → `"5 000 000"` (неразрывный пробел как разделитель тысяч в `ru-RU`).
