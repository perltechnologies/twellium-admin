# API Spec: Transfer Document (PD code) for post-production transfers

**Audience:** backend developer
**Frontend repo:** twellium-admin
**Status:** frontend is already sending and reading the fields below. Nothing is stored or returned until the backend implements this spec.

---

## 1. Background

When pallets are transferred (Production → Staging Warehouse, or Staging → Main Warehouse) the user opens the Transfer Form page, which prints a **document number**, e.g. `PD2610170614`.

- Format: `PD` + `yyMMddHHmmss` (year, month, day, hour, minute, second), e.g. `PD261017061405`, generated in the browser. A fresh code is generated for **each transfer** (when the form opens, and again whenever a new transfer is started after one completes). The earlier 10-digit form `PD2610170614` may exist on paper forms printed before this change.
- It is printed on the paper form that the supervisors sign.
- **It is not stored anywhere**, so it cannot be looked up later, and it is not shown against the pallets it moved.

**Goal:** persist the PD code at transfer time, return it on pallet records, and make it searchable.

The backend has no "transfer" record today. A transfer is derived by the frontend from handling units (same creation date + product + PET line → Transfer ID such as `TR261017-RUSH-P02`). This spec adds the missing record for the signed document only; it does not change how transfer IDs work.

---

## 2. What the frontend already does

> **Rollout switch:** the frontend only sends the new fields when `REACT_APP_SAVE_TRANSFER_DOCUMENT=true` is set in its `.env` (default `false`), so transfers keep working before this ships. Flip it on once the backend is deployed. Even when enabled, if the scan request answers `400`, the frontend resends it without the new fields so a transfer is never blocked, and tells the user the document number was not saved. Backend note: validate the new fields with a `400` only for genuinely invalid values, and remember that this fallback hides the error from the user.

### 2.1 Request: `POST /inventory/handling-units/scan/`

The existing body is extended with four **optional** fields:

```json
{
  "scan_values": ["PAL-0001234", "PAL-0001235"],
  "target_stage": "STAGGING",

  "document_code": "PD2610170614",
  "transfer_id": "TR261017-RUSH-P02",
  "source_supervisor": 12,
  "target_supervisor": 15
}
```

| Field               | Type            | Required | Notes |
|---------------------|-----------------|----------|-------|
| `scan_values`       | string[]        | yes (existing) | Barcodes / RFID numbers. |
| `target_stage`      | string          | yes (existing) | `STAGGING` (sic) or `WAREHOUSE`. |
| `document_code`     | string, max 32  | no       | PD code printed on the form. **Must be unique per transfer** (see 3.2). |
| `transfer_id`       | string          | no       | Frontend-derived. When a form combines several groups it can hold several IDs, comma-separated (`TR…-P01, TR…-P02`). Informational only. |
| `source_supervisor` | integer (user id) | no     | Supervisor handing over (Production Supervisor, or Staging Supervisor for Staging → Main). |
| `target_supervisor` | integer (user id) | no     | Supervisor receiving. |

Requests that omit the new fields must behave exactly as today (other screens call this endpoint too).

### 2.2 Chunking: one PD code arrives in several requests

Large transfers are sent in **chunks of 100 `scan_values`**, one request per chunk, all carrying the **same** `document_code`. The backend must therefore:

- **upsert** on `document_code` within one transfer (create on first request, reuse afterwards), never fail or duplicate on the second chunk. The frontend also resends the same code when the user retries the pallets that failed in a partial transfer;
- attach each chunk's moved pallets to the same document.

### 2.3 Response (unchanged, plus optional echo)

The frontend currently reads `results[]` and flags a unit as failed if `success === false` or it has an `error` field. Keep that shape. Optionally echo the document:

```json
{
  "success": true,
  "data": {
    "results": [
      { "scan_value": "PAL-0001234", "success": true },
      { "scan_value": "PAL-0001235", "success": false, "error": "Not eligible for transfer from stage X" }
    ],
    "document_code": "PD2610170614"
  }
}
```

Only pallets whose move **succeeded** should be linked to the document.

---

## 3. What the backend must implement

### 3.1 Model: `TransferDocument`

| Field               | Type                  | Notes |
|---------------------|-----------------------|-------|
| `id`                | PK                    | |
| `document_code`     | varchar(32), **unique, indexed** | e.g. `PD2610170614` |
| `transfer_id`       | text, blank           | As sent by the frontend |
| `source_stage`      | varchar               | Stage the pallets left |
| `target_stage`      | varchar               | `STAGGING` / `WAREHOUSE` |
| `source_supervisor` | FK → User, null       | |
| `target_supervisor` | FK → User, null       | |
| `created_by`        | FK → User             | Authenticated user making the request |
| `created_at`        | datetime              | First request for this code |
| `updated_at`        | datetime              | |
| units               | M2M / through table to HandlingUnit | Pallets moved under this document |

Through table suggestion (`TransferDocumentUnit`): `document`, `handling_unit`, `from_stage`, `to_stage`, `moved_at`. A pallet can appear in two documents over its life (Production → Staging, then Staging → Main).

### 3.2 Behaviour on `scan/`

1. If `document_code` is absent → current behaviour, no document.
2. If present: validate format `^PD\d{10,16}$` (return `400` with a clear message if invalid; do not move any pallet).
3. Look up the `TransferDocument` by `document_code`:
   - **Not found** → create it.
   - **Found, same `target_stage`, created by the same user within the last 24 h** → treat as another chunk / a retry of the same transfer and reuse it.
   - **Found, anything else** (different `target_stage`, different user, or older than 24 h) → the code belongs to a different transfer. Return `409` with `{ "message": "Document code already used by another transfer" }` and **do not move any pallets**.
4. Move pallets as today. For each pallet that moved successfully, create the through-table row.
5. Do it in one database transaction per request so a document is never left pointing at pallets that did not move.

> **Uniqueness (required):** every transfer must end up with its own document code. The frontend generates `PD` + `yyMMddHHmmss` and, if it receives the `409` above on the first request, generates a new code with two extra random digits (`PD26101706140537`) and retries once. The `document_code` unique constraint in 3.1 is the final guarantee.
>
> **Preferred alternative:** generate the code on the server, so uniqueness never depends on the client clock. Add `POST /inventory/transfer-documents/next-code/` returning `{ "document_code": "PD…" }` (reserve it, e.g. as a `TransferDocument` row with no pallets yet). Tell the frontend team if you build this and the frontend will request the code when the form opens instead of generating it.

### 3.3 Return `document_code` on pallet records

Add **`document_code`** (string or `null`) to the serializers of:

- `GET /inventory/handling-units/` (list) and `GET /inventory/handling-units/{id}/`
- `GET /inventory/handling-units/stage-details/` (used by the Main Warehouse stock table)
- `GET /inventory/handling-units/lookup/`

Its value is **the document that moved the pallet into its current stage** (the latest through-table row whose `to_stage` equals the pallet's current stage), or `null` if none.

The frontend reads, in order: `document_code`, `transfer_document_code`, `transfer_document.document_code`. Any of these works; `document_code` is preferred.

Example handling-unit item:

```json
{
  "id": "6f0c…",
  "current_barcode": "PAL-0001234",
  "pet_sequence": 14,
  "current_status": "STAGGING",
  "product_name": "Rush 500ml",
  "pet_name": "PET 2",
  "quantity": 60,
  "created_at": "2026-10-17T05:12:44Z",
  "updated_at": "2026-10-17T06:14:09Z",
  "document_code": "PD2610170614"
}
```

### 3.3b Return `stamp_type` on pallet records (printed on the transfer form)

The transfer form now has a **Stamp Type** field. Add **`stamp_type`** (string, or `null`) to the same pallet serializers listed in 3.3 (`handling-units` list/detail, `stage-details`, `lookup`). The form prints the distinct values across the pallets on it, comma-separated, and leaves the field blank when none are returned. The frontend also accepts `stamp_type_name`, or `stamp_type: { "name": "…" }`.

Please confirm the source of the value (product, batch or production run) and the allowed values.

### 3.4 Search / filter

- `GET /inventory/handling-units/?document_code=PD2610170614` → pallets moved under that document (exact match, case-insensitive). Must work together with `page`, `page_size`, `ordering`.
- `GET /inventory/handling-units/stage-details/?stage=WAREHOUSE&search=PD2610170614` → the existing `search` should also match `document_code`.

### 3.5 Document endpoints

`GET /inventory/transfer-documents/` – paginated list; filters: `document_code`, `transfer_id`, `target_stage`, `created_after`, `created_before`.

`GET /inventory/transfer-documents/{document_code}/` – details:

```json
{
  "document_code": "PD2610170614",
  "transfer_id": "TR261017-RUSH-P02",
  "source_stage": "PRODUCTION",
  "target_stage": "STAGGING",
  "source_supervisor": { "id": 12, "name": "A. Mwangi" },
  "target_supervisor": { "id": 15, "name": "B. Otieno" },
  "created_by": { "id": 3, "name": "C. Kamau" },
  "created_at": "2026-10-17T06:14:09Z",
  "total_pallets": 24,
  "total_packs": 1440,
  "units": [
    { "id": "6f0c…", "current_barcode": "PAL-0001234", "pet_sequence": 14, "quantity": 60, "moved_at": "2026-10-17T06:14:09Z" }
  ]
}
```

`units` may be paginated or omitted when large; `total_pallets` / `total_packs` are required.

### 3.6 Activity log

Include `document_code` in the stage-change entry written to `GET /inventory/activity-logs/` for each moved pallet, so it appears in the pallet history.

### 3.7 Permissions

Same as the existing scan endpoint. Read endpoints: any authenticated user who can view handling units.

### 3.8 Migration / backfill

New table only. Existing pallets have `document_code = null`. No backfill is possible (the codes were never stored).

---

## 4. Error cases

| Case | Response |
|------|----------|
| `document_code` malformed | `400`, `{ "message": "document_code must look like PD261017061405" }` |
| Code already belongs to another transfer (different stage / user / older than 24 h) | `409`, `{ "message": "Document code already used by another transfer" }`, no pallets moved |
| Unknown `source_supervisor` / `target_supervisor` id | `400` with the field name; no pallets moved |
| Some pallets fail to move | `200` with per-unit `success: false` / `error` as today; only successful ones linked to the document |
| New fields omitted | Behaves as today |

---

## 5. Acceptance criteria

1. Scanning 250 pallets (3 requests of 100/100/50, same `document_code`) creates **one** `TransferDocument` linked to exactly the pallets that moved.
2. `GET /inventory/handling-units/?document_code=PD2610170614&page_size=100` returns those pallets and `document_code` is present on each item.
3. After Staging → Main, a pallet's `document_code` is the **Main** document; the earlier Staging document stays in its history and in `transfer-documents`.
4. Requests without the new fields work unchanged.
5. A failed pallet in a batch is not linked to the document.
6. Two different transfers can never share a `document_code`: reusing a code from another transfer returns `409` and moves nothing.
7. `GET /inventory/transfer-documents/PD2610170614/` returns supervisors, route, time and totals.
8. Main Warehouse stock (`stage-details`) items include `document_code`, and `search=PD…` finds them.

---

## 6. Frontend behaviour once this is live

No frontend change is needed for display. The PD code then shows:

- on the **Staging Warehouse** and **Main Warehouse** cards of the Transfer Execution page (`/post-production/transfer-execution`);
- in the **View details** modal (header + pallet table column);
- in the **Main Warehouse Stock** table of the Transfer Form page.

Follow-up frontend work after the backend ships: the "Find a transfer" box currently rejects `PD…` input ("PD codes are form document numbers and are not stored"). Once `?document_code=` or `transfer-documents/{code}/` exists, that input will be switched to query it.

Frontend code references: `src/pages/post-production/BatchPrintTransfer.jsx` (`handleCompleteTransfer`), `src/api/inventory.js` (`completeTransfer`), `src/utils/transferUtils.js` (`getDocumentCode`).
