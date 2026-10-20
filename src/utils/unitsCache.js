// Cache of the full handling-unit list, shared by the Transfer Execution list, the
// Transfer Analytics list and the transfer form. The list is large, so it is loaded once:
// it is kept in memory and in IndexedDB (to survive a page reload), and only loaded again
// when a cheap check (the per-stage counts, see unitsSnapshot.js) says the data changed.
//
// cache = { units, fetchedAt, signature }

let cache = null;

const DB_NAME = 'twellium-cache';
const STORE = 'kv';
const KEY = 'handling-units';

const openDb = () => new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB unavailable'));
        return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
});

const persist = async (value) => {
    try {
        const db = await openDb();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            if (value) tx.objectStore(STORE).put(value, KEY);
            else tx.objectStore(STORE).delete(KEY);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
        db.close();
    } catch (error) {
        // Persistence is an optimisation only.
    }
};

export const unitKey = (unit) =>
    String(unit?.id ?? unit?.internal_id ?? unit?.current_barcode ?? unit?.barcode ?? unit?.rfid_number ?? '');

export const getUnitsCache = () => cache;

export const setUnitsCache = (units, fetchedAt = new Date(), signature = null) => {
    cache = { units, fetchedAt, signature };
    persist({ units, fetchedAt: new Date(fetchedAt).toISOString(), signature });
};

// After a page reload: bring the saved list back into memory (no-op if already there).
export const hydrateUnitsCache = async () => {
    if (cache) return cache;
    try {
        const db = await openDb();
        const saved = await new Promise((resolve, reject) => {
            const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        db.close();
        if (saved && Array.isArray(saved.units) && !cache) {
            cache = { units: saved.units, fetchedAt: new Date(saved.fetchedAt), signature: saved.signature ?? null };
        }
    } catch (error) {
        // ignore
    }
    return cache;
};

export const clearUnitsCache = () => {
    cache = null;
    persist(null);
};

// Record the signature that matches the cached list (e.g. after a transfer was applied to it).
export const setUnitsCacheSignature = (signature) => {
    if (!cache) return;
    cache = { ...cache, signature };
    persist({ ...cache, fetchedAt: new Date(cache.fetchedAt).toISOString() });
};

const persistCurrent = () => {
    if (cache) persist({ ...cache, fetchedAt: new Date(cache.fetchedAt).toISOString() });
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
    persistCurrent();
};

// Apply a completed transfer to the cached list instead of reloading it: every pallet the
// server reports as moved (matched by unit id or barcode/RFID) gets its new stage, barcode
// and document details.
export const applyTransferToCache = (moved, { targetStage, documentCode, sourceName, targetName, sourceId, targetId }) => {
    if (!cache || !Array.isArray(moved) || moved.length === 0) return;
    const byId = new Map();
    const byScan = new Map();
    moved.forEach((m) => {
        if (m.unit_id) byId.set(String(m.unit_id), m);
        if (m.scan_value) byScan.set(String(m.scan_value), m);
    });
    const now = new Date().toISOString();
    cache = {
        ...cache,
        units: cache.units.map((unit) => {
            const hit = byId.get(String(unit.id ?? '')) || byScan.get(String(unit.current_barcode || unit.barcode || unit.rfid_number || ''));
            if (!hit) return unit;
            return {
                ...unit,
                current_status: targetStage,
                ...(hit.new_barcode ? { current_barcode: hit.new_barcode } : {}),
                document_code: documentCode,
                source_supervisor: sourceId ?? unit.source_supervisor,
                target_supervisor: targetId ?? unit.target_supervisor,
                source_supervisor_name: sourceName || unit.source_supervisor_name,
                target_supervisor_name: targetName || unit.target_supervisor_name,
                updated_at: now,
            };
        }),
    };
    persistCurrent();
};
