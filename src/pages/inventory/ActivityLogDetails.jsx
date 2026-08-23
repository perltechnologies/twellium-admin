import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { inventoryApi } from '../../api/inventory';
import { format } from 'date-fns';
import {
    ArrowLeft, Activity, FileText, User, Clock, Package, ArrowRightLeft, Tag, Hash,
    MapPin, QrCode, Wifi, Database, AlertCircle, ChevronRight, ExternalLink
} from 'lucide-react';

const ACTION_CONFIG = {
    BARCODE_CREATION: { label: 'Barcode Creation', icon: QrCode, color: 'success', bg: 'bg-soft-success' },
    STAGE_TRANSITION: { label: 'Stage Transition', icon: ArrowRightLeft, color: 'primary', bg: 'bg-soft-primary' },
    RFID_LINKING: { label: 'RFID Linking', icon: Tag, color: 'warning', bg: 'bg-soft-warning' },
    OTHER: { label: 'Other', icon: Activity, color: 'secondary', bg: 'bg-soft-secondary' },
    PRODUCTION_GENERATE: { label: 'Production Generate', icon: Package, color: 'success', bg: 'bg-soft-success' },
    WAREHOUSE_INBOUND: { label: 'Warehouse Inbound', icon: ArrowRightLeft, color: 'primary', bg: 'bg-soft-primary' },
    WAREHOUSE_OUTBOUND: { label: 'Warehouse Outbound', icon: ArrowRightLeft, color: 'warning', bg: 'bg-soft-warning' },
    SHIPMENT_CREATE: { label: 'Shipment Create', icon: ArrowRightLeft, color: 'info', bg: 'bg-soft-info' },
    UNIT_SCAN: { label: 'Unit Scan', icon: QrCode, color: 'secondary', bg: 'bg-soft-secondary' },
};

const ActivityLogDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [log, setLog] = useState(null);
    const [unitStatus, setUnitStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [unitLoading, setUnitLoading] = useState(false);

    useEffect(() => {
        const fetchLog = async () => {
            setLoading(true);
            try {
                const response = await inventoryApi.getActivityLog(id);
                const logData = response.data?.data ?? response.data ?? {};
                setLog(logData);
                if (logData.unit_internal_id) {
                    setUnitLoading(true);
                    try {
                        const unitResponse = await inventoryApi.getUnitStatus(logData.unit_internal_id);
                        setUnitStatus(unitResponse.data?.data ?? unitResponse.data ?? {});
                    } catch (err) {
                        console.error('Failed to fetch unit status', err);
                    } finally {
                        setUnitLoading(false);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch activity log', error);
            } finally {
                setLoading(false);
            }
        };
        fetchLog();
    }, [id]);

    if (loading) {
        return (
            <div className="container-fluid">
                <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                </div>
            </div>
        );
    }

    if (!log) {
        return (
            <div className="container-fluid">
                <div className="d-flex align-items-center justify-content-between mb-4">
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate('/post-production/activity-logs')}>
                        <ArrowLeft size={14} className="me-1" />Back to Logs
                    </button>
                </div>
                <div className="card">
                    <div className="card-body text-center py-5">
                        <AlertCircle size={48} className="text-warning mb-3" />
                        <h5 className="text-muted">Activity log not found</h5>
                    </div>
                </div>
            </div>
        );
    }

    const config = ACTION_CONFIG[log.activity_type] || ACTION_CONFIG.OTHER;
    const Icon = config.icon;
    const metadata = log.metadata || {};

    const getInitials = (name) => {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const MetaField = ({ icon: IconComp, label, value }) => (
        <div className="d-flex align-items-center gap-3 py-2" style={{ borderBottom: '1px solid #f1f5f9' }}>
            <div className="text-muted"><IconComp size={16} /></div>
            <div className="flex-grow-1">
                <small className="text-muted d-block">{label}</small>
                <span className="fw-medium">{value || '—'}</span>
            </div>
        </div>
    );

    return (
        <div className="container-fluid">
            {/* Breadcrumb */}
            <div className="d-flex align-items-center gap-2 mb-4">
                <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate('/post-production/activity-logs')}>
                    <ArrowLeft size={14} className="me-1" />Back to Logs
                </button>
                <ChevronRight size={14} className="text-muted" />
                <span className="text-muted small">Activity Log</span>
                <ChevronRight size={14} className="text-muted" />
                <span className="fw-medium small">#{log.id}</span>
            </div>

            {/* Header Card */}
            <div className="card mb-4">
                <div className="card-body">
                    <div className="d-flex align-items-center gap-3">
                        <div className={`avatar avatar-lg ${config.bg} rounded-circle d-flex align-items-center justify-content-center`}>
                            <Icon size={24} />
                        </div>
                        <div className="flex-grow-1">
                            <h5 className="mb-1">{config.label}</h5>
                            <p className="text-muted mb-0 small">{log.description}</p>
                        </div>
                        <div className="text-end">
                            <div className="small fw-medium">{log.timestamp ? format(new Date(log.timestamp), 'dd MMM yyyy') : '—'}</div>
                            <div className="small text-muted">{log.timestamp ? format(new Date(log.timestamp), 'HH:mm:ss') : ''}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="row g-4">
                {/* Activity Details */}
                <div className="col-lg-5">
                    <div className="card h-100">
                        <div className="card-header">
                            <h6 className="mb-0"><Activity size={16} className="me-2" />Activity Details</h6>
                        </div>
                        <div className="card-body">
                            <MetaField icon={Hash} label="Log ID" value={`#${log.id}`} />
                            <MetaField icon={User} label="Performed By" value={log.performed_by_name} />
                            <MetaField icon={Clock} label="Timestamp" value={log.timestamp ? format(new Date(log.timestamp), 'dd MMM yyyy HH:mm:ss') : ''} />
                            <MetaField icon={FileText} label="Description" value={log.description} />
                            <MetaField icon={Activity} label="Type" value={
                                <span className={`badge ${config.bg} ${config.text.replace('text-', 'text-')}`}>{config.label}</span>
                            } />
                        </div>
                    </div>
                </div>

                {/* Metadata */}
                <div className="col-lg-7">
                    <div className="card h-100">
                        <div className="card-header">
                            <h6 className="mb-0"><Database size={16} className="me-2" />Metadata</h6>
                        </div>
                        <div className="card-body">
                            <div className="row g-0">
                                <div className="col-md-6">
                                    <MetaField icon={ArrowRightLeft} label="From Stage" value={metadata.from_stage} />
                                    <MetaField icon={MapPin} label="Location" value={metadata.location} />
                                    <MetaField icon={QrCode} label="Barcode" value={metadata.barcode} />
                                    <MetaField icon={Hash} label="Session ID" value={<small className="text-monospace text-muted">{metadata.session_id}</small>} />
                                </div>
                                <div className="col-md-6">
                                    <MetaField icon={ArrowRightLeft} label="To Stage" value={metadata.to_stage} />
                                    <MetaField icon={Package} label="Quantity" value={metadata.quantity} />
                                    <MetaField icon={Wifi} label="RFID Number" value={metadata.rfid_number} />
                                    <MetaField icon={FileText} label="Trigger Method" value={metadata.trigger_method} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Unit Intelligence */}
            {log.unit_internal_id && (
                <div className="card mt-4">
                    <div className="card-header">
                        <h6 className="mb-0">
                            <Package size={16} className="me-2" />Unit Intelligence
                            {log.unit_internal_id && (
                                <span className="badge bg-soft-primary ms-2">
                                    <code className="small">{log.unit_internal_id}</code>
                                </span>
                            )}
                        </h6>
                    </div>
                    <div className="card-body">
                        {unitLoading ? (
                            <div className="text-center py-4">
                                <div className="spinner-border spinner-border-sm text-primary" role="status">
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                                <span className="ms-2 text-muted small">Loading unit data...</span>
                            </div>
                        ) : unitStatus ? (
                            <>
                                {/* Unit Summary Cards */}
                                <div className="row g-3 mb-4">
                                    <div className="col-md-4">
                                        <div className="p-3 bg-light rounded">
                                            <div className="d-flex align-items-center gap-2 mb-2">
                                                <Package size={14} className="text-muted" />
                                                <small className="text-muted">Product</small>
                                            </div>
                                            <strong className="d-block">{unitStatus.product_name || '—'}</strong>
                                        </div>
                                    </div>
                                    <div className="col-md-4">
                                        <div className="p-3 bg-light rounded">
                                            <div className="d-flex align-items-center gap-2 mb-2">
                                                <MapPin size={14} className="text-muted" />
                                                <small className="text-muted">Warehouse</small>
                                            </div>
                                            <strong className="d-block">{unitStatus.current_warehouse_name || '—'}</strong>
                                        </div>
                                    </div>
                                    <div className="col-md-4">
                                        <div className="p-3 bg-light rounded">
                                            <div className="d-flex align-items-center gap-2 mb-2">
                                                <Hash size={14} className="text-muted" />
                                                <small className="text-muted">Quantity</small>
                                            </div>
                                            <strong className="d-block">{unitStatus.quantity ?? '—'}</strong>
                                        </div>
                                    </div>
                                </div>

                                {/* Barcode & RFID */}
                                <div className="row mb-4">
                                    <div className="col-md-6">
                                        <div className="d-flex align-items-center gap-2">
                                            <QrCode size={16} className="text-muted" />
                                            <strong>Barcode:</strong>
                                            <code className="small">{unitStatus.barcode || unitStatus.current_barcode || '—'}</code>
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <div className="d-flex align-items-center gap-2">
                                            <Wifi size={16} className="text-muted" />
                                            <strong>RFID:</strong>
                                            <code className="small">{unitStatus.rfid_number || '—'}</code>
                                        </div>
                                    </div>
                                </div>

                                {/* History */}
                                {unitStatus.history && unitStatus.history.length > 0 && (
                                    <div>
                                        <h6 className="mb-3"><Clock size={16} className="me-2" />Recent History</h6>
                                        <div className="list-group">
                                            {unitStatus.history.map((item, index) => {
                                                const histConfig = ACTION_CONFIG[item.activity_type || item.action] || ACTION_CONFIG.OTHER;
                                                const HistIcon = histConfig.icon;
                                                return (
                                                    <div key={index} className="list-group-item list-group-item-action d-flex justify-content-between align-items-center py-2"
                                                        style={{ cursor: 'pointer' }}
                                                        onClick={() => { if (item.id) navigate(`/post-production/activity-logs/${item.id}`); }}>
                                                        <div className="d-flex align-items-center gap-3">
                                                            <div className={`avatar avatar-xs ${histConfig.bg} rounded-circle d-flex align-items-center justify-content-center`}>
                                                                <HistIcon size={12} />
                                                            </div>
                                                            <div>
                                                                <span className={`badge ${histConfig.bg} me-2`}>{histConfig.label}</span>
                                                                <span className="small">{item.description}</span>
                                                            </div>
                                                        </div>
                                                        <div className="d-flex align-items-center gap-2">
                                                            <small className="text-muted">{item.timestamp ? format(new Date(item.timestamp), 'dd MMM HH:mm') : ''}</small>
                                                            {item.id && <ExternalLink size={12} className="text-muted" />}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <p className="text-muted mb-0">Unable to load unit intelligence data.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ActivityLogDetails;
