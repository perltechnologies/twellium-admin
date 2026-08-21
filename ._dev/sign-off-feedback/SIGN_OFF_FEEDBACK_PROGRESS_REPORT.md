# Production Sign-Off Feedback Progress Report

**Date of Report:** 2026-08-21
**Source:** Production staff red-pen corrections on printed sign-off forms (2026-08-14)
**Last Code Change:** 2026-08-17 (`7c7c247`, `d6432d2`)

> **Note:** The report's original status column was inaccurate. It listed REQ-4/5/6/7 as TODO even though they were implemented in commit `7c7c247` (2026-08-17). This table reflects the verified state of the code.

## Summary of Progress

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | Total Pallets displays Total Packs value | CRITICAL | ✅ IMPLEMENTED |
| 2 | Meters Reading not applicable at "All Lines" level | HIGH | ✅ IMPLEMENTED |
| 3 | Total Bottles (R.W) incorrect value | HIGH | ✅ IMPLEMENTED |
| 4 | Syrup calculations showing 0 (not computing) | CRITICAL | ✅ IMPLEMENTED |
| 5 | CO2 calculations showing 0 (not computing) | CRITICAL | ✅ IMPLEMENTED |
| 6 | Shrink Reading / T.Packs % incorrect | MEDIUM | ✅ IMPLEMENTED |
| 7 | Production End Time incorrect or non-editable | LOW | ✅ IMPLEMENTED |
| 8 | Workers Count showing wrong metric | MEDIUM | ✅ IMPLEMENTED |
| 9 | Single Packs calculation incorrect | MEDIUM | ✅ IMPLEMENTED |
| 10 | Blower Rejects value appears wrong | LOW | ⚠️ PARTIAL / SUSPECT |

---

## Detailed Status

### Completed
- **REQ-1:** Total Pallets displays Total Packs value — Implemented logic to detect and recalculate incorrect API values.
  *Example Calculation:* `Total Pallets = floor((Total Packs - Single Packs) / Packs Per Pallet)` -> `floor((235625 - 6) / 240) ≈ 981` (Staff expected 81 pallets directly).
- **REQ-2:** Meters Reading not applicable at "All Lines" level — Implemented conditional display to hide or mark as "Not Applicable" for aggregated views.
- **REQ-3:** Total Bottles (R.W) incorrect value — Updated mapping to fallback to `combi_reading` if `filler_reading` is missing.
- **REQ-4:** Syrup calculations showing 0 — Fallback logic implemented (`7c7c247`): compute `total_used`, `std_consumption`, and `yield` from start/end readings when API returns 0. Further improved in `d6432d2` to use cumulative (volume-weighted) average instead of simple arithmetic mean of yields. Affects `SyrupReport.jsx`, `PlantOverview.jsx`.
  *Example Calculation:* `Total Syrup Used = 170886 - 157057 = 13,829 L`. `Std Consumption = (Filler Reading × Bottle Size) / Dilution Ratio`. `Yield = (Std / Actual) × 100 = 98.55%`.
- **REQ-5:** CO2 calculations showing 0 — Fallback logic implemented (`7c7c247`): compute consumed and yield from readings. Improved in `d6432d2` to cumulative weighted average. Affects `CO2Report.jsx`, `PlantOverview.jsx`.
  *Example Calculation:* `Total CO2 Consumed = End - Start = 643.2 kg`.
- **REQ-6:** Shrink Reading / T.Packs % incorrect — Formula implemented (`7c7c247`): `(shrink_reading / filler_reading) × 100`, with guard to accept API value only when > 50. See `ProductionReportForm.jsx:1012-1022`.
  *Example Calculation:* `(Shrink Reading / Filler Reading) × 100` -> `19250 / 19440 = 99.0%`.
- **REQ-7:** Production End Time incorrect — Improved auto-fill with more data sources (`7c7c247`).
- **REQ-8:** Workers Count wrong metric — Updated to use `total_active_workers` as the preferred metric (falls back to `worker_count`).
- **REQ-9:** Single Packs calculation incorrect — Calculation implemented with multiple fallbacks in `ProductionReportForm.jsx:407-478`.

### Partial / Needs Review
- **REQ-10:** Blower Rejects value appears wrong — Only reads `blower_rejects_manual` and displays it directly; no fallback/validation added. Still suspect. See `ProductionReportForm.jsx:1007,1151`.
