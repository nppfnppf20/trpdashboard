# Quotes CRUD Implementation

## ✅ Completed - Backend Endpoints

### 1. CREATE Quote
**Endpoint:** `POST /api/admin-console/quotes`

**Request Body:**
```json
{
  "project_id": "uuid",
  "surveyor_organisation_id": "uuid",
  "contact_id": "uuid (optional)",
  "discipline": "Heritage",
  "total": 5000.00,
  "quote_notes": "optional notes",
  "date": "2026-01-16",
  "line_items": [
    {
      "item": "Desk-based Assessment",
      "description": "Research and assessment",
      "cost": 2500.00
    }
  ]
}
```

**Response:** `201 Created` - Returns complete quote with line items

**Features:**
- Transaction-based (ACID compliant)
- Auto-creates quote with line items
- Auto-fetches project_code from projects table
- Returns complete quote with all joins

---

### 2. UPDATE Instruction Status
**Endpoint:** `PATCH /api/admin-console/quotes/:id/instruction-status`

**Request Body:**
```json
{
  "instruction_status": "partially instructed",
  "selectedLineItems": [1, 3, 5]
}
```

**Response:** `200 OK` - Returns updated quote

**Features:**
- Supports: "pending", "instructed", "partially instructed", "will not be instructed"
- Auto-calculates `partially_instructed_total` when selected line items provided
- Transaction-based for data consistency

---

### 3. UPDATE Quote Notes
**Endpoint:** `PATCH /api/admin-console/quotes/:id/notes`

**Request Body:**
```json
{
  "quote_notes": "Updated notes text"
}
```

**Response:** `200 OK` - Returns updated quote

**Features:**
- Simple update of quote_notes field
- Auto-updates `updated_at` timestamp

---

### 4. DELETE Quote
**Endpoint:** `DELETE /api/admin-console/quotes/:id`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Quote deleted successfully",
  "id": 123
}
```

**Features:**
- Cascade deletes associated `quote_line_items` automatically
- Returns confirmation with deleted ID

---

## 📁 Files Modified

### Backend
- ✅ `backend/src/services/quotes.service.js`
  - Added `createQuote(data)`
  - Added `updateQuoteInstructionStatus(id, status, selectedLineItems)`
  - Added `updateQuoteNotes(id, notes)`
  - Added `deleteQuote(id)`

- ✅ `backend/src/controllers/quotes.controller.js`
  - Added `createQuote(req, res)`
  - Added `updateInstructionStatus(req, res)`
  - Added `updateQuoteNotes(req, res)`
  - Added `deleteQuote(req, res)`

- ✅ `backend/src/routes/quotes.routes.js`
  - Added `POST /` - Create quote
  - Added `PATCH /:id/instruction-status` - Update status
  - Added `PATCH /:id/notes` - Update notes
  - Added `DELETE /:id` - Delete quote

### Frontend
- ✅ `frontend/src/lib/api/quotes.js`
  - Added `createQuote(quoteData)`
  - Added `updateQuoteInstructionStatus(quoteId, status, selectedLineItems)`
  - Added `updateQuoteNotes(quoteId, notes)`
  - Added `deleteQuote(quoteId)`

---

## 🔗 Frontend Integration Points

### QuotesPanel Component
The following TODO comments can now be replaced with API calls:

1. **Line 71** - Save Notes
```javascript
// Replace this:
// TODO: Add API call when CRUD routes are implemented

// With:
import { updateQuoteNotes } from '$lib/api/quotes.js';
await updateQuoteNotes(selectedQuote.id, event.detail.notes);
```

2. **Status Change Handler**
```javascript
// In handleStatusChange or modal confirm handlers:
import { updateQuoteInstructionStatus } from '$lib/api/quotes.js';
await updateQuoteInstructionStatus(quoteId, newStatus, selectedLineItems);
```

3. **Delete Handler**
```javascript
// In handleDeleteQuoteEvent:
import { deleteQuote } from '$lib/api/quotes.js';
await deleteQuote(quote.id);
// Then remove from local quotes array
```

---

## 🧪 Testing

### Test CREATE Quote
```bash
curl -X POST http://localhost:8080/api/admin-console/quotes \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "YOUR_PROJECT_UUID",
    "surveyor_organisation_id": "YOUR_SURVEYOR_UUID",
    "discipline": "Heritage",
    "total": 5000,
    "line_items": [
      {"item": "Test Item", "description": "Test", "cost": 5000}
    ]
  }'
```

### Test UPDATE Instruction Status
```bash
curl -X PATCH http://localhost:8080/api/admin-console/quotes/1/instruction-status \
  -H "Content-Type: application/json" \
  -d '{"instruction_status": "instructed"}'
```

### Test UPDATE Notes
```bash
curl -X PATCH http://localhost:8080/api/admin-console/quotes/1/notes \
  -H "Content-Type: application/json" \
  -d '{"quote_notes": "Updated notes"}'
```

### Test DELETE Quote
```bash
curl -X DELETE http://localhost:8080/api/admin-console/quotes/1
```

---

## 🎯 Next Steps

### Frontend Wiring (To Do)
1. Wire up notes save handler in QuotesPanel
2. Wire up instruction status changes to API
3. Wire up delete confirmation to API
4. Add error handling and loading states
5. Add success notifications
6. Refresh data after mutations

### Future Enhancements
- Add bulk operations (delete multiple, update multiple)
- Add quote duplication endpoint
- Add quote history/audit trail
- Add file attachments to quotes

---

**Status:** ✅ Backend Complete - Ready for Frontend Integration
**Date:** 2026-01-16
