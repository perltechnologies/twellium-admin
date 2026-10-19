// Session cache of the full handling-unit list, shared by the Transfer Execution
// list and the transfer form. It lets the list paint immediately when revisited,
// and lets the form push fresh server records back after a transfer so the list
// never shows pallets in a stage they have already left.

let cache = null;

export const unitKey = (unit) =>
    String(unit?.id ?? unit?.internal_id ?? unit?.current_barcode ?? unit?.barcode ?? unit?.rfid_number ?? '');

export const getUnitsCache = () => cache;

export const setUnitsCache = (units, fetchedAt = new Date()) => {
    cache = { units, fetchedAt };
};

export const clearUnitsCache = () => {
    cache = null;
};

// Replace cached records with fresher copies (matched by id). Records not in the
// cache are ignored; the cache only ever holds a complete snapshot.
export const mergeUnitsIntoCache = (freshUnits) => {
    if (!cache || !Array.isArray(freshUnits) || freshUnits.length === 0) return;
    const fresh = new Map();
    freshUnits.forEach((unit) => {
        const key = unitKey(unit);
        if (key) fresh.set(key, unit);
    });
    cache = {
        ...cache,
        units: cache.units.map((unit) => fresh.get(unitKey(unit)) ?? unit),
    };
};
