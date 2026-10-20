import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Printer, X, CheckCircle2, Clock3 } from 'lucide-react';
import {
    compareBySequence,
    getBarcode,
    getDocumentCode,
    getDocumentCodes,
    getSupervisorNames,
    getPacks,
    getSequence,
    getStage,
    getUpdatedAt,
    toDateKey,
} from '../../utils/transferUtils';
import { loadTransferDocuments, MAIN_WAREHOUSE_STAGE, STAGING_WAREHOUSE_STAGE } from '../../api/inventory';

const formatDate = (key) => (key && key !== 'unknown' ? new Date(key).toLocaleDateString('en-GB') : '—');

/**
 * Details of a transfer (a set of pallets sharing production date + product + PET).
 *
 * transfer: { transferId, productName, petName, productionDate, units,
 *             direction?, directionLabel?, directionColor?, transferDate? }
 */
const TransferDetailModal = ({ transfer, onClose, onOpenForm }) => {
    const units = useMemo(() => [...(transfer?.units || [])].sort(compareBySequence), [transfer]);

    const unitCodes = useMemo(() => getDocumentCodes(units), [units]);
    const unitSupervisors = useMemo(() => getSupervisorNames(units), [units]);

    // Saved transfer documents (PD code, supervisors): looked up by the pallets' PD codes,
    // or by Transfer ID when the pallets do not carry one.
    const [documents, setDocuments] = useState([]);
    const [documentsLoading, setDocumentsLoading] = useState(false);
    const unitCodesKey = unitCodes.join('|');
    const transferKey = transfer?.transferId || '';
    useEffect(() => {
        if (!transferKey) return undefined;
        let cancelled = false;
        setDocuments([]);
        setDocumentsLoading(true);
        loadTransferDocuments({ codes: unitCodesKey ? unitCodesKey.split('|') : [], transferId: transferKey }).then((docs) => {
            if (cancelled) return;
            setDocuments(docs);
            setDocumentsLoading(false);
        });
        return () => { cancelled = true; };
    }, [transferKey, unitCodesKey]);

    const pdCodes = useMemo(
        () => [...new Set([...unitCodes, ...documents.map((d) => d.documentCode).filter(Boolean)])],
        [unitCodes, documents]
    );
    const supervisors = useMemo(() => {
        const merge = (fromUnits, key) => [...new Set([...fromUnits, ...documents.map((d) => d[key]).filter(Boolean)])];
        return {
            source: merge(unitSupervisors.source, 'sourceSupervisor'),
            target: merge(unitSupervisors.target, 'targetSupervisor'),
        };
    }, [unitSupervisors, documents]);

    const summary = useMemo(() => {
        const stageCounts = {};
        let packs = 0;
        let moved = 0;
        let lastMoved = '';
        units.forEach((u) => {
            const stage = getStage(u) || 'UNKNOWN';
            stageCounts[stage] = (stageCounts[stage] || 0) + 1;
            packs += getPacks(u);
            if (stage === STAGING_WAREHOUSE_STAGE || stage === MAIN_WAREHOUSE_STAGE) {
                moved += 1;
                const when = toDateKey(getUpdatedAt(u));
                if (when !== 'unknown' && when > lastMoved) lastMoved = when;
            }
        });
        return { stageCounts, packs, moved, lastMoved };
    }, [units]);

    if (!transfer) return null;

    const total = units.length;
    let status;
    if (summary.moved === 0) status = { label: 'Pending — not transferred yet', className: 'bg-warning text-dark', done: false };
    else if (summary.moved === total) status = { label: 'Transfer completed', className: 'bg-success', done: true };
    else status = { label: `Partially transferred (${summary.moved} of ${total})`, className: 'bg-info text-dark', done: false };

    return (
        <>
            <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-modal="true" onClick={onClose}>
                <div className="modal-dialog modal-lg modal-dialog-scrollable" role="document" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title d-flex align-items-center gap-2">
                                <FileText size={18} /> Transfer <code>{transfer.transferId}</code>
                            </h5>
                            <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
                        </div>
                        <div className="modal-body">
                            <div className="mb-3">
                                <span className={`badge d-inline-flex align-items-center gap-1 ${status.className}`}>
                                    {status.done ? <CheckCircle2 size={13} /> : <Clock3 size={13} />} {status.label}
                                </span>
                            </div>
                            <div className="row g-3 mb-3">
                                {transfer.directionLabel && (
                                    <div className="col-sm-6 col-md-4">
                                        <small className="text-muted d-block">Direction</small>
                                        <span className="badge" style={{ backgroundColor: transfer.directionColor }}>
                                            {transfer.directionLabel}
                                        </span>
                                    </div>
                                )}
                                <div className="col-sm-6 col-md-4"><small className="text-muted d-block">Product</small><strong>{transfer.productName}</strong></div>
                                <div className="col-sm-6 col-md-4"><small className="text-muted d-block">PET</small><strong>{transfer.petName}</strong></div>
                                <div className="col-sm-6 col-md-4"><small className="text-muted d-block">Production date</small><strong>{formatDate(transfer.productionDate)}</strong></div>
                                <div className="col-sm-6 col-md-4">
                                    <small className="text-muted d-block">Transfer date</small>
                                    <strong>{formatDate(transfer.transferDate || summary.lastMoved)}</strong>
                                </div>
                                <div className="col-sm-6 col-md-4">
                                    <small className="text-muted d-block">PD code{pdCodes.length > 1 ? 's' : ''}</small>
                                    {pdCodes.length === 0 ? <strong>{documentsLoading ? '…' : '—'}</strong> : (
                                        <div className="d-flex flex-wrap gap-1">
                                            {pdCodes.map((code) => <code key={code}>{code}</code>)}
                                        </div>
                                    )}
                                </div>
                                <div className="col-sm-6 col-md-4">
                                    <small className="text-muted d-block">Handed over by</small>
                                    <strong>{supervisors.source.length ? supervisors.source.join(', ') : (documentsLoading ? '…' : '—')}</strong>
                                </div>
                                <div className="col-sm-6 col-md-4">
                                    <small className="text-muted d-block">Received by</small>
                                    <strong>{supervisors.target.length ? supervisors.target.join(', ') : (documentsLoading ? '…' : '—')}</strong>
                                </div>
                                <div className="col-sm-6 col-md-4">
                                    <small className="text-muted d-block">Pallets / Packs</small>
                                    <strong>{total.toLocaleString()} / {summary.packs.toLocaleString()}</strong>
                                </div>
                                <div className="col-12">
                                    <small className="text-muted d-block mb-1">Pallets by stage</small>
                                    <div className="d-flex flex-wrap gap-2">
                                        {Object.entries(summary.stageCounts).map(([stage, n]) => (
                                            <span key={stage} className="badge bg-soft-primary text-primary">{stage}: {n}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            {documents.length > 0 && (
                                <>
                                    <h6 className="mb-2">Transfer documents</h6>
                                    <div className="table-responsive mb-3">
                                        <table className="table table-sm align-middle mb-0">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>PD code</th>
                                                    <th>Route</th>
                                                    <th>Handed over by</th>
                                                    <th>Received by</th>
                                                    <th>Saved</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {documents.map((doc) => (
                                                    <tr key={doc.documentCode}>
                                                        <td><code>{doc.documentCode}</code></td>
                                                        <td>{doc.sourceStage || '—'} → {doc.targetStage || '—'}</td>
                                                        <td>{doc.sourceSupervisor || '—'}</td>
                                                        <td>{doc.targetSupervisor || '—'}</td>
                                                        <td>{doc.createdAt ? new Date(doc.createdAt).toLocaleString() : '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                            <h6 className="mb-2">Pallets</h6>
                            <div className="table-responsive">
                                <table className="table table-sm table-hover align-middle mb-0">
                                    <thead className="table-light">
                                        <tr>
                                            <th>#</th>
                                            <th>Barcode</th>
                                            <th className="text-center">Sequence</th>
                                            <th>Stage</th>
                                            <th>PD code</th>
                                            <th className="text-end">Packs</th>
                                            <th>Updated</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {units.map((u, idx) => {
                                            const barcode = getBarcode(u);
                                            return (
                                                <tr key={u.id || barcode || idx}>
                                                    <td className="text-muted">{idx + 1}</td>
                                                    <td>
                                                        {barcode ? (
                                                            <Link to={`/post-production/pallets/details/${encodeURIComponent(barcode)}`}>
                                                                <code>{barcode}</code>
                                                            </Link>
                                                        ) : '—'}
                                                    </td>
                                                    <td className="text-center fw-semibold">{getSequence(u) || '—'}</td>
                                                    <td>{getStage(u) || '—'}</td>
                                                    <td>{getDocumentCode(u) ? <code>{getDocumentCode(u)}</code> : '—'}</td>
                                                    <td className="text-end">{getPacks(u).toLocaleString()}</td>
                                                    <td>{getUpdatedAt(u) ? new Date(getUpdatedAt(u)).toLocaleString() : '—'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-primary d-inline-flex align-items-center gap-2" onClick={onOpenForm}>
                                <Printer size={16} /> Open Transfer Form
                            </button>
                            <button type="button" className="btn btn-outline-secondary d-inline-flex align-items-center gap-2" onClick={onClose}>
                                <X size={16} /> Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="modal-backdrop fade show" />
        </>
    );
};

export default TransferDetailModal;
