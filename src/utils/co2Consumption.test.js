import {
    buildCO2ExportRows,
    CO2_CONSUMPTION_UNIT,
    resolveCO2Consumption,
    summarizeCO2Consumption,
} from './co2Consumption';

describe('resolveCO2Consumption', () => {
    test('prefers authoritative standard and actual API values', () => {
        const result = resolveCO2Consumption({
            total_bottles_produced: 1000,
            co2_yield: 10,
            meters_reading: { co2: {
                std_co2_consumption_kg: 95,
                total_co2_consumed_kg: 100,
                co2_yield_percent: 40,
            } },
        });

        expect(result).toMatchObject({ qualifies: true, standard: 95, actual: 100, yieldPercent: 95, actualSource: 'api', unit: CO2_CONSUMPTION_UNIT });
    });

    test('derives actual only when the API actual is unavailable', () => {
        const result = resolveCO2Consumption({
            total_bottles: 500,
            meters_reading: { co2: { std_co2_consumption_kg: 90, co2_yield_percent: 90 } },
        });

        expect(result).toMatchObject({ qualifies: true, standard: 90, actual: 100, yieldPercent: 90, actualSource: 'derived' });
    });

    test('keeps a completed production row whose calculated yield is zero', () => {
        const result = resolveCO2Consumption({
            total_packs: 20,
            meters_reading: { co2: { std_co2_consumption_kg: 0, total_co2_consumed_kg: 12 } },
        });

        expect(result).toMatchObject({ qualifies: true, yieldPercent: 0 });
    });

    test('rejects rows without production or a usable consumption pair', () => {
        expect(resolveCO2Consumption({ meters_reading: { co2: { std_co2_consumption_kg: 90, total_co2_consumed_kg: 100 } } }).qualifies).toBe(false);
        expect(resolveCO2Consumption({ total_bottles: 100, meters_reading: { co2: { std_co2_consumption_kg: 90 } } }).qualifies).toBe(false);
    });
});

describe('summarizeCO2Consumption', () => {
    test('calculates headline yield from cumulative values, not an average of percentages', () => {
        const summary = summarizeCO2Consumption([
            { standard_consumption: 90, actual_consumption: 100 },
            { standard_consumption: 50, actual_consumption: 200 },
        ]);

        expect(summary).toMatchObject({ totalStandard: 140, totalActual: 300, recordCount: 2 });
        expect(summary.yieldPercent).toBeCloseTo((140 / 300) * 100);
        expect(summary.yieldPercent).not.toBeCloseTo((90 + 25) / 2);
    });

    test('returns no yield when cumulative actual consumption is unavailable', () => {
        expect(summarizeCO2Consumption([])).toMatchObject({
            totalStandard: 0,
            totalActual: 0,
            yieldPercent: null,
            recordCount: 0,
        });
        expect(summarizeCO2Consumption([
            { standard_consumption: 10, actual_consumption: 0 },
        ]).yieldPercent).toBeNull();
    });
});

describe('buildCO2ExportRows', () => {
    test('uses the required columns in order with numeric calculation fields', () => {
        const [row] = buildCO2ExportRows([{
            date: '2026-09-15',
            pet: 'Pet 2',
            product: 'Beverage',
            shift: 'DAY',
            standard_consumption: '95.5',
            actual_consumption: '100.25',
            co2_yield: '95.26',
            total_bottles_produced: '1200',
        }]);

        expect(Object.keys(row)).toEqual([
            'Date',
            'PET Line',
            'Product',
            'Shift',
            'Standard CO2 Consumption (kg)',
            'Actual CO2 Consumption (kg)',
            'CO2 Yield Percent',
            'Total Output',
        ]);
        expect(row).toMatchObject({
            'Standard CO2 Consumption (kg)': 95.5,
            'Actual CO2 Consumption (kg)': 100.25,
            'CO2 Yield Percent': 95.26,
            'Total Output': 1200,
        });
        expect(typeof row['Standard CO2 Consumption (kg)']).toBe('number');
        expect(typeof row['Actual CO2 Consumption (kg)']).toBe('number');
        expect(typeof row['CO2 Yield Percent']).toBe('number');
    });
});
