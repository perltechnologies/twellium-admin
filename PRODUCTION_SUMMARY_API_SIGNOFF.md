# Production Summary API — Modified Spec (Sign-Off Form)

**Endpoint:** `GET /production/dashboard/production_summary/`

This is a modified version of the Production Summary API spec designed to populate **all** fields on the `/dashboard/sign-off-forms/production-report` printable form. Fields marked with 🆕 are **new additions** not present in the current API response.

---

## Query Parameters (unchanged)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `start_date` | YYYY-MM-DD | Yes | Start of date range |
| `end_date` | YYYY-MM-DD | Yes | End of date range |
| `pet` | integer | No | Filter by pet ID |
| `shift` | integer | No | Filter by shift ID |

---

## Response — Modified

```json
{
  "status_code": 200,
  "message": "Success",
  "data": {
    "filters": {
      "start_date": "2026-07-18",
      "end_date": "2026-07-18",
      "pet_id": null,
      "shift_id": null
    },

    "summary": {
      "total_bottles_produced": 5700549,
      "total_bottles": 6120340,
      "total_packs": 254180,
      "oee": 82.4,
      "avg_efficiency": 82.4,
      "avg_availability": 91.2,
      "avg_performance": 88.7,
      "avg_quality": 99.8,
      "total_downtime_mins": 847,
      "planned_downtime_mins": 120,
      "mechanical_downtime_mins": 512,
      "avg_syrup_yield": 96.2,
      "avg_co2_yield": 94.8,
      "total_reports": 36,
      "total_stoppage_reports": 42,
      "target_met_count": 22,

      "production_start_time": "06:00",
      "production_end_time": "22:00",
      "total_production_time_hrs": 16.0
    },

    "daily_breakdown": [
      {
        "date": "2026-07-18",
        "total_bottles_produced": 5700549,
        "total_bottles": 6120340,
        "total_packs": 254180,
        "oee": 82.4,
        "avg_efficiency": 82.4,
        "avg_availability": 91.2,
        "avg_performance": 88.7,
        "avg_quality": 99.8,
        "total_downtime_mins": 847,
        "planned_downtime_mins": 120,
        "mechanical_downtime_mins": 512,
        "avg_syrup_yield": 96.2,
        "avg_co2_yield": 94.8,
        "report_count": 36,
        "stoppage_report_count": 42,

        "production_start_time": "06:00",
        "production_end_time": "22:00",
        "total_production_time_hrs": 16.0,

        "pets": [
          {
            "pet_id": 11,
            "pet_name": "Pet 1",
            "product_name": "Rush Energy Drink",
            "shift": "DAY",
            "status": "Completed",
            "total_bottles_produced": 520000,
            "total_bottles": 548000,
            "total_packs": 21667,
            "oee": 86.5,
            "efficiency": 86.5,
            "availability": 93.2,
            "performance": 90.1,
            "quality": 100.0,
            "total_downtime_mins": 45,
            "planned_downtime_mins": 10,
            "mechanical_downtime_mins": 30,
            "syrup_yield": 97.2,
            "co2_yield": 95.8,
            "total_stoppage_reports_submitted": 3,
            "total_production_reports_submitted": 2,

            "production_start_time": "06:00",
            "production_end_time": "14:00",
            "total_production_time_hrs": 8.0
          }
        ]
      }
    ],

    "material_consumptions": {
      "materials": [
        {
          "material_type": "PREFORMS",
          "material_type_display": "Preforms",
          "unit": "pcs",
          "total_used": 5850000,
          "total_losses": 149451,
          "yield_percentage": 97.4,
          "pets": [
            { "pet_id": 11, "pet_name": "Pet 1", "used": 1050000, "losses": 25000, "yield_percentage": 97.6 }
          ]
        },
        {
          "material_type": "CLOSURES",
          "material_type_display": "Closures",
          "unit": "pcs",
          "total_used": 5850000,
          "total_losses": 87750,
          "yield_percentage": 98.5,
          "pets": []
        },
        {
          "material_type": "LABELS",
          "material_type_display": "Labels",
          "unit": "pcs",
          "total_used": 5900000,
          "total_losses": 118000,
          "yield_percentage": 98.0,
          "pets": []
        },
        {
          "material_type": "SHRINK",
          "material_type_display": "Shrink Wrap",
          "unit": "pcs",
          "total_used": 320,
          "total_losses": 12,
          "yield_percentage": 96.3,
          "pets": []
        },
        {
          "material_type": "STRETCH_FILM",
          "material_type_display": "Stretch Film",
          "unit": "kg",
          "total_used": 85.0,
          "total_losses": 4.2,
          "yield_percentage": 95.1,
          "pets": []
        },
        {
          "material_type": "CARTON_LAYER",
          "material_type_display": "Carton Layer",
          "unit": "pcs",
          "total_used": 12500,
          "total_losses": 150,
          "yield_percentage": 98.8,
          "pets": []
        },
        {
          "material_type": "CARTON_BOXES",
          "material_type_display": "Carton Boxes",
          "unit": "pcs",
          "total_used": 45000,
          "total_losses": 320,
          "yield_percentage": 99.3,
          "pets": []
        },
        {
          "material_type": "GLUE",
          "material_type_display": "Glue",
          "unit": "kg",
          "total_used": 48.5,
          "total_losses": 3.2,
          "yield_percentage": 93.4,
          "pets": []
        }
      ],
      "summary": {
        "best_pet": { "pet_name": "Pet 6", "yield_percentage": 97.2 },
        "worst_pet": { "pet_name": "Pet 4", "yield_percentage": 95.8 },
        "overall_yield": 97.1
      }
    },

    "meters_reading": {
      "co2": {
        "start_reading_kg": 1250.0,
        "end_reading_kg": 1180.5,
        "total_co2_consumed_kg": 69.5,
        "std_co2_consumption_kg": 65.0,
        "co2_yield_percent": 94.8
      },
      "syrup": {
        "start_reading": 5200.0,
        "end_reading": 3850.0,
        "difference": 1350.0,
        "unit": "L",
        "syrup_density_kg_per_l": 1.042,
        "total_syrup_used_l": 1350.0,
        "syrup_dilution_ratio": 4.5,
        "std_syrup_consumption_l": 1400.0,
        "syrup_yield_percent": 96.2
      },
      "production": {
        "filler_reading": 6150000,
        "shrink_reading": 254500,
        "filler_rejects_mc": 12500,
        "blower_rejects_manual": 3200,
        "shrink_reading_packs_percent": 99.2
      }
    },

    "downtime_breakdown": {
      "total_downtime_mins": 847,
      "total_incidents": 42,
      "categories": [
        {
          "category_id": 1,
          "category_name": "Mechanical Downtime",
          "total_duration_mins": 512,
          "percentage_of_total": 60.4,
          "incident_count": 24,
          "color": "#ef4444",
          "sub_categories": [
            {
              "sub_category_id": 101,
              "sub_category_name": "Filler Machine Jam",
              "total_duration_mins": 180,
              "incident_count": 8,
              "percentage_of_category": 35.2,
              "avg_duration_mins": 22.5,
              "pets_affected": [
                { "pet_id": 11, "pet_name": "Pet 1", "duration_mins": 45, "count": 2 }
              ]
            }
          ]
        },
        {
          "category_id": 2,
          "category_name": "Planned Downtime",
          "total_duration_mins": 120,
          "percentage_of_total": 14.2,
          "incident_count": 6,
          "color": "#3b82f6",
          "sub_categories": []
        },
        {
          "category_id": 3,
          "category_name": "Electrical",
          "total_duration_mins": 98,
          "percentage_of_total": 11.6,
          "incident_count": 5,
          "color": "#f59e0b",
          "sub_categories": []
        }
      ]
    }
  }
}
```

---

## New Fields Reference

### 🆕 `summary` — New Fields

| Field | Type | Description | Form Location |
|-------|------|-------------|---------------|
| `production_start_time` | string (HH:MM) | Earliest production start across all reports | Production Start Time |
| `production_end_time` | string (HH:MM) | Latest production end across all reports | Production End Time |
| `total_production_time_hrs` | float | Total production hours (end - start - downtime) | Total Production Time (Hrs) |

### 🆕 `daily_breakdown[].pets[]` — New Fields

| Field | Type | Description |
|-------|------|-------------|
| `production_start_time` | string (HH:MM) | Start time for this pet/shift |
| `production_end_time` | string (HH:MM) | End time for this pet/shift |
| `total_production_time_hrs` | float | Production hours for this pet/shift |

### 🆕 `meters_reading` — Entirely New Section

#### `meters_reading.co2`

| Field | Type | Description | Form Location |
|-------|------|-------------|---------------|
| `start_reading_kg` | float | CO2 meter start reading | Start up Reading (Kg) |
| `end_reading_kg` | float | CO2 meter end reading | End up Reading (Kg) |
| `total_co2_consumed_kg` | float | Total CO2 consumed (start - end) | Total CO2 Consumed (kg) |
| `std_co2_consumption_kg` | float | Standard/expected CO2 consumption | Std. CO2 Consumption (kg) |
| `co2_yield_percent` | float | CO2 yield % | CO2 Yield (%) |

#### `meters_reading.syrup`

| Field | Type | Description | Form Location |
|-------|------|-------------|---------------|
| `start_reading` | float | Syrup meter start reading | Start up Reading |
| `end_reading` | float | Syrup meter end reading | End up Reading |
| `difference` | float | End - Start difference | Difference (End - Start) |
| `unit` | string | Unit of measurement (L, m3, kg) | Unit (L, m3, kg) |
| `syrup_density_kg_per_l` | float | Syrup density | Syrup Density (kg/L) |
| `total_syrup_used_l` | float | Total syrup used in liters | Total Syrup Used (L) |
| `syrup_dilution_ratio` | float | Dilution ratio | Syrup Dilution Ratio |
| `std_syrup_consumption_l` | float | Standard/expected syrup consumption | Std. Syrup Consumption (L) |
| `syrup_yield_percent` | float | Syrup yield % | Syrup Yield (%) |

#### `meters_reading.production`

| Field | Type | Description | Form Location |
|-------|------|-------------|---------------|
| `filler_reading` | int | Filler machine counter reading | Filler Reading |
| `shrink_reading` | int | Shrink machine counter reading | Shrink Reading |
| `filler_rejects_mc` | int | Filler rejects (machine count) | Filler Rejects (M/C) |
| `blower_rejects_manual` | int | Blower rejects (manual count) | Blower Rejects (Manual Count) |
| `shrink_reading_packs_percent` | float | Shrink reading as % of total packs | Shrink Reading / T. Packs (%) |

### 🆕 `material_consumptions.materials[]` — New Material Types

| material_type | material_type_display | unit | Description |
|---------------|----------------------|------|-------------|
| `STRETCH_FILM` | Stretch Film | kg | Stretch film consumption |
| `CARTON_LAYER` | Carton Layer | pcs | Carton layer consumption |
| `CARTON_BOXES` | Carton Boxes | pcs | Carton boxes consumption |

> **Note:** `PREFORMS`, `CLOSURES`, `LABELS`, `SHRINK`, and `GLUE` already exist. The three above are new additions.

---

## Calculation Logic

| Field | Formula |
|-------|---------|
| `total_production_time_hrs` | `(production_end_time - production_start_time)` in hours, summed across shifts |
| `total_co2_consumed_kg` | `start_reading_kg - end_reading_kg` |
| `syrup.difference` | `end_reading - start_reading` |
| `syrup_yield_percent` | `(std_syrup_consumption_l / total_syrup_used_l) × 100` |
| `co2_yield_percent` | `(std_co2_consumption_kg / total_co2_consumed_kg) × 100` |
| `shrink_reading_packs_percent` | `(shrink_reading / total_packs) × 100` |
| `total_downtime_mins` | `planned_downtime_mins + mechanical_downtime_mins` |

---

## Notes

- When `pet` filter is applied, `meters_reading` should aggregate only readings from that specific line.
- When `shift` filter is applied, `meters_reading` should reflect only that shift's readings.
- `production_start_time` at summary level = MIN(start_time) across all reports for the date/filters.
- `production_end_time` at summary level = MAX(end_time) across all reports for the date/filters.
- All existing fields remain unchanged and backward-compatible.
- All percentages are 0–100. All durations are in minutes except `total_production_time_hrs`.

---

## Additional Fields for Production Run by Pet Form (`/dashboard/sign-off-forms/production-run-by-pet`)

These fields are needed to fully populate the **FP-DR-008-Rev.A** production run form for a specific line over a multi-day period.

### 🆕 `summary` — Additional Fields

| Field | Type | Description | Form Location |
|-------|------|-------------|---------------|
| `line_speed` | int | Line speed setting (bottles/hr capacity) | Line Speed |
| `batch_numbers` | string[] | List of batch numbers used in the run | Batch N° |
| `total_syrup_liters` | float | Total syrup consumed (liters) | Syrup (Lts) |
| `total_beverage_liters` | float | Total beverage produced (liters) | Bev. (Lts) / Total (Lts) |
| `bottle_size` | string | Bottle size (e.g. "350 ml") | Package |
| `bottles_per_pack` | int | Bottles per physical box/pack | Physical Box |
| `total_bottles_per_hr` | int | Calculated: total_bottles / total_production_time_hrs | Total Btls/Hr |
| `total_shrink_packs` | int | Total shrink-wrapped packs | T. Shrink |
| `total_carton_packs` | int | Total carton-packed units | Total Carton |
| `total_production_time_hrs` | float | Sum of all production hours in the run | Total Production Hrs |
| `production_start_time` | string (ISO datetime) | Earliest start across the run | Start Up Production |
| `production_end_time` | string (ISO datetime) | Latest end across the run | Shut Down Production |
| `worker_count` | int | Number of workers on line | Workers |
| `worker_names` | string[] | Names of workers assigned | Working Labours On Line |
| `absent_worker_names` | string[] | Names of absent workers | Name Of Absent Labours |
| `paid_hours` | float | Total paid hours including overtime | Paid Hours (overtime) |

### 🆕 `material_consumptions.materials[]` — Additional Fields per Material

| Field | Type | Description | Form Location |
|-------|------|-------------|---------------|
| `expected_usage` | float | Expected/calculated material usage | Expected to be use |
| `received` | float | Total material received/issued | Received |
| `returned` | float | Material returned unused | Returned |

> **Note:** `total_used` and `total_losses` already exist. `yield_percentage` already exists.
> Calculation: `received = expected_usage + losses`, `used = received - returned`

### 🆕 `meters_reading.co2` — Additional Fields

| Field | Type | Description | Form Location |
|-------|------|-------------|---------------|
| `difference_in_balance` | float | Remaining CO2 difference/adjustment | Difference in Balance |
| `co2_g_per_liter` | float | CO2 grams per liter of beverage | CO2 g/l |
| `co2_g_per_bottle` | float | CO2 grams per bottle | CO2 g/Btl |

> **Calculation:**
> - `co2_g_per_liter = (total_co2_consumed_kg * 1000) / total_beverage_liters`
> - `co2_g_per_bottle = (total_co2_consumed_kg * 1000) / total_bottles`

### 🆕 `meters_reading.production` — Additional Fields

| Field | Type | Description | Form Location |
|-------|------|-------------|---------------|
| `combi_reading` | int | Combi/filler machine total counter | Combi Reading |

> **Note:** `filler_reading` already exists but this form uses "Combi Reading" terminology. Can be same field or alias.

### 🆕 Example Response (run-specific additions)

```json
{
  "summary": {
    "...existing fields...": "...",
    "line_speed": 22000,
    "batch_numbers": ["150", "153", "155", "157", "160", "163", "166", "170", "172", "175", "178", "180", "182"],
    "total_syrup_liters": 126000,
    "total_beverage_liters": 630000,
    "bottle_size": "350 ml",
    "bottles_per_pack": 16,
    "total_bottles_per_hr": 19948,
    "total_shrink_packs": 115986,
    "total_carton_packs": 0,
    "total_production_time_hrs": 93,
    "production_start_time": "2026-03-23T07:03:00Z",
    "production_end_time": "2026-03-26T04:09:00Z",
    "worker_count": 12,
    "worker_names": ["Kwame A.", "Ama B.", "Kofi C."],
    "absent_worker_names": [],
    "paid_hours": 93
  },
  "material_consumptions": {
    "materials": [
      {
        "material_type": "PREFORMS",
        "material_type_display": "Preforms",
        "unit": "pcs",
        "expected_usage": 1855776,
        "received": 1878400,
        "total_used": 1878400,
        "returned": 0,
        "total_losses": 22624,
        "yield_percentage": 98.8
      },
      {
        "material_type": "CLOSURES",
        "material_type_display": "Closures",
        "unit": "pcs",
        "expected_usage": 1855776,
        "received": 1866331,
        "total_used": 1866331,
        "returned": 0,
        "total_losses": 10555,
        "yield_percentage": 99.4
      }
    ]
  },
  "meters_reading": {
    "co2": {
      "start_reading_kg": 2699923.9,
      "end_reading_kg": 2704952.1,
      "difference_in_balance": 0,
      "total_co2_consumed_kg": 5028.2,
      "co2_g_per_liter": 7.74,
      "co2_g_per_bottle": 2.71,
      "co2_yield_percent": 94.8
    },
    "production": {
      "combi_reading": 1862749,
      "shrink_reading": 116586,
      "filler_reading": 1862749,
      "filler_rejects_mc": 0,
      "blower_rejects_manual": 0,
      "shrink_reading_packs_percent": 99.2
    }
  }
}
```

### Calculation Reference (Production Run)

| Field | Formula |
|-------|---------|
| `total_bottles_per_hr` | `total_bottles / total_production_time_hrs` |
| `total_beverage_liters` | `SUM(syrup_liters × dilution_ratio)` per batch |
| `expected_usage` (Preforms) | `final_production_packs × bottles_per_pack` |
| `expected_usage` (Labels) | `expected_preforms × label_weight_per_bottle / 1000` (kg) |
| `expected_usage` (Shrink) | `final_production_packs × shrink_weight / 1000` (kg) |
| `co2_g_per_liter` | `(total_co2_consumed_kg × 1000) / total_beverage_liters` |
| `co2_g_per_bottle` | `(total_co2_consumed_kg × 1000) / total_bottles` |
| `total_production_time_hrs` | `(production_end_time - production_start_time)` in hours |
| `received` | `expected_usage + total_losses` |
