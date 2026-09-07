# Sign-Off Forms — Definitive API Specification

**Audience:** Backend / API developer
**Status:** This spec is the **single source of truth**. The endpoint defined here must return
**every field** the three sign-off forms render, so the forms are populated entirely from one
API call with **no secondary requests and no client-side guessing**.

**Endpoint (one call fulfills all three forms):**
```
GET /production/dashboard/production_summary/
```

**Query parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `start_date` | YYYY-MM-DD | Yes | Start of date range |
| `end_date`   | YYYY-MM-DD | Yes | End of date range |
| `pet`        | integer | No | Filter by pet (line) ID |
| `shift`      | integer | No | Filter by shift ID |
| `product`    | string  | No | Filter by product name |

**Envelope:** keep `{ "status_code", "message", "data": { ... } }`. Do **not** change nesting depth.
All sections below live under `data`.

**Global conventions (must be honored so the frontend never has to fall back):**
1. Return **numbers as numbers**, not strings (`syrup_liters: 10000.0`, not `"10000.00"`).
2. Provide a **numeric** `bottles_per_pack` (e.g. `12`). Keep any display string separately as `package_type` (e.g. `"350 x 12"`).
3. Use `total_downtime_minutes` (with an `s`, **`_minutes`** not `_mins`) at summary and pet level. Keep `planned_downtime_mins` / `mechanical_downtime_mins` as-is (forms read those names).
4. Every per-line construct (`meters_reading`, `batches`, CO2/Syrup) must respect the `pet` and `shift` filters.
5. All percentages are 0–100. Durations in minutes unless the field ends in `_hrs`.
6. Any field the forms read must be present (use `null`/`0`/`[]` when genuinely unavailable, never omit keys the forms depend on).

---

## Forms & Routes

| # | Route | Component | Purpose |
|---|-------|-----------|---------|
| 1 | `/dashboard/sign-off-forms/production-report` | `ProductionReportForm.jsx` | Daily/range production sign-off |
| 2 | `/dashboard/sign-off-forms/product-report`    | `ProductionRunByPet.jsx`    | FP-DR-008-Rev.A per-line run |
| 3 | `/dashboard/sign-off-forms/batch-report`      | `BatchReport.jsx`           | Batch report by product & line |

---

## 1. `data.summary` — Canonical Field List

Every field below is read by at least one form. **All must be returned.**

| Field | Type | Used by | Form label / use |
|-------|------|---------|------------------|
| `total_bottles_produced` | int | 1,2 | Total Output (R.W); Total Units |
| `total_bottles` | float | 1,2 | Production-by-line TOTAL; Total Units |
| `total_output` | float | 1 | alias accepted for output; return = `total_bottles` |
| `total_packs` | int | 1,2 | Total Packs |
| `total_physical_boxes` | int | 2 | Physical boxes |
| `total_pallets` | int | 1 | Pallet totals |
| `single_packs` | int | 1 | Single Packs |
| `bottles_per_pack` | int (numeric) | 1,2 | Bottles/Pack (numeric — see convention #2) |
| `package_type` | string | — | display only (e.g. "350 x 12") |
| `packs_per_pallet` | int | 1,2 | Packs/Pallet |
| `bottle_size` | string | 1,2 | Bottle Size (e.g. "0.35L" / "350 ml") |
| `line_speed` | int | 1,2 | Line Speed / BPH |
| `total_bottles_per_hr` | int | 2 | Total Btls/Hr = `total_bottles / total_production_time_hrs` |
| `oee` | float | 1 | OEE |
| `avg_availability` | float | 1 | Availability |
| `avg_performance` | float | 1 | Performance (Efficiency) |
| `avg_quality` | float | 1 | Quality |
| `avg_efficiency` | float | 2 | Efficiency |
| `avg_syrup_yield` | float | 1,2 | Syrup Yield / Yield |
| `avg_co2_yield` | float | 1 | CO2 Yield |
| `target_met_count` | int | 1 | Target Met |
| `total_downtime_minutes` | float | 1,2 | Total Downtime / Cumulative Stoppage (see convention #3) |
| `planned_downtime_mins` | float | 1,2 | Planned Downtime |
| `mechanical_downtime_mins` | float | 1,2 | Mechanical Downtime |
| `total_production_time_hrs` | float | 1,2 | Total Production Hrs |
| `total_production_time_hours` | float | 1 | alias accepted — return same as `_hrs` |
| `production_start_time` | string | 1,2 | Start Up Production (HH:MM or ISO) |
| `production_end_time` | string | 1,2 | Shut Down Production |
| `total_syrup_liters` | float | 2 | Syrup (Lts) total |
| `total_beverage_liters` | float | 2 | Bev (Lts) total; CO2 g/l calc |
| `worker_count` | int | 1,2,3 | Workers Count / Workers footer |
| `workers_count` | int | 1 | alias accepted |
| `total_active_workers` | int | 1 | alias accepted |
| `total_reports` | int | 1,2 | report count / hrs estimate |
| `total_stoppage_reports` | int | 1 | stoppage reports |
| `batch_numbers` | string[] | 2,3 | keep for compatibility |
| `batch_number` | string | 2 | joined string, keep for compatibility |
| `batches` | object[] | 1,2,3 | **see §5 — required with quantities** |

---

## 2. `data.daily_breakdown[]`

Array of days. Each day:

| Field | Type | Notes |
|-------|------|-------|
| `date` | string (YYYY-MM-DD) | day date |
| `report_count` | int | |
| `stoppage_report_count` | int | |
| day-level aggregates | — | same shape as summary (optional) |
| `pets` | object[] | **required — see §3** |

---

## 3. `data.daily_breakdown[].pets[]` — Per-Line Object (Canonical)

The forms iterate pets heavily (product filtering, per-line rows, per-product breakdowns).
**All fields below must be present per pet.**

| Field | Type | Used by | Notes |
|-------|------|---------|-------|
| `pet_id` | int | 1,2 | |
| `pet_name` | string | 1,2,3 | exclude "CAN" lines are filtered client-side |
| `product_name` | string | 1,2,3 | |
| `shift` | string | 1 | "DAY" / "NIGHT" |
| `status` | string | 1 | Started / Completed |
| `total_bottles` | float | 1,2 | |
| `total_units` | float | 2 | alias for total_bottles if used |
| `total_bottles_produced` | int | 1,2 | |
| `total_output` | float | 1 | alias accepted |
| `total_packs` | int | 1,2 | |
| `total_physical_boxes` | int | 2 | |
| `physical_boxes` | int | 2 | alias accepted |
| `bottle_size` | string | 2 | |
| `bottles_per_pack` | int | 1,2 | numeric |
| `packs_per_pallet` | int | 1,2 | |
| `single_packs` | int | 1 | |
| `total_pallets` | int | 1 | |
| `line_speed` | int | 2 | |
| `oee` | float | 1 | |
| `availability` | float | 1 | |
| `performance` | float | 1 | |
| `quality` | float | 1 | |
| `efficiency` | float | 1,2 | |
| `avg_efficiency` | float | 2 | alias accepted |
| `syrup_yield` | float | 1,2 | |
| `avg_syrup_yield` | float | 2 | alias accepted |
| `co2_yield` | float | 1 | |
| `planned_downtime_mins` | float | 1 | |
| `mechanical_downtime_mins` | float | 1 | |
| `total_downtime_minutes` | float | 1,2 | |
| `total_production_time_hrs` | float | 1,2 | |
| `production_start_time` | string | 1,2 | |
| `production_end_time` | string | 1,2 | |
| `beverage_liters` | float | 2 | per-line beverage |
| `total_stoppage_reports_submitted` | int | 1 | |
| `total_production_reports_submitted` | int | 1 | |
| `batch_numbers` | string[] | 2 | |
| `batches` | object[] | 1,2,3 | **§5** |
| `workers` | object | 1,2 | **§3.1** |
| `meters_reading` | object | 2 | **§3.2** |
| `material_consumptions` | object[] | 1,2 | per-pet materials, same shape as §4 |
| `downtime_breakdown` | object | 2 | `{ categories: [{ category_name, total_duration_mins }] }` |

### 3.1 `pets[].workers`

| Field | Type | Used by | Notes |
|-------|------|---------|-------|
| `worker_count` | int | 1,2 | Workers Count |
| `total_active_workers` | int | 1 | Workers Count (preferred) |
| `paid_hours` | float | 2 | Paid Hours (overtime) |
| `overtime_hours` | float | 2 | overtime |
| `absent_worker_names` | string[] | 2 | Name Of Absent Labours |
| `worker_names` | string[] | 2 | Working Labours On Line |

### 3.2 `pets[].meters_reading`

Same structure as top-level §6, but scoped to this line. The Product Report specifically reads:
- `meters_reading.syrup.total_syrup_used_l`
- `meters_reading.beverage.total_beverage_liters`

---

## 4. `data.material_consumptions`

```json
"material_consumptions": {
  "materials": [ { ...material object... } ],
  "summary": { "best_pet": {...}, "worst_pet": {...}, "overall_yield": 97.1 }
}
```

Also provide per-pet materials at `daily_breakdown[].pets[].material_consumptions` (array of the same object).

### Material object — **all fields required**

| Field | Type | Used by | Notes |
|-------|------|---------|-------|
| `material_type` | string | 1,2 | see enum below |
| `material_type_display` | string | 1,2 | display label |
| `unit` | string | 1,2 | Pcs / Kg / etc. |
| `expected_usage` | float | 2 | Expected to be use |
| `received` | float | 2 | Received (also accept `total_received`) |
| `total_used` | float | 1,2 | Used |
| `returned` | float | 2 | Returned (also accept `total_returned`) |
| `total_losses` | float | 1,2 | Losses |
| `yield_percentage` | float | 1 | `((used − losses)/used)×100` |
| `pets` | object[] | 1 | `{ pet_id, pet_name, used, losses, yield_percentage }` |

**`material_type` enum (all must be emitted when applicable):**
`PREFORMS, CLOSURES, LABELS, SHRINK, STRETCH_FILM, CARTON_LAYER, CARTON_BOXES, GLUE`

Calc: `received = expected_usage + total_losses`; `used = received − returned`.

---

## 5. `batches[]` — Per-Batch Objects (REQUIRED; unblocks all 3 forms)

Present at **both** `data.summary.batches[]` and `data.daily_breakdown[].pets[].batches[]`.
Today only `batch_numbers` (strings) are returned; per-batch quantities are missing and must be added.

```json
"batches": [
  {
    "batch_number": "558",
    "tank_number": "stoo2",
    "syrup_liters": 10000.0,
    "beverage_liters": 60000.0,
    "start_time": "00:00:00",
    "date": "2026-09-04",
    "pet_id": 11,
    "pet_name": "Pet 1",
    "product_name": "Rush Energy Drink",
    "shift": "NIGHT"
  }
]
```

| Field | Type | Req | Used by | Notes |
|-------|------|-----|---------|-------|
| `batch_number` | string | Yes | 1,2,3 | |
| `tank_number` | string | No | 3 | |
| `syrup_liters` | float | Yes | 2,3 | numeric (not string) |
| `beverage_liters` | float | Yes | 2 | if unknown, `syrup_liters × dilution_total_parts` |
| `start_time` | string HH:MM:SS | Yes | 2,3 | Time / Start Time columns |
| `date` | string YYYY-MM-DD | Yes | 3 | Date column |
| `pet_id` | int | Yes | 2,3 | |
| `pet_name` | string | Yes | 2,3 | Pet column |
| `product_name` | string | Yes | 3 | grouping |
| `shift` | string | No | filtering | |

> With this in place, **Batch Report and Product Report no longer need the `/production/reports` list call.**

---

## 6. `meters_reading` (top-level; per-line when `pet` set) + `pets[].meters_reading`

### 6.1 `meters_reading.co2` — all fields required

| Field | Type | Used by | Notes |
|-------|------|---------|-------|
| `start_reading_kg` | float | 1,2 | Start up Reading (Kg) |
| `end_reading_kg` | float | 1,2 | End up Reading (Kg) |
| `difference_in_balance` | float | 2 | Difference in Balance (accept `difference_in_balance_kg`) |
| `total_co2_consumed_kg` | float | 1,2 | Total CO2 Consumed |
| `std_co2_consumption_kg` | float | 1 | Std. CO2 Consumption |
| `co2_yield_percent` | float | 1 | CO2 Yield |
| `co2_g_per_liter` | float | 2 | CO2 g/l (accept `co2_grams_per_liter`) |
| `co2_g_per_bottle` | float | 2 | CO2 g/Btl (accept `co2_grams_per_bottle`) |
| `co2_grams_per_bottle` | float | 1 | Std CO2 calc (accept `std_co2_per_bottle_g`) |
| `combi_reading` | int | 2 | Combi Reading (accept here or in `production`) |

### 6.2 `meters_reading.syrup` — all fields required

| Field | Type | Notes |
|-------|------|-------|
| `start_reading` | float | Start up Reading |
| `end_reading` | float | End up Reading |
| `difference` | float | End − Start |
| `unit` | string | L / m3 / kg |
| `syrup_density_kg_per_l` | float | |
| `total_syrup_used_l` | float | Total Syrup Used |
| `syrup_dilution_ratio` | string | e.g. "1:5" |
| `dr_sum` | float | dilution total parts (e.g. 6) — used for Bev calc |
| `std_syrup_consumption_l` | float | |
| `syrup_yield_percent` | float | |

> **Dilution note:** `syrup_dilution_ratio` like `"1:5"` cannot be `parseFloat`'d directly.
> Provide `dr_sum` (total parts, e.g. 6 for 1:5) so beverage liters compute correctly.

### 6.3 `meters_reading.production` — all fields required

| Field | Type | Notes |
|-------|------|-------|
| `filler_reading` | int | Filler Reading |
| `combi_reading` | int | Combi Reading (alias of filler) |
| `shrink_reading` | int | Shrink Reading |
| `filler_rejects_mc` | int | Filler Rejects (M/C) |
| `blower_rejects_manual` | int | Blower Rejects (Manual) |
| `shrink_reading_packs_percent` | float | Shrink Reading / T. Packs (%) |

---

## 7. `data.downtime_breakdown` (Form 1) + `pets[].downtime_breakdown` (Form 2)

```json
"downtime_breakdown": {
  "total_downtime_minutes": 847,
  "total_incidents": 42,
  "categories": [
    {
      "category_id": 1, "category_name": "Mechanical Downtime",
      "total_duration_mins": 512, "percentage_of_total": 60.4,
      "incident_count": 24, "color": "#ef4444",
      "sub_categories": [
        { "sub_category_id": 101, "sub_category_name": "Filler Machine Jam",
          "total_duration_mins": 180, "incident_count": 8,
          "percentage_of_category": 35.2, "avg_duration_mins": 22.5,
          "pets_affected": [ { "pet_id": 11, "pet_name": "Pet 1", "duration_mins": 45, "count": 2 } ] }
      ]
    }
  ]
}
```

Form 2 reads `pets[].downtime_breakdown.categories[].{category_name, total_duration_mins}` and
buckets into Planned / Mechanical by matching the category name (contains "planned"/"mechanical").
`total_downtime_minutes` must be present here (note the `_minutes` spelling).

---

## 8. Complete Example Response

Representative payload for `?start_date=2026-09-04&end_date=2026-09-04&pet=11&shift=11`.
Numbers illustrative; **shapes are authoritative**.

```json
{
  "status_code": 200,
  "message": "Success",
  "data": {
    "filters": { "start_date": "2026-09-04", "end_date": "2026-09-04", "pet_id": 11, "shift_id": 11 },

    "summary": {
      "total_bottles_produced": 190080,
      "total_bottles": 197746.0,
      "total_output": 197746.0,
      "total_packs": 15840,
      "total_physical_boxes": 15840,
      "total_pallets": 66,
      "single_packs": 0,
      "bottles_per_pack": 12,
      "package_type": "350 x 12",
      "packs_per_pallet": 240,
      "bottle_size": "0.35L",
      "line_speed": 22000,
      "total_bottles_per_hr": 19948,

      "oee": 82.4, "avg_availability": 91.2, "avg_performance": 88.7, "avg_quality": 99.8,
      "avg_efficiency": 82.4, "avg_syrup_yield": 96.2, "avg_co2_yield": 94.8, "target_met_count": 1,

      "total_downtime_minutes": 45, "planned_downtime_mins": 10, "mechanical_downtime_mins": 30,
      "total_production_time_hrs": 8.0, "total_production_time_hours": 8.0,
      "production_start_time": "18:00", "production_end_time": "06:00",

      "total_syrup_liters": 15500.0, "total_beverage_liters": 93000.0,
      "worker_count": 12, "workers_count": 12, "total_active_workers": 12,
      "total_reports": 1, "total_stoppage_reports": 3,

      "batch_numbers": ["558", "556"],
      "batch_number": "558, 556",
      "batches": [
        { "batch_number": "558", "tank_number": "stoo2", "syrup_liters": 10000.0, "beverage_liters": 60000.0, "start_time": "00:00:00", "date": "2026-09-04", "pet_id": 11, "pet_name": "Pet 1", "product_name": "Rush Energy Drink", "shift": "NIGHT" },
        { "batch_number": "556", "tank_number": "stoo3", "syrup_liters": 5500.0,  "beverage_liters": 33000.0, "start_time": "18:00:00", "date": "2026-09-04", "pet_id": 11, "pet_name": "Pet 1", "product_name": "Rush Energy Drink", "shift": "NIGHT" }
      ]
    },

    "daily_breakdown": [
      {
        "date": "2026-09-04", "report_count": 1, "stoppage_report_count": 3,
        "pets": [
          {
            "pet_id": 11, "pet_name": "Pet 1", "product_name": "Rush Energy Drink",
            "shift": "NIGHT", "status": "Completed",
            "total_bottles": 197746.0, "total_units": 197746.0, "total_bottles_produced": 190080,
            "total_packs": 15840, "total_physical_boxes": 15840,
            "bottle_size": "0.35L", "bottles_per_pack": 12, "packs_per_pallet": 240,
            "single_packs": 0, "total_pallets": 66, "line_speed": 22000,
            "oee": 82.4, "availability": 91.2, "performance": 88.7, "quality": 99.8,
            "efficiency": 82.4, "syrup_yield": 96.2, "co2_yield": 94.8,
            "planned_downtime_mins": 10, "mechanical_downtime_mins": 30, "total_downtime_minutes": 45,
            "total_production_time_hrs": 8.0, "production_start_time": "18:00", "production_end_time": "06:00",
            "beverage_liters": 93000.0,
            "total_stoppage_reports_submitted": 3, "total_production_reports_submitted": 1,
            "batch_numbers": ["558", "556"],
            "batches": [
              { "batch_number": "558", "tank_number": "stoo2", "syrup_liters": 10000.0, "beverage_liters": 60000.0, "start_time": "00:00:00", "date": "2026-09-04", "pet_id": 11, "pet_name": "Pet 1", "product_name": "Rush Energy Drink", "shift": "NIGHT" },
              { "batch_number": "556", "tank_number": "stoo3", "syrup_liters": 5500.0,  "beverage_liters": 33000.0, "start_time": "18:00:00", "date": "2026-09-04", "pet_id": 11, "pet_name": "Pet 1", "product_name": "Rush Energy Drink", "shift": "NIGHT" }
            ],
            "workers": {
              "worker_count": 12, "total_active_workers": 12, "paid_hours": 96.0, "overtime_hours": 8.0,
              "worker_names": ["Kwame A.", "Ama B."], "absent_worker_names": []
            },
            "meters_reading": {
              "co2": { "start_reading_kg": 2699923.9, "end_reading_kg": 2704952.1, "difference_in_balance": 0,
                       "total_co2_consumed_kg": 5028.2, "std_co2_consumption_kg": 4800.0, "co2_yield_percent": 94.8,
                       "co2_g_per_liter": 7.74, "co2_g_per_bottle": 2.71, "co2_grams_per_bottle": 2.71, "combi_reading": 1862749 },
              "syrup": { "start_reading": 45050.0, "end_reading": 56854.0, "difference": 11804.0, "unit": "L",
                         "syrup_density_kg_per_l": 1.2, "total_syrup_used_l": 15500.0, "syrup_dilution_ratio": "1:5",
                         "dr_sum": 6.0, "std_syrup_consumption_l": 11535.18, "syrup_yield_percent": 96.2 },
              "beverage": { "total_beverage_liters": 93000.0 },
              "production": { "filler_reading": 1862749, "combi_reading": 1862749, "shrink_reading": 116586,
                              "filler_rejects_mc": 0, "blower_rejects_manual": 0, "shrink_reading_packs_percent": 99.2 }
            },
            "material_consumptions": [
              { "material_type": "PREFORMS", "material_type_display": "Preforms", "unit": "Pcs",
                "expected_usage": 190080, "received": 195000, "total_used": 195000, "returned": 0,
                "total_losses": 4920, "yield_percentage": 97.5 }
            ],
            "downtime_breakdown": {
              "total_downtime_minutes": 45,
              "categories": [
                { "category_name": "Planned Downtime", "total_duration_mins": 10 },
                { "category_name": "Mechanical Downtime", "total_duration_mins": 30 }
              ]
            }
          }
        ]
      }
    ],

    "material_consumptions": {
      "materials": [
        { "material_type": "PREFORMS", "material_type_display": "Preforms", "unit": "Pcs",
          "expected_usage": 190080, "received": 195000, "total_used": 195000, "returned": 0,
          "total_losses": 4920, "yield_percentage": 97.5,
          "pets": [ { "pet_id": 11, "pet_name": "Pet 1", "used": 195000, "losses": 4920, "yield_percentage": 97.5 } ] },
        { "material_type": "CLOSURES", "material_type_display": "Closures", "unit": "Pcs",
          "expected_usage": 190080, "received": 192000, "total_used": 192000, "returned": 0, "total_losses": 1920, "yield_percentage": 99.0, "pets": [] },
        { "material_type": "LABELS", "material_type_display": "Labels", "unit": "Kg",
          "expected_usage": 480, "received": 495, "total_used": 495, "returned": 0, "total_losses": 15, "yield_percentage": 97.0, "pets": [] },
        { "material_type": "SHRINK", "material_type_display": "Shrink Wrap", "unit": "Pcs",
          "expected_usage": 15840, "received": 16000, "total_used": 16000, "returned": 0, "total_losses": 160, "yield_percentage": 99.0, "pets": [] },
        { "material_type": "STRETCH_FILM", "material_type_display": "Stretch Film", "unit": "Kg",
          "expected_usage": 40.0, "received": 42.0, "total_used": 42.0, "returned": 0, "total_losses": 2.0, "yield_percentage": 95.2, "pets": [] },
        { "material_type": "CARTON_LAYER", "material_type_display": "Carton Layer", "unit": "Pcs",
          "expected_usage": 660, "received": 670, "total_used": 670, "returned": 0, "total_losses": 10, "yield_percentage": 98.5, "pets": [] },
        { "material_type": "CARTON_BOXES", "material_type_display": "Carton Boxes", "unit": "Pcs",
          "expected_usage": 0, "received": 0, "total_used": 0, "returned": 0, "total_losses": 0, "yield_percentage": 0, "pets": [] },
        { "material_type": "GLUE", "material_type_display": "Glue", "unit": "Kg",
          "expected_usage": 2.5, "received": 2.6, "total_used": 2.6, "returned": 0, "total_losses": 0.1, "yield_percentage": 96.2, "pets": [] }
      ],
      "summary": { "best_pet": { "pet_name": "Pet 1", "yield_percentage": 97.5 }, "worst_pet": { "pet_name": "Pet 1", "yield_percentage": 97.5 }, "overall_yield": 97.5 }
    },

    "meters_reading": {
      "co2": { "start_reading_kg": 2699923.9, "end_reading_kg": 2704952.1, "difference_in_balance": 0,
               "total_co2_consumed_kg": 5028.2, "std_co2_consumption_kg": 4800.0, "co2_yield_percent": 94.8,
               "co2_g_per_liter": 7.74, "co2_g_per_bottle": 2.71, "co2_grams_per_bottle": 2.71, "combi_reading": 1862749 },
      "syrup": { "start_reading": 45050.0, "end_reading": 56854.0, "difference": 11804.0, "unit": "L",
                 "syrup_density_kg_per_l": 1.2, "total_syrup_used_l": 15500.0, "syrup_dilution_ratio": "1:5",
                 "dr_sum": 6.0, "std_syrup_consumption_l": 11535.18, "syrup_yield_percent": 96.2 },
      "beverage": { "total_beverage_liters": 93000.0 },
      "production": { "filler_reading": 1862749, "combi_reading": 1862749, "shrink_reading": 116586,
                      "filler_rejects_mc": 0, "blower_rejects_manual": 0, "shrink_reading_packs_percent": 99.2 }
    },

    "downtime_breakdown": {
      "total_downtime_minutes": 45, "total_incidents": 3,
      "categories": [
        { "category_id": 2, "category_name": "Planned Downtime", "total_duration_mins": 10, "percentage_of_total": 22.2, "incident_count": 1, "color": "#3b82f6", "sub_categories": [] },
        { "category_id": 1, "category_name": "Mechanical Downtime", "total_duration_mins": 30, "percentage_of_total": 66.7, "incident_count": 2, "color": "#ef4444", "sub_categories": [] }
      ]
    }
  }
}
```

---

## 9. Calculation Reference

| Field | Formula |
|-------|---------|
| Total Output (R.W) | `total_bottles_produced` (fallbacks: `total_bottles` → `filler_reading` → `total_packs × bottles_per_pack`) |
| `total_bottles_per_hr` | `total_bottles / total_production_time_hrs` |
| batch `beverage_liters` | `syrup_liters × dr_sum` (dilution total parts) when not directly known |
| `co2_g_per_liter` | `(total_co2_consumed_kg × 1000) / total_beverage_liters` |
| `co2_g_per_bottle` | `(total_co2_consumed_kg × 1000) / total_bottles` |
| `std_co2_consumption_kg` | `total_bottles × co2_grams_per_bottle / 1000` |
| material `received` | `expected_usage + total_losses` |
| material `used` | `received − returned` |
| `yield_percentage` | `((total_used − total_losses) / total_used) × 100` |
| `shrink_reading_packs_percent` | `(shrink_reading / total_packs) × 100` |
| `syrup_yield_percent` | `(std_syrup_consumption_l / total_syrup_used_l) × 100` |
| `co2_yield_percent` | `(std_co2_consumption_kg / total_co2_consumed_kg) × 100` |

---

## 10. Acceptance Criteria (Definition of Done)

The API is complete when, for any valid filter combination:

1. **One call** to `production_summary` fully renders all three forms — no `/production/reports` fallback needed.
2. `summary.batches[]` and `pets[].batches[]` return per-batch `syrup_liters`, `beverage_liters`, `start_time`, `date`, `pet_name`, `product_name` (verified: Pet 1 NIGHT 2026-09-04 → 558=10,000 L, 556=5,500 L, total 15,500 L).
3. All §1 summary fields, §3 pet fields, §4 materials (incl. `expected_usage/received/returned` and all 8 material types), §6 meters (co2/syrup/beverage/production), and §7 downtime are present (use `null`/`0`/`[]` when unavailable — never omit).
4. `bottles_per_pack` is numeric; `total_downtime_minutes` uses the `_minutes` spelling; numeric fields are numbers not strings.
5. All per-line data (`meters_reading`, `batches`) respects `pet` and `shift` filters.
6. Envelope shape unchanged; all additions are backward-compatible (existing `batch_numbers`/`batch_number` retained).

---

## 11. Verification Reference (real data)

Validated against `production_summary?start_date=2026-09-04&end_date=2026-09-04&pet=11&shift=11`
cross-checked with `GET /production/reports/2122/` (Pet 1, NIGHT, 4 Sep 2026):

| Item | production_summary (today) | required |
|------|----------------------------|----------|
| Batch numbers | `["556","558"]` ✅ | keep |
| Batch 558 / 556 syrup | ❌ missing | 10,000 L / 5,500 L (from `batches[]`) |
| `total_syrup_liters` | `0.0` ❌ | 15,500.0 |
| `total_bottles_produced` | 190,080 ✅ | keep (= 15,840 × 12) |
| `total_bottles` / `total_output` | 197,746 ✅ | keep |
| per-batch `beverage_liters`, `start_time`, `date`, `pet_name` | ❌ missing | required |
