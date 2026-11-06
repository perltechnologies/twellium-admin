import React from 'react';
import { Eye, FileText, Layers, X } from 'lucide-react';

const formatDate = (key) => (key && key !== 'unknown' ? new Date(key).toLocaleDateString('en-GB') : '—');

/**
 * All PD documents (transfer documents) saved under one Transfer ID.
 *
 * transfer: { transferId, productName, petName, dateKey, totalPallets, pdGroups }
 * pdGroups: [{ key, documentCode, units, totalPallets, totalPacks, source, target }]
 */
const TransferPdListModal = ({ transfer, onClose, onSelectPd }) => {
    if (!transfer) return null;
    const pdGroups = transfer.pdGroups || [];

    return (
        <>
            <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-modal="true" onClick={onClose}>
                <div className="modal-dialog modal-xl modal-dialog-scrollable" role="document" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title d-flex align-items-center gap-2">
                                <FileText size={18} /> Transfer <code>{transfer.transferId}</code>
                            </h5>
                            <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
                        </div>
                        <div className="modal-body">
                            <div className="row g-3 mb-3">
                                <div className="col-sm-6 col-md-3"><small className="text-muted d-block">Product</small><strong>{transfer.productName}</strong></div>
                                <div className="col-sm-6 col-md-3"><small className="text-muted d-block">PET line</small><strong>{transfer.petName}</strong></div>
                                <div className="col-sm-6 col-md-3"><small className="text-muted d-block">Production date</small><strong>{formatDate(transfer.dateKey)}</strong></div>
                                <div className="col-sm-6 col-md-3">
                                    <small className="text-muted d-block">PDs / Pallets</small>
                                    <strong>{pdGroups.length} / {transfer.totalPallets.toLocaleString()}</strong>
                                </div>
                            </div>

                            <h6 className="mb-2">PD documents</h6>
                            <div className="row g-3">
                                {pdGroups.map((pd) => (
                                    <div key={pd.key} className="col-xl-4 col-md-6">
                                        <div className="card h-100 border shadow-none">
                                            <div className="card-body">
                                                <div className="d-flex justify-content-between align-items-start mb-2">
                                                    <span className="badge bg-soft-primary text-primary">PD</span>
                                                    <span className="badge bg-primary fs-13 d-inline-flex align-items-center gap-1">
                                                        <Layers size={12} /> {pd.totalPallets}
                                                    </span>
                                                </div>
                                                <div className="fw-bold mb-2">
                                                    {pd.documentCode ? <code>{pd.documentCode}</code> : <span className="text-muted">No PD recorded</span>}
                                                </div>
                                                <div className="d-flex justify-content-between fs-13 mb-1">
                                                    <span className="text-muted">Total Pallets</span>
                                                    <span className="fw-semibold">{pd.totalPallets}</span>
                                                </div>
                                                <div className="d-flex justify-content-between fs-13 mb-1">
                                                    <span className="text-muted">Total Packs</span>
                                                    <span className="fw-semibold">{pd.totalPacks.toLocaleString()}</span>
                                                </div>
                                                {(pd.source.length > 0 || pd.target.length > 0) && (
                                                    <div className="fs-13 text-muted text-truncate" title={`${pd.source.join(', ') || '—'} → ${pd.target.join(', ') || '—'}`}>
                                                        {pd.source.join(', ') || '—'} → {pd.target.join(', ') || '—'}
                                                    </div>
                                                )}
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-primary w-100 mt-3 d-flex align-items-center justify-content-center gap-2"
                                                    onClick={() => onSelectPd(pd)}
                                                >
                                                    <Eye size={14} /> View details
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="modal-footer">
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

export default TransferPdListModal;
