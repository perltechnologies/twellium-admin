# Production Summary API

**Endpoint:** `GET /production/dashboard/production_summary/`

## Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `start_date` | YYYY-MM-DD | Yes | Start of date range |
| `end_date` | YYYY-MM-DD | Yes | End of date range |
| `pet` | integer | No | Filter by pet ID |
| `shift` | integer | No | Filter by shift ID |

## Examples

```
GET /production/dashboard/production_summary/?start_date=2026-07-13&end_date=2026-07-19
GET /production/dashboard/production_summary/?start_date=2026-07-14&end_date=2026-07-14&pet=11
GET /production/dashboard/production_summary/?start_date=2026-07-13&end_date=2026-07-19&shift=1
```

## Response

```json
{
  "status_code": 200,
  "message": "Success",
  "data": {
    "filters": {
      "start_date": "2026-07-13",
      "end_date": "2026-07-14",
      "pet_id": null,
      "shift_id": null
    },

    "summary": {
      "total_output": 5700549,
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
      "target_met_count": 22
    },

    "daily_breakdown": [
      {
        "date": "2026-07-13",
        "total_output": 2850000,
        "total_bottles": 3060000,
        "total_packs": 127500,
        "oee": 84.2,
        "avg_efficiency": 84.2,
        "avg_availability": 92.1,
        "avg_performance": 89.5,
        "avg_quality": 99.9,
        "total_downtime_mins": 320,
        "planned_downtime_mins": 60,
        "mechanical_downtime_mins": 180,
        "avg_syrup_yield": 96.5,
        "avg_co2_yield": 95.1,
        "report_count": 12,
        "stoppage_report_count": 18,
        "pets": [
          {
            "pet_id": 11,
            "pet_name": "Pet 1",
            "product_name": "Rush Energy Drink",
            "shift": "DAY",
            "status": "Completed",
            "total_output": 520000,
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
            "total_production_reports_submitted": 2
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
            { "pet_id": 11, "pet_name": "Pet 1", "used": 1050000, "losses": 25000, "yield_percentage": 97.6 },
            { "pet_id": 12, "pet_name": "Pet 2", "used": 980000, "losses": 28000, "yield_percentage": 97.1 }
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
          "unit": "rolls",
          "total_used": 320,
          "total_losses": 12,
          "yield_percentage": 96.3,
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
                { "pet_id": 11, "pet_name": "Pet 1", "duration_mins": 45, "count": 2 },
                { "pet_id": 14, "pet_name": "Pet 4", "duration_mins": 60, "count": 3 }
              ]
            },
            {
              "sub_category_id": 102,
              "sub_category_name": "Conveyor Belt Failure",
              "total_duration_mins": 120,
              "incident_count": 5,
              "percentage_of_category": 23.4,
              "avg_duration_mins": 24.0,
              "pets_affected": []
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
          "sub_categories": [
            {
              "sub_category_id": 201,
              "sub_category_name": "Changeover",
              "total_duration_mins": 72,
              "incident_count": 3,
              "percentage_of_category": 60.0,
              "avg_duration_mins": 24.0,
              "pets_affected": []
            }
          ]
        },
        {
          "category_id": 3,
          "category_name": "Electrical",
          "total_duration_mins": 98,
          "percentage_of_total": 11.6,
          "incident_count": 5,
          "color": "#f59e0b",
          "sub_categories": [
            {
              "sub_category_id": 301,
              "sub_category_name": "Sensor Failure",
              "total_duration_mins": 55,
              "incident_count": 3,
              "percentage_of_category": 56.1,
              "avg_duration_mins": 18.3,
              "pets_affected": []
            }
          ]
        },
        {
          "category_id": 4,
          "category_name": "Quality",
          "total_duration_mins": 65,
          "percentage_of_total": 7.7,
          "incident_count": 4,
          "color": "#8b5cf6",
          "sub_categories": [
            {
              "sub_category_id": 401,
              "sub_category_name": "Brix Out of Spec",
              "total_duration_mins": 40,
              "incident_count": 2,
              "percentage_of_category": 61.5,
              "avg_duration_mins": 20.0,
              "pets_affected": []
            }
          ]
        },
        {
          "category_id": 5,
          "category_name": "Material",
          "total_duration_mins": 52,
          "percentage_of_total": 6.1,
          "incident_count": 3,
          "color": "#10b981",
          "sub_categories": [
            {
              "sub_category_id": 501,
              "sub_category_name": "Preform Shortage",
              "total_duration_mins": 30,
              "incident_count": 2,
              "percentage_of_category": 57.7,
              "avg_duration_mins": 15.0,
              "pets_affected": []
            }
          ]
        }
      ]
    }
  }
}
```

## Field Reference

### `summary`

| Field | Type | Description |
|-------|------|-------------|
| `total_output` | int | Finalized output (end of shift only) |
| `total_bottles` | float | Real-time bottle count |
| `total_packs` | int | Packs produced |
| `oee` | float | OEE % |
| `avg_efficiency` | float | Efficiency % |
| `avg_availability` | float | Availability % |
| `avg_performance` | float | Performance % |
| `avg_quality` | float | Quality % |
| `total_downtime_mins` | float | Total downtime (min) |
| `planned_downtime_mins` | float | Planned downtime (min) |
| `mechanical_downtime_mins` | float | Mechanical downtime (min) |
| `avg_syrup_yield` | float | Syrup yield % |
| `avg_co2_yield` | float | CO₂ yield % |
| `total_reports` | int | Production reports |
| `total_stoppage_reports` | int | Stoppage reports |
| `target_met_count` | int | Entries with efficiency ≥ 85% |

### `daily_breakdown[].pets[]`

| Field | Type | Description |
|-------|------|-------------|
| `pet_id` | int | Pet ID |
| `pet_name` | string | Pet name |
| `product_name` | string | Product on this line |
| `shift` | string | Shift (DAY, NIGHT) |
| `status` | string | Started / Completed |
| `total_output` | int | Finalized output (0 if in-progress) |
| `total_bottles` | float | Live bottle count |
| `total_packs` | int | Packs |
| `oee` | float | OEE % (0 if in-progress) |
| `efficiency` | float | Efficiency % |
| `availability` | float | Availability % |
| `performance` | float | Performance % |
| `quality` | float | Quality % |
| `total_downtime_mins` | float | Downtime (min) |
| `planned_downtime_mins` | float | Planned downtime (min) |
| `mechanical_downtime_mins` | float | Mechanical downtime (min) |
| `syrup_yield` | float | Syrup yield % (0 if in-progress) |
| `co2_yield` | float | CO₂ yield % (0 if in-progress) |
| `total_stoppage_reports_submitted` | int | Stoppage reports |
| `total_production_reports_submitted` | int | Production reports |

### `material_consumptions.materials[]`

| Field | Type | Description |
|-------|------|-------------|
| `material_type` | string | Key: PREFORMS, CLOSURES, LABELS, SHRINK, GLUE |
| `material_type_display` | string | Display name |
| `unit` | string | Unit (pcs, rolls, kg) |
| `total_used` | float | Total used |
| `total_losses` | float | Total losses |
| `yield_percentage` | float | Yield: ((used - losses) / used) × 100 |
| `pets[].pet_id` | int | Pet ID |
| `pets[].pet_name` | string | Pet name |
| `pets[].used` | float | Used by this pet |
| `pets[].losses` | float | Losses by this pet |
| `pets[].yield_percentage` | float | Yield for this pet |

### `downtime_breakdown.categories[]`

| Field | Type | Description |
|-------|------|-------------|
| `category_id` | int | Category ID |
| `category_name` | string | Category name |
| `total_duration_mins` | float | Total duration (min) |
| `percentage_of_total` | float | % of total downtime |
| `incident_count` | int | Incidents in category |
| `color` | string | Hex color |

### `downtime_breakdown.categories[].sub_categories[]`

| Field | Type | Description |
|-------|------|-------------|
| `sub_category_id` | int | Sub-category ID |
| `sub_category_name` | string | Sub-category name |
| `total_duration_mins` | float | Duration (min) |
| `incident_count` | int | Incidents |
| `percentage_of_category` | float | % of parent category |
| `avg_duration_mins` | float | Avg per incident |
| `pets_affected[].pet_id` | int | Pet ID |
| `pets_affected[].pet_name` | string | Pet name |
| `pets_affected[].duration_mins` | float | Duration on this pet |
| `pets_affected[].count` | int | Incidents on this pet |

## Notes

- `total_output` = 0 for in-progress shifts. Only finalized at end of shift.
- `total_bottles` = live count available during shift.
- `syrup_yield`, `co2_yield`, `oee` = 0 for in-progress shifts.
- All percentages are 0–100. All durations are in minutes.
- All sections respect the `pet` and `shift` filters when provided.
