export const CO2_CONSUMPTION_UNIT = 'kg';

const finiteNumber = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
};

const firstNumber = (...values) => {
    for (const value of values) {
        const number = finiteNumber(value);
        if (number !== null) return number;
    }
    return null;
};

/**
 * Resolve the authoritative CO2 values for one production-summary PET row.
 *
 * A row qualifies when it has production output, a standard value, and a
 * positive actual value. A zero reported yield never excludes an otherwise
 * valid row. Actual consumption is derived only when the API omits it and
 * supplies the approved standard / yield pairing.
 */
export const resolveCO2Consumption = (pet = {}) => {
    const meter = pet.meters_reading?.co2 ?? pet.co2 ?? {};
    const output = firstNumber(
        pet.total_bottles_produced,
        pet.total_bottles,
        pet.total_packs,
    ) ?? 0;
    const standard = firstNumber(
        meter.std_co2_consumption_kg,
        meter.std_co2_consumed_kg,
        pet.std_co2_consumption_kg,
        pet.std_co2_consumed_kg,
    );
    const authoritativeActual = firstNumber(
        meter.total_co2_consumed_kg,
        meter.actual_co2_consumption_kg,
        pet.total_co2_consumed_kg,
        pet.actual_co2_consumption_kg,
    );
    const reportedYield = firstNumber(
        meter.co2_yield_percent,
        meter.co2_yield_percentage,
        pet.co2_yield,
        pet.co2_yield_percent,
        pet.co2_yield_percentage,
    );

    const derivedActual = authoritativeActual === null && standard !== null && standard >= 0 && reportedYield > 0
        ? standard / (reportedYield / 100)
        : null;
    const actual = authoritativeActual ?? derivedActual;
    const qualifies = output > 0 && standard !== null && standard >= 0 && actual !== null && actual > 0;

    return {
        qualifies,
        output,
        standard,
        actual,
        yieldPercent: qualifies ? (standard / actual) * 100 : null,
        actualSource: authoritativeActual !== null ? 'api' : derivedActual !== null ? 'derived' : null,
        unit: CO2_CONSUMPTION_UNIT,
    };
};

/** Calculate a weighted cumulative yield from normalized qualifying records. */
export const summarizeCO2Consumption = (records = []) => {
    const qualifying = records.filter((record) => {
        const standard = finiteNumber(record.standard_consumption);
        const actual = finiteNumber(record.actual_consumption);
        return standard !== null && standard >= 0 && actual !== null && actual > 0;
    });
    const totalStandard = qualifying.reduce((sum, record) => sum + Number(record.standard_consumption), 0);
    const totalActual = qualifying.reduce((sum, record) => sum + Number(record.actual_consumption), 0);

    return {
        totalStandard,
        totalActual,
        yieldPercent: totalActual > 0 ? (totalStandard / totalActual) * 100 : null,
        recordCount: qualifying.length,
        unit: CO2_CONSUMPTION_UNIT,
    };
};

export const buildCO2ExportRows = (records = []) => records.map((record) => ({
    'Date': record.date,
    'PET Line': record.pet,
    'Product': record.product,
    'Shift': record.shift,
    [`Standard CO2 Consumption (${CO2_CONSUMPTION_UNIT})`]: Number(record.standard_consumption),
    [`Actual CO2 Consumption (${CO2_CONSUMPTION_UNIT})`]: Number(record.actual_consumption),
    'CO2 Yield Percent': Number(record.co2_yield),
    'Total Output': Number(record.total_bottles_produced),
}));
