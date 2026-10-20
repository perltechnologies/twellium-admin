import { MAIN_WAREHOUSE_STAGE, STAGING_WAREHOUSE_STAGE } from '../api/inventory';

/**
 * Shared helpers for post-production transfers.
 *
 * The backend has no "transfer" record. A transfer is derived from handling
 * units: every unit created on the same day, for the same product on the same
 * PET line, belongs to the same transfer (ID: TRyymmdd-PROD-Pnn).
 */

// --- field accessors (handling unit records use varied shapes across the API) ---
export const getProductName = (u) => u.product_name || u.product?.name || u.product || 'N/A';
export const getPetName = (u) => u.pet_name || u.pet?.pet_name || u.pet?.name || u.pet || 'N/A';
export const getCreatedAt = (u) => u.created_at || u.created || null;
export const getUpdatedAt = (u) => u.updated_at || u.created_at || u.created || null;
export const getBarcode = (u) => u.current_barcode || u.barcode || u.rfid_number || '';
export const getStage = (u) => {
    const stage = u.current_status || u.current_stage || u.stage || '';
    return String(stage?.code || stage?.name || stage).trim().toUpperCase();
};
// PD code of the transfer document that moved a pallet into its current stage.
// Returned by the backend once it stores it (see TRANSFER_DOCUMENT_API_SPEC.md).
export const getDocumentCode = (u) => {
    const code = u.document_code ?? u.transfer_document_code ?? u.transfer_document?.document_code ?? u.transfer_document;
    return typeof code === 'string' || typeof code === 'number' ? String(code).trim() : '';
};

// Supervisors recorded on the transfer that moved a pallet into its current stage.
export const getSupervisors = (u) => {
    const name = (n, o) => String(u[n] ?? (o && typeof o === 'object' ? (o.name || o.full_name || '') : '') ?? '').trim();
    return {
        source: name('source_supervisor_name', u.source_supervisor),
        target: name('target_supervisor_name', u.target_supervisor),
        sourceId: typeof u.source_supervisor === 'object' ? u.source_supervisor?.id ?? null : u.source_supervisor ?? null,
        targetId: typeof u.target_supervisor === 'object' ? u.target_supervisor?.id ?? null : u.target_supervisor ?? null,
    };
};

// Distinct supervisor names across a set of pallets, in order of first appearance.
export const getSupervisorNames = (units) => {
    const source = new Set();
    const target = new Set();
    (units || []).forEach((u) => {
        const s = getSupervisors(u);
        if (s.source) source.add(s.source);
        if (s.target) target.add(s.target);
    });
    return { source: [...source], target: [...target] };
};

// Distinct PD codes across a set of pallets, in order of first appearance.
export const getDocumentCodes = (units) => [...new Set((units || []).map(getDocumentCode).filter(Boolean))];

// Stamp type of a pallet. Not returned by the API yet (see TRANSFER_DOCUMENT_API_SPEC.md);
// the frontend will pick it up from `stamp_type` as soon as it is.
export const getStampType = (u) => {
    const stamp = u.stamp_type ?? u.stamp_type_name ?? u.stamp_type?.name ?? u.stamp?.type;
    const value = typeof stamp === 'object' && stamp !== null ? (stamp.name ?? stamp.code) : stamp;
    return value !== undefined && value !== null ? String(value).trim() : '';
};

export const getStampTypes = (units) => [...new Set((units || []).map(getStampType).filter(Boolean))];

export const getSequence = (u) => {
    const seq = u.pet_sequence ?? u.sequence ?? u.sequence_number;
    return seq !== undefined && seq !== null && seq !== '' ? seq : '';
};

// Ascending by sequence within each PET line; pallets without a sequence go last.
export const compareBySequence = (a, b) => {
    const pet = String(getPetName(a)).localeCompare(String(getPetName(b)), undefined, { numeric: true, sensitivity: 'base' });
    if (pet !== 0) return pet;
    const na = parseInt(getSequence(a), 10);
    const nb = parseInt(getSequence(b), 10);
    const sa = Number.isNaN(na) ? Infinity : na;
    const sb = Number.isNaN(nb) ? Infinity : nb;
    if (sa === sb) return 0;
    return sa < sb ? -1 : 1;
};

export const getPacks = (u) =>
    parseInt(u.quantity, 10) ||
    parseInt(u.packs_per_pallet, 10) ||
    parseInt(u.total_packs, 10) ||
    parseInt(u.packs, 10) ||
    0;

export const toDateKey = (value) => {
    if (!value) return 'unknown';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? 'unknown' : d.toISOString().split('T')[0];
};

// Build a stable, human-readable Transfer ID from date + product + pet.
// `dateKey` is a YYYY-MM-DD string (or 'unknown').
export const buildTransferId = (dateKey, productName, petName) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey || '');
    const datePart = match ? `${match[1].slice(-2)}${match[2]}${match[3]}` : '000000';
    const petPart = (String(petName).match(/\d+/)?.[0] || '0').padStart(2, '0');
    const prodPart = String(productName).replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'PROD';
    return `TR${datePart}-${prodPart}-P${petPart}`;
};

// Production date (YYYY-MM-DD) encoded in a Transfer ID such as TR260908-RUSH-P02, or null.
export const getDateKeyFromTransferId = (transferId) => {
    const match = /^TR(\d{2})(\d{2})(\d{2})-/.exec(String(transferId || '').trim().toUpperCase().replace(/\s+/g, ''));
    if (!match || match[1] === '00') return null;
    return `20${match[1]}-${match[2]}-${match[3]}`;
};

// Document number printed on the transfer form and sent with the transfer: PD + yyMMddHHmmss.
// `withSuffix` adds two random digits, used when the server reports the code is taken.
export const buildDocumentCode = (withSuffix = false) => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${String(now.getFullYear()).slice(-2)}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    return `PD${stamp}${withSuffix ? pad(Math.floor(Math.random() * 100)) : ''}`;
};

export const normalizeTransferId = (value) => String(value || '').trim().toUpperCase().replace(/\s+/g, '');

// Transfer directions
export const DIRECTION_PRODUCTION_STAGING = 'PRODUCTION_STAGING';
export const DIRECTION_STAGING_WAREHOUSE = 'STAGING_WAREHOUSE';
export const DIRECTION_PENDING = 'PENDING';

export const DIRECTION_LABELS = {
    [DIRECTION_PRODUCTION_STAGING]: 'Production → Staging',
    [DIRECTION_STAGING_WAREHOUSE]: 'Staging → Warehouse',
    [DIRECTION_PENDING]: 'Pending (still in production)',
};

// Direction a unit has most recently moved in, based on the stage it is in now.
export const getUnitDirection = (u) => {
    const stage = getStage(u);
    if (stage === MAIN_WAREHOUSE_STAGE) return DIRECTION_STAGING_WAREHOUSE;
    if (stage === STAGING_WAREHOUSE_STAGE) return DIRECTION_PRODUCTION_STAGING;
    return DIRECTION_PENDING;
};

// Route (source -> target) the unit set still has to travel to complete a transfer.
export const getTransferRoute = (units) => {
    const stages = units.map(getStage);
    const hasProduction = stages.some((s) => s !== STAGING_WAREHOUSE_STAGE && s !== MAIN_WAREHOUSE_STAGE);
    const hasStaging = stages.some((s) => s === STAGING_WAREHOUSE_STAGE);
    if (hasProduction) {
        return { targetStage: STAGING_WAREHOUSE_STAGE, targetLabel: 'Staging Warehouse', sourceLabel: 'Production' };
    }
    if (hasStaging) {
        return { targetStage: MAIN_WAREHOUSE_STAGE, targetLabel: 'Main Warehouse', sourceLabel: 'Staging Warehouse' };
    }
    // Everything is already in the main warehouse: the staging -> main transfer is done.
    return { targetStage: MAIN_WAREHOUSE_STAGE, targetLabel: 'Main Warehouse', sourceLabel: 'Staging Warehouse' };
};

/**
 * Group units into transfers (creation date + product + PET).
 * Returns [{ key, transferId, dateKey, productName, petName, units, totalPallets, totalPacks, stageCounts }]
 */
export const groupUnitsIntoTransfers = (units) => {
    const map = {};
    (units || []).forEach((u) => {
        const dateKey = toDateKey(getCreatedAt(u));
        const productName = getProductName(u);
        const petName = getPetName(u);
        const key = `${dateKey}||${productName}||${petName}`;
        if (!map[key]) {
            map[key] = {
                key,
                dateKey,
                productName,
                petName,
                transferId: buildTransferId(dateKey, productName, petName),
                units: [],
                totalPallets: 0,
                totalPacks: 0,
                stageCounts: {},
            };
        }
        const group = map[key];
        const stage = getStage(u) || 'UNKNOWN';
        group.units.push(u);
        group.totalPallets += 1;
        group.totalPacks += getPacks(u);
        group.stageCounts[stage] = (group.stageCounts[stage] || 0) + 1;
    });
    return Object.values(map).sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1));
};

// All transfers matching a Transfer ID (exact, case/space-insensitive).
export const findTransfersById = (units, transferId) => {
    const wanted = normalizeTransferId(transferId);
    if (!wanted) return [];
    return groupUnitsIntoTransfers(units).filter((t) => normalizeTransferId(t.transferId) === wanted);
};

export const extractUnitList = (response) => {
    const data = response?.data?.data?.data || response?.data?.data || response?.data?.results || response?.data || [];
    if (Array.isArray(data)) return data;
    return data.results || data.data || [];
};
