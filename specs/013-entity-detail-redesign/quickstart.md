# Quickstart: Entity Detail Page Redesign

**Feature**: F-13 | Manual browser test scenarios

Prerequisites: App running, logged in as admin (Julia or Dmitry), at least 1 Account, 1 Contact, and 1 Deal in the database.

---

## Scenario 1: Navigate to Account Detail Page

1. Go to `/accounts`
2. Click on any account row in the list
3. **Expected**: Browser navigates to `/accounts/:id`
4. **Expected**: Left panel shows all Account fields with English labels
5. **Expected**: Right panel shows tabs: Contacts, Deals, Notes, Attachments, Activities
6. **Expected**: URL in browser address bar is `/accounts/:id` (shareable link)
7. Click "← Back" or breadcrumb
8. **Expected**: Returns to `/accounts` list

---

## Scenario 2: Navigate to Contact Detail Page

1. Go to `/contacts`
2. Click on any contact row
3. **Expected**: Browser navigates to `/contacts/:id`
4. **Expected**: Left panel shows avatar area (photo or initials placeholder) + all Contact fields
5. **Expected**: Right panel shows tabs: Deals, Notes, Attachments, Activities

---

## Scenario 3: Navigate to Deal Detail Page

1. Go to `/deals`
2. Click on any deal row
3. **Expected**: Browser navigates to `/deals/:id`
4. **Expected**: Left panel shows all Deal fields including Stage, Value, Currency
5. **Expected**: Right panel shows tabs: Contacts, Notes, Attachments, Activities

---

## Scenario 4: Inline Edit — Text Field

1. Open any Account detail page (`/accounts/:id`)
2. Click on the "Industry" field value (or its placeholder if empty)
3. **Expected**: A `<select>` dropdown appears with valid industry options
4. Select a different industry
5. **Expected**: Field immediately returns to read-mode showing a spinner
6. Wait 1-2 seconds
7. **Expected**: Spinner disappears, new industry value is displayed
8. Reload the page
9. **Expected**: The new industry value persists

---

## Scenario 5: Inline Edit — Cancel with Escape

1. Open any Contact detail page
2. Click on "Position" field
3. Change the text to something new
4. Press **Escape**
5. **Expected**: Original value is restored, no API request was made
6. Verify by checking Network tab in DevTools — no PATCH request sent

---

## Scenario 6: Inline Edit — Required Field Validation

1. Open any Account detail page
2. Click on "Name" field
3. Clear the text completely
4. Press **Enter** or click away
5. **Expected**: Inline error message: "Name is required" (or similar)
6. **Expected**: Original name value is restored
7. **Expected**: No PATCH request was sent

---

## Scenario 7: Inline Edit — Save Failure Recovery

1. Open any Contact detail page
2. Disconnect network (DevTools → Network → Offline)
3. Click on "Position" field, change value, press Enter
4. **Expected**: Spinner appears briefly, then original value is restored
5. **Expected**: Toast error notification appears
6. Reconnect network, retry the edit
7. **Expected**: This time it saves successfully

---

## Scenario 8: Viewer Cannot Edit

1. Log in as Ilya (viewer role)
2. Open any Account detail page
3. Click on any field value
4. **Expected**: Nothing happens — no editor appears
5. **Expected**: No "Edit" button visible on the page
6. **Expected**: All fields display their values in read-only mode

---

## Scenario 9: Contact Photo Upload

1. Log in as admin (Julia or Dmitry)
2. Open a Contact that has no photo (`/contacts/:id`)
3. **Expected**: Avatar area shows initials placeholder (e.g., "AK" for Anna Kovaleva)
4. Click the avatar area
5. **Expected**: File picker opens
6. Select a valid JPEG or PNG image under 5MB
7. **Expected**: Upload completes, new avatar photo appears immediately
8. Reload the page
9. **Expected**: Photo is still shown (persisted)

---

## Scenario 10: Contact Photo Delete

1. Open a Contact that has a photo
2. Click "Delete photo" button (visible near avatar for admin/bdm)
3. **Expected**: Avatar reverts to initials placeholder immediately
4. Reload page
5. **Expected**: Placeholder still shown (photo permanently deleted)

---

## Scenario 11: Contact Photo — Size Limit

1. Open any Contact detail page (as admin)
2. Click the avatar area
3. Select an image file larger than 5MB
4. **Expected**: Error message appears: file too large (rejected before upload)
5. **Expected**: No upload request sent, existing photo/placeholder unchanged

---

## Scenario 12: Deal Stage → Lost with Lost Reason

1. Open any Deal detail page
2. Click the "Stage" field
3. Select "lost" from the dropdown
4. **Expected**: Stage saves to "lost"
5. **Expected**: "Lost Reason" field appears / becomes editable in the left panel
6. Click on "Lost Reason" and enter a reason
7. **Expected**: Lost reason saves successfully

---

## Scenario 13: Right Panel Tab Switching

1. Open any Account detail page with contacts and deals
2. Right panel is on "Contacts" tab by default
3. Click "Deals" tab
4. **Expected**: Deals list loads in right panel
5. **Expected**: Left panel fields are unchanged (did not reload)
6. Click "Notes" tab
7. **Expected**: Notes content loads; left panel still unchanged

---

## Scenario 14: No Edit Modal Button

1. Open any Account/Contact/Deal detail page
2. **Expected**: No "Edit" button opening a full modal dialog
3. Verify that the old Edit+Modal flow is no longer present
4. Verify "New Account" / "New Contact" / "New Deal" buttons still work for creation
