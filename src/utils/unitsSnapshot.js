import { inventoryApi } from '../api/inventory';

// A cheap fingerprint of the whole handling-unit list: the number of pallets per stage.
// Pallets being created or moved between stages change it; if it is unchanged the cached
// list is still good and nothing needs to be downloaded. Returns null when it cannot be read.
export const getUnitsSignature = async () => {
    try {
        const res = await inventoryApi.getStageCounts();
        const body = res?.data?.data ?? res?.data ?? {};
        const counts = body.stage_counts;
        if (!counts || typeof counts !== 'object') return null;
        const entries = Object.keys(counts).sort().map((stage) => [stage, Number(counts[stage]) || 0]);
        return JSON.stringify([entries, body.total_units ?? null]);
    } catch (error) {
        return null;
    }
};
