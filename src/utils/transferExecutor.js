import {
    DOCUMENT_SAVING_OFF_MESSAGE,
    SAVE_TRANSFER_DOCUMENT,
    getScanDocumentEcho,
    inventoryApi,
    scanMovedAnyPallet,
} from '../api/inventory';
import { buildDocumentCode } from './transferUtils';

// Pallets are sent to the scan endpoint in chunks so one huge request cannot time out.
export const SCAN_CHUNK_SIZE = 100;

export const scanValueOf = (u) => u.current_barcode || u.barcode || u.rfid_number || '';

/**
 * Moves pallets to `targetStage` and saves the transfer document (PD code, Transfer ID,
 * supervisors) with them. The document is mandatory: if the server refuses it nothing
 * further is sent, and if it moved pallets without confirming the document that is
 * reported as `documentIssue`.
 *
 * Returns { documentCode, documentIssue, failed: [{ scan_value, error }], succeeded, moved, total };
 * `succeeded` lists the moved pallets (null if the server gave no per-pallet results).
 */
export const executeTransfer = async ({
    scanValues,
    targetStage,
    documentCode,
    transferId,
    sourceSupervisor,
    targetSupervisor,
    onProgress,
}) => {
    if (!SAVE_TRANSFER_DOCUMENT) {
        return { documentCode, documentIssue: DOCUMENT_SAVING_OFF_MESSAGE, failed: [], moved: 0, total: scanValues.length, notStarted: true };
    }

    let activeCode = documentCode;
    let documentIssue = '';
    const failed = [];
    const succeeded = [];
    let detailed = true; // every chunk reported per-pallet results

    for (let i = 0; i < scanValues.length; i += SCAN_CHUNK_SIZE) {
        const chunk = scanValues.slice(i, i + SCAN_CHUNK_SIZE);
        if (documentIssue) {
            chunk.forEach((scan_value) => failed.push({ scan_value, error: 'Not sent: the transfer document could not be saved.' }));
            continue;
        }
        onProgress?.({ done: i, total: scanValues.length });

        const send = (code) => inventoryApi.completeTransfer({
            scan_values: chunk,
            target_stage: targetStage,
            extra: {
                document_code: code,
                transfer_id: transferId || undefined,
                source_supervisor: Number(sourceSupervisor),
                target_supervisor: Number(targetSupervisor),
            },
        });

        let res;
        try {
            try {
                res = await send(activeCode);
            } catch (sendError) {
                const status = sendError?.response?.status;
                if (status === 409 && i === 0) {
                    // The code belongs to another transfer: take a fresh one once.
                    activeCode = buildDocumentCode(true);
                    res = await send(activeCode);
                } else {
                    if (status === 400 || status === 409) {
                        const message = sendError.response?.data?.message;
                        documentIssue = `The server rejected the document details${message ? `: ${message}` : '.'}`;
                    }
                    throw sendError;
                }
            }
        } catch (chunkError) {
            const message = chunkError?.response?.data?.message || chunkError?.message || 'Request failed';
            chunk.forEach((scan_value) => failed.push({ scan_value, error: message }));
            continue;
        }

        if (scanMovedAnyPallet(res) && getScanDocumentEcho(res) !== String(activeCode).toUpperCase()) {
            documentIssue = 'Pallets were moved, but the server did not confirm saving the document (no document_code in its response). Do not repeat the transfer; ask the administrator to check the backend.';
            console.warn('Scan response did not echo document_code', { sent: activeCode, response: res?.data });
        }

        // BatchScanResponse: { success, total_processed, results: [{ scan_value, success, error }], message }.
        const result = res?.data?.data ?? res?.data ?? {};
        const results = Array.isArray(result.results) ? result.results : [];
        const chunkFailed = results.filter((r) => r && (r.success === false || r.error));
        if (results.length === 0) detailed = false;
        results
            .filter((r) => r && r.success !== false && !r.error)
            .forEach((r) => succeeded.push({ scan_value: r.scan_value, unit_id: r.unit_id, new_barcode: r.new_barcode }));
        if (result.success === false && chunkFailed.length === 0) {
            const message = result.message || 'The transfer was rejected.';
            chunk.forEach((scan_value) => failed.push({ scan_value, error: message }));
        } else {
            chunkFailed.forEach((f) => failed.push({ scan_value: f.scan_value, error: f.error }));
        }
    }

    onProgress?.({ done: scanValues.length, total: scanValues.length });
    return {
        documentCode: activeCode,
        documentIssue,
        failed,
        succeeded: detailed ? succeeded : null,
        moved: scanValues.length - failed.length,
        total: scanValues.length,
    };
};
