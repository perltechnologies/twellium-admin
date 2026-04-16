import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, Activity, AlertTriangle, Layers, User, Box, Package } from 'lucide-react';
import { DataTable, Card } from '../../components/ui';
import { productionApi } from '../../api/production';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList
} from 'recharts';
import { useTheme } from '../../context/ThemeContext';

// OEE Circular Gauge Component
const OEECircularGauge = ({ title, value, color }) => (
    <div className="card h-100">
        <div className="card-header">
            <h6 className="mb-0">{title}</h6>
        </div>
        <div className="card-body d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '300px' }}>
            <div className="position-relative" style={{ width: '200px', height: '200px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={[
                                { name: title, value: value },
                                { name: 'Remaining', value: 100 - value }
                            ]}
                            cx="50%"
                            cy="50%"
                            startAngle={90}
                            endAngle={-270}
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={0}
                            dataKey="value"
                            stroke="none"
                        >
                            <Cell fill={color} />
                            <Cell fill="#e9ecef" />
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
                <div className="position-absolute top-50 start-50 translate-middle text-center">
                    <h2 className="mb-0 fw-bold" style={{ color: color }}>{value}%</h2>
                    <small className="text-muted text-uppercase">{title}</small>
                </div>
            </div>
        </div>
    </div>
);

const statCardColorMap = {
    success: { bg: 'var(--success-transparent)', border: 'var(--success)', text: 'var(--success)', decorImg: '/img/icons/elemnt-02.svg' },
    primary: { bg: 'var(--primary-transparent)', border: 'var(--primary)', text: 'var(--primary)', decorImg: '/img/icons/elemnt-01.svg' },
    info: { bg: 'var(--info-transparent)', border: 'var(--info)', text: 'var(--info)', decorImg: '/img/icons/elemnt-01.svg' },
    indigo: { bg: 'var(--indigo-transparent)', border: 'var(--indigo)', text: 'var(--indigo)', decorImg: '/img/icons/elemnt-01.svg' },
    warning: { bg: 'var(--warning-transparent)', border: 'var(--warning)', text: 'var(--warning)', decorImg: '/img/icons/elemnt-03.svg' },
    danger: { bg: 'var(--danger-transparent)', border: 'var(--danger)', text: 'var(--danger)', decorImg: '/img/icons/elemnt-04.svg' },
};

const StatCard = ({ title, value, icon: Icon, cardColor }) => {
    const c = statCardColorMap[cardColor] || statCardColorMap.primary;
    return (
        <div className="card position-relative overflow-hidden mb-0">
            <div className="card-body p-4 position-relative" style={{ zIndex: 1 }}>
                <div className="d-flex align-items-start justify-content-between">
                    <div>
                        <p className="text-muted small mb-1">{title}</p>
                        <h5 className="mb-0 fw-semibold">{value}</h5>
                    </div>
                    <span
                        className="d-inline-flex align-items-center justify-content-center rounded-circle border"
                        style={{ backgroundColor: c.bg, borderColor: c.border, width: '40px', height: '40px' }}
                    >
                        <Icon className="h-4 w-4" style={{ color: c.text }} />
                    </span>
                </div>
            </div>
            <img src={c.decorImg} alt="" className="position-absolute top-0 start-0" style={{ width: 'auto', height: 'auto' }} />
        </div>
    );
};

const DetailRow = ({ label, value }) => (
    <div className="py-2 border-bottom">
        <small className="text-muted d-block text-uppercase">{label}</small>
        <span className="fw-medium">{value !== null && value !== undefined ? value : '-'}</span>
    </div>
);

const SectionHeader = ({ title, icon: Icon }) => (
    <div className="d-flex align-items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-primary" />
        <h6 className="mb-0 text-uppercase fw-bold small">{title}</h6>
    </div>
);

const MaterialsView = ({ materials }) => {
    if (!materials || materials.length === 0) return <div className="text-muted text-center py-5">No materials recorded</div>;

    return (
        <div className="vstack gap-4">
            {materials.map((group, groupIdx) => (
                <div key={groupIdx}>
                    <div className="d-flex align-items-center gap-2 border-bottom pb-2 mb-3">
                        {group.material_type === 'Petline' ? (
                            <Layers className="h-5 w-5 text-primary" />
                        ) : (
                            <Box className="h-5 w-5 text-warning" />
                        )}
                        <h5 className="mb-0 fw-semibold">
                            {group.material_type} Materials
                        </h5>
                    </div>

                    {group.material_type === 'Petline' && (
                        <PetlineMaterialsGroup items={group.data} />
                    )}
                </div>
            ))}
        </div>
    );
};

const PetlineMaterialsGroup = ({ items }) => {
    const groups = {
        preform: items.filter(i => i.petline_type === 'preform').map(i => i.data),
        caps: items.filter(i => i.petline_type === 'caps').map(i => i.data),
        labels: items.filter(i => i.petline_type === 'labels').map(i => i.data),
        shrink: items.filter(i => i.petline_type === 'shrink').map(i => i.data),
    };

    return (
        <div className="vstack gap-4">
            {/* Preforms */}
            {groups.preform.length > 0 && (
                <div className="card border shadow-sm">
                    <div className="card-header bg-light border-bottom">
                        <h6 className="mb-0 text-dark fw-semibold">Preforms</h6>
                    </div>
                    <div className="card-body p-0">
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead className="bg-light">
                                    <tr>
                                        <th className="fw-semibold text-muted">Batch #</th>
                                        <th className="fw-semibold text-muted">Cage #</th>
                                        <th className="fw-semibold text-muted">Size</th>
                                        <th className="fw-semibold text-muted">Color</th>
                                        <th className="fw-semibold text-muted">Supplier</th>
                                        <th className="fw-semibold text-muted text-end">Qty/Cage</th>
                                        <th className="fw-semibold text-muted">Infeed Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {groups.preform.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="fw-medium">{item.batch_number || '-'}</td>
                                            <td><span className="badge bg-light text-dark border">{item.cage_number || '-'}</span></td>
                                            <td>{item.preform_size_value ? `${item.preform_size_value}g` : '-'}</td>
                                            <td><span className="badge bg-light text-dark border">{item.preform_color_name || '-'}</span></td>
                                            <td className="text-muted">{item.supplier_name || '-'}</td>
                                            <td className="text-end">{item.quantity_per_cage_value?.toLocaleString() || '-'}</td>
                                            <td className="text-muted small">{item.material_infeed_time || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Caps */}
            {groups.caps.length > 0 && (
                <div className="card border shadow-sm">
                    <div className="card-header bg-light border-bottom">
                        <h6 className="mb-0 text-dark fw-semibold">Caps</h6>
                    </div>
                    <div className="card-body p-0">
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead className="bg-light">
                                    <tr>
                                        <th className="fw-semibold text-muted">Batch #</th>
                                        <th className="fw-semibold text-muted">Box #</th>
                                        <th className="fw-semibold text-muted">Type</th>
                                        <th className="fw-semibold text-muted">Color</th>
                                        <th className="fw-semibold text-muted">Supplier</th>
                                        <th className="fw-semibold text-muted text-end">Qty/Box</th>
                                        <th className="fw-semibold text-muted">Infeed Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {groups.caps.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="fw-medium">{item.batch_number || '-'}</td>
                                            <td><span className="badge bg-light text-dark border">{item.box_number || '-'}</span></td>
                                            <td>{item.cap_type_name || '-'}</td>
                                            <td><span className="badge bg-light text-dark border">{item.cap_color_name || '-'}</span></td>
                                            <td className="text-muted">{item.supplier_name || '-'}</td>
                                            <td className="text-end">{item.quantity_per_box_value?.toLocaleString() || '-'}</td>
                                            <td className="text-muted small">{item.material_infeed_time || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Labels */}
            {groups.labels.length > 0 && (
                <div className="card border shadow-sm">
                    <div className="card-header bg-light border-bottom">
                        <h6 className="mb-0 text-dark fw-semibold">Labels / Sleeves</h6>
                    </div>
                    <div className="card-body p-0">
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead className="bg-light">
                                    <tr>
                                        <th className="fw-semibold text-muted">Batch #</th>
                                        <th className="fw-semibold text-muted">Roll #</th>
                                        <th className="fw-semibold text-muted">Name</th>
                                        <th className="fw-semibold text-muted">Size</th>
                                        <th className="fw-semibold text-muted text-end">Net Weight</th>
                                        <th className="fw-semibold text-muted">Supplier</th>
                                        <th className="fw-semibold text-muted">Infeed Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {groups.labels.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="fw-medium">{item.batch_number || '-'}</td>
                                            <td><span className="badge bg-light text-dark border">{item.roll_number || '-'}</span></td>
                                            <td>{item.label_sleeve_name_value || '-'}</td>
                                            <td><span className="badge bg-light text-dark border">{item.product_size_name || '-'}</span></td>
                                            <td className="text-end">{item.roll_net_weight ? `${item.roll_net_weight} kg` : '-'}</td>
                                            <td className="text-muted">{item.supplier_name || '-'}</td>
                                            <td className="text-muted small">{item.material_infeed_time || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Shrink */}
            {groups.shrink.length > 0 && (
                <div className="card border shadow-sm">
                    <div className="card-header bg-light border-bottom">
                        <h6 className="mb-0 text-dark fw-semibold">Shrink Wrap</h6>
                    </div>
                    <div className="card-body p-0">
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead className="bg-light">
                                    <tr>
                                        <th className="fw-semibold text-muted">Batch #</th>
                                        <th className="fw-semibold text-muted">Roll #</th>
                                        <th className="fw-semibold text-muted">Name</th>
                                        <th className="fw-semibold text-muted">Pack Size</th>
                                        <th className="fw-semibold text-muted text-end">Net Weight</th>
                                        <th className="fw-semibold text-muted">Supplier</th>
                                        <th className="fw-semibold text-muted">Infeed Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {groups.shrink.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="fw-medium">{item.batch_number || '-'}</td>
                                            <td><span className="badge bg-light text-dark border">{item.roll_number || '-'}</span></td>
                                            <td>{item.shrink_name_value || '-'}</td>
                                            <td><span className="badge bg-light text-dark border">{item.pack_size_name || '-'}</span></td>
                                            <td className="text-end">{item.roll_net_weight ? `${item.roll_net_weight} kg` : '-'}</td>
                                            <td className="text-muted">{item.supplier_name || '-'}</td>
                                            <td className="text-muted small">{item.material_infeed_time || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


const StoppageLogsView = ({ logs }) => {
    if (!logs || logs.length === 0) return <div className="text-muted text-center py-5">No stoppage logs recorded</div>;

    return (
        <div className="vstack gap-3">
            {logs.map((log) => (
                <div key={log.id} className="card border">
                    {/* Header Summary */}
                    <div className="card-header bg-light">
                        <div className="row g-3">
                            <div className="col-md">
                                <small className="text-muted text-uppercase d-block mb-1">Hour</small>
                                <div className="d-flex align-items-center gap-2">
                                    <Clock className="h-3 w-3 text-muted" />
                                    <span className="fw-medium">Hour {log.hour_index}</span>
                                </div>
                                <small className="text-muted ms-4">{log.log_time}</small>
                            </div>
                            <div className="col-md">
                                <small className="text-muted text-uppercase d-block mb-1">Efficiency</small>
                                <div className="d-flex align-items-center gap-2">
                                    <Activity className="h-3 w-3 text-success" />
                                    <span className="fw-medium text-success">{log.efficiency}%</span>
                                </div>
                            </div>
                            <div className="col-md">
                                <small className="text-muted text-uppercase d-block mb-1">Downtime</small>
                                <div className="d-flex align-items-center gap-2">
                                    <AlertTriangle className="h-3 w-3 text-warning" />
                                    <span className="fw-medium text-warning">{log.downtime_minutes} min</span>
                                </div>
                            </div>
                            <div className="col-md">
                                <small className="text-muted text-uppercase d-block mb-1">Output</small>
                                <div className="d-flex align-items-center gap-2">
                                    <Layers className="h-3 w-3 text-primary" />
                                    <span className="fw-medium text-primary">{log.bottles_produced?.toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="col-md">
                                <small className="text-muted text-uppercase d-block mb-1">Logged By</small>
                                <div className="d-flex align-items-center gap-2">
                                    <User className="h-3 w-3 text-muted" />
                                    <span className="small text-truncate" style={{ maxWidth: '100px' }} title={log.created_by?.full_name}>
                                        {log.created_by?.full_name || log.created_by?.username}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Details & Incidents */}
                    <div className="card-body">
                        {log.comments && (
                            <div className="alert alert-info small mb-3">
                                <strong className="text-uppercase small me-2">Comments:</strong>
                                {log.comments}
                            </div>
                        )}

                        {log.incidents && log.incidents.length > 0 ? (
                            <div>
                                <h6 className="text-muted text-uppercase small fw-bold mb-2 d-flex align-items-center gap-2">
                                    <AlertTriangle className="h-3 w-3" />
                                    Incidents
                                </h6>
                                <div className="vstack gap-2">
                                    {log.incidents.map((inc, i) => (
                                        <div key={i} className="bg-white p-2 rounded border small d-flex align-items-start gap-2">
                                            <span className="text-muted">•</span>
                                            <div>
                                                <strong>{inc.incident_category_name || 'Uncategorized'}:</strong>
                                                {' '}{inc.incident_description}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <p className="text-muted small fst-italic mb-0">No incidents recorded for this period.</p>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

const StoppageTimeline = ({ logs }) => {
    if (!logs || logs.length === 0) return null;

    return (
        <div className="card mb-4">
            <div className="card-header bg-soft-primary">
                <h6 className="mb-0 d-flex align-items-center gap-2 text-primary">
                    <Clock className="h-4 w-4" />
                    Stoppage Event Timeline
                </h6>
            </div>
            <div className="card-body">
                <div className="position-relative border-start border-2 border-primary ms-3 ps-4">
                    {logs.slice().sort((a, b) => (a.hour_index - b.hour_index)).map((log, idx) => (
                        <div key={idx} className="position-relative mb-4">
                            {/* Dot */}
                            <div className="position-absolute bg-primary rounded-circle border border-4 border-white" 
                                 style={{ left: '-42px', top: '4px', width: '20px', height: '20px' }} />

                            <div className="card border">
                                <div className="card-body p-3">
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <div>
                                            <h6 className="mb-0 fw-bold d-flex align-items-center gap-2">
                                                Hour {log.hour_index}
                                                {log.minute_index != null && <span className="text-muted fw-normal">:{String(log.minute_index).padStart(2, '0')}</span>}
                                            </h6>
                                            <small className="text-muted">{log.downtime_minutes} min downtime</small>
                                        </div>
                                        <span className={`badge ${parseFloat(log.efficiency) >= 80 ? 'bg-soft-success text-success' : 'bg-soft-warning text-warning'}`}>
                                            {log.efficiency}% Eff
                                        </span>
                                    </div>

                                    {/* Incidents */}
                                    {log.incidents && log.incidents.length > 0 ? (
                                        <div className="vstack gap-2 mt-3">
                                            {log.incidents.map((inc, i) => (
                                                <div key={i} className="d-flex gap-2 align-items-start justify-content-between small p-2 bg-light rounded border">
                                                    <div className="d-flex gap-2 align-items-start flex-grow-1">
                                                        <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-1" />
                                                        <div>
                                                            <p className="mb-0 fw-medium">
                                                                {inc.downtime_category_name || 'Uncategorized'}
                                                                {inc.sub_downtime_category_name && <span className="text-muted fw-normal"> / {inc.sub_downtime_category_name}</span>}
                                                            </p>
                                                            <p className="mb-0 text-muted small">{inc.incident_description}</p>
                                                        </div>
                                                    </div>
                                                    {inc.incident_duration && (
                                                        <span className="badge bg-soft-warning text-warning flex-shrink-0">
                                                            {inc.incident_duration} min
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        log.downtime_minutes > 0 && <p className="text-muted small fst-italic mb-0 mt-2">No specific incidents logged. ({log.comments})</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const MeterReadingsView = ({ productionReadings, syrupReadings, co2Readings }) => {
    const [activeReadingTab, setActiveReadingTab] = useState('production');

    const ReadingCard = ({ title, data, fields }) => {
        if (!data) {
            return (
                <div className="text-center py-5 text-muted">
                    <p className="small mb-0">No {title} data recorded</p>
                </div>
            );
        }

        return (
            <div>
                <div className="row g-3">
                    {fields.map((field) => (
                        <div key={field.key} className="col-md-4">
                            <div className="bg-light p-3 rounded border">
                                <small className="text-muted text-uppercase d-block mb-1">{field.label}</small>
                                <span className="fw-medium">
                                    {data[field.key] !== null && data[field.key] !== undefined ? data[field.key] : '-'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
                {data.remarks && (
                    <div className="mt-3 bg-light p-3 rounded border">
                        <small className="text-muted text-uppercase d-block mb-1">Remarks</small>
                        <p className="mb-0 small">{data.remarks}</p>
                    </div>
                )}
            </div>
        );
    };

    const productionFields = [
        { key: 'start_reading', label: 'Start Reading' },
        { key: 'end_reading', label: 'End Reading' },
        { key: 'reading_difference', label: 'Difference' },
        { key: 'total_consumed', label: 'Total Consumed' },
        { key: 'filler_reading', label: 'Filler Reading' },
        { key: 'filler_rejects', label: 'Filler Rejects' },
        { key: 'blower_rejects', label: 'Blower Rejects' },
        { key: 'shrink_reading', label: 'Shrink Reading' },
        { key: 'shrink_reading_packs_percent', label: 'Shrink %' },
    ];

    const syrupFields = [
        { key: 'start_reading', label: 'Start Reading' },
        { key: 'end_reading', label: 'End Reading' },
        { key: 'reading_difference', label: 'Difference' },
        { key: 'total_consumed', label: 'Total Consumed' },
        { key: 'total_syrup_used_liters', label: 'Syrup Used (L)' },
        { key: 'std_syrup_consumption', label: 'Std Consumption' },
        { key: 'syrup_yield_percentage', label: 'Yield %' },
        { key: 'syrup_density', label: 'Density' },
        { key: 'dilution_ratio', label: 'Dilution Ratio' },
        { key: 'syrup_dilution_ratio', label: 'Syrup DR' },
    ];

    const co2Fields = [
        { key: 'start_reading', label: 'Start Reading' },
        { key: 'end_reading', label: 'End Reading' },
        { key: 'reading_difference', label: 'Difference' },
        { key: 'total_consumed', label: 'Total Consumed' },
        { key: 'total_co2_consumed_kg', label: 'CO2 Consumed (kg)' },
        { key: 'std_co2_consumed_kg', label: 'Std CO2 (kg)' },
        { key: 'co2_yield_percentage', label: 'CO2 Yield %' },
        { key: 'dilution_ratio', label: 'Dilution Ratio' },
        { key: 'yield_percentage', label: 'Yield %' },
    ];

    const readingTabs = [
        { id: 'production', label: 'Production', data: productionReadings, fields: productionFields },
        { id: 'syrup', label: 'Syrup', data: syrupReadings, fields: syrupFields },
        { id: 'co2', label: 'CO2', data: co2Readings, fields: co2Fields },
    ];

    return (
        <div className="space-y-4">
            {/* Segmented Control */}
            <div className="btn-group mb-3" role="group">
                {readingTabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveReadingTab(tab.id)}
                        className={`btn ${activeReadingTab === tab.id ? 'btn-primary' : 'btn-outline-primary'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Reading Content */}
            {readingTabs.map((tab) => (
                activeReadingTab === tab.id && (
                    <ReadingCard
                        key={tab.id}
                        title={tab.label}
                        data={tab.data}
                        fields={tab.fields}
                    />
                )
            ))}
        </div>
    );
};

const ReportDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [report, setReport] = useState(null);
    const [shiftData, setShiftData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('batches');

    useEffect(() => {
        const fetchReport = async () => {
            try {
                const res = await productionApi.getReport(id);
                const data = res.data.data;
                setReport(data);
                if (data.shift) {
                    const shiftRes = await productionApi.getShift(data.shift);
                    setShiftData(shiftRes.data.data || shiftRes.data);
                }
            } catch (err) {
                console.error("Failed to load report", err);
            } finally {
                setLoading(false);
            }
        };
        fetchReport();
    }, [id]);

    // Calculate Stats & Chart Data
    const calculateStats = () => {
        if (!report) return { efficiencyData: [], downtimeData: [], totalDowntime: 0, totalOutput: 0, productionTime: 0, efficiency: 0 };

        let totalEfficiency = 0;
        let logCount = 0;
        let totalDowntimeSum = 0;
        let totalDowntime = 0;
        let totalOutput = 0;
        const categoryMap = {};
        let plannedDowntime = 0;
        let mechanicalDowntime = 0;

        // Stoppage Logs Processing
        if (report.stoppage_logs && report.stoppage_logs.length > 0) {
            report.stoppage_logs.forEach((log) => {
                // Efficiency
                const eff = parseFloat(log.efficiency);
                if (!isNaN(eff)) {
                    totalEfficiency += eff;
                    logCount++;
                }
                const minutes = log.downtime_minutes || 0;
                // Accumulate sum for average calculation
                totalDowntimeSum += minutes;

                // Bottles
                if (log.bottles_produced) {
                    totalOutput += (parseInt(log.bottles_produced) || 0);
                }

                // Downtime Breakdown
                if (log.incidents && log.incidents.length > 0) {
                    log.incidents.forEach(inc => {
                        const catName = inc.downtime_category_name || 'Uncategorized';
                        
                        // Parse incident_duration (could be "HH:MM:SS" or number)
                        let durationMinutes = 0;
                        if (inc.incident_duration) {
                            if (typeof inc.incident_duration === 'string' && inc.incident_duration.includes(':')) {
                                // Parse time string "HH:MM:SS" or "HH:MM"
                                const parts = inc.incident_duration.split(':');
                                const hours = parseInt(parts[0]) || 0;
                                const mins = parseInt(parts[1]) || 0;
                                const secs = parts[2] ? parseInt(parts[2]) || 0 : 0;
                                durationMinutes = (hours * 60) + mins + (secs / 60);
                            } else {
                                durationMinutes = parseFloat(inc.incident_duration) || 0;
                            }
                        }
                        
                        if (!categoryMap[catName]) categoryMap[catName] = 0;
                        categoryMap[catName] += durationMinutes;

                        // Check for Planned Downtime
                        if (catName.toLowerCase().includes('planned')) {
                            plannedDowntime += durationMinutes;
                        }
                        // Check for Mechanical Downtime
                        if (catName.toLowerCase().includes('mechanical')) {
                            mechanicalDowntime += durationMinutes;
                        }
                    });
                } else if (minutes > 0) {
                    if (!categoryMap['Unspecified']) categoryMap['Unspecified'] = 0;
                    categoryMap['Unspecified'] += minutes;
                }
            });


            totalDowntime = totalDowntimeSum;
        }



        const avgEff = logCount > 0 ? totalEfficiency / logCount : 0;
        const effVal = Math.min(Math.max(avgEff, 0), 100);

        // Use API OEE when available, fall back to averaged stoppage efficiency
        const apiOee = report.metrics?.oee;
        const parsedEff = parseFloat(report.efficiency);
        const oeeVal = apiOee != null ? apiOee : !isNaN(parsedEff) ? parsedEff : effVal;
        const clampedOee = Math.min(Math.max(oeeVal || 0, 0), 100);

        let productionTime = 0;
        if (report.metrics?.details?.planned_time_mins > 0) {
            productionTime = (report.metrics.details.planned_time_mins / 60).toFixed(1);
        } else if (shiftData?.start_time && shiftData?.end_time) {
            const [sh, sm] = shiftData.start_time.slice(0, 5).split(':').map(Number);
            const [eh, em] = shiftData.end_time.slice(0, 5).split(':').map(Number);
            let mins = (eh * 60 + em) - (sh * 60 + sm);
            if (mins <= 0) mins += 24 * 60;
            productionTime = (mins / 60).toFixed(1);
        } else if (report.user_defined_shift_start_time && report.user_defined_shift_end_time) {
            const [sh, sm] = report.user_defined_shift_start_time.split(':').map(Number);
            const [eh, em] = report.user_defined_shift_end_time.split(':').map(Number);
            let mins = (eh * 60 + em) - (sh * 60 + sm);
            if (mins <= 0) mins += 24 * 60;
            productionTime = (mins / 60).toFixed(1);
        } else if (report.total_production_time_hours && parseFloat(report.total_production_time_hours) > 0) {
            productionTime = parseFloat(report.total_production_time_hours);
        } else if (report.production_start_time && report.production_end_time) {
            const diffMs = new Date(report.production_end_time) - new Date(report.production_start_time);
            if (diffMs > 0) productionTime = (diffMs / (1000 * 60 * 60)).toFixed(1);
        }

        const efficiencyData = [
            { name: 'OEE', value: Number(clampedOee.toFixed(1)) },
            { name: 'Loss', value: Number((100 - clampedOee).toFixed(1)) }
        ];

        const downtimeData = Object.keys(categoryMap).map(key => ({
            name: key,
            minutes: categoryMap[key]
        })).sort((a, b) => b.minutes - a.minutes);

        // --- OEE CALCULATIONS (per /dashboard/formulas) ---
        
        const prodHours = report.total_production_time_hours ? parseFloat(report.total_production_time_hours) : (productionTime || 1);
        const downtimeHours = totalDowntime / 60;
        const plannedDowntimeHours = plannedDowntime / 60;
        const mechanicalDowntimeHours = mechanicalDowntime / 60;
        
        // Availability = (Planned Time - Total Downtime) / (Planned Time - Mechanical Downtime) × 100
        // If mechanical downtime = 0, this becomes: (Planned - Total) / Planned = standard availability
        const availNumerator = prodHours - downtimeHours;
        const availDenominator = prodHours - mechanicalDowntimeHours;
        const availVal = availDenominator > 0 ? Math.max(0, (availNumerator / availDenominator) * 100) : 0;

        // Quality = (Total Production - Filler Reject) / Total Production × 100
        let fillerReading = 0;
        let fillerRejects = 0;
        const readings = report.production_readings || report.meter_readings;
        if (readings) {
            const readingsArr = Array.isArray(readings) ? readings : [readings];
            readingsArr.forEach(m => {
                fillerReading += (parseFloat(m.filler_reading) || 0);
                fillerRejects += (parseFloat(m.filler_rejects) || 0);
            });
        }
        const qualVal = fillerReading > 0 ? ((fillerReading - fillerRejects) / fillerReading) * 100 : 0;

        // Performance = (Elapsed Time - Total Downtime) / (Elapsed Time - Planned Downtime) × 100
        // Use elapsed shift time (capped at full shift duration) instead of full planned time
        let elapsedHours = prodHours;
        if (shiftData?.start_time) {
            const shiftDate = report.production_date || report.log_date || new Date().toISOString().split('T')[0];
            const shiftStart = new Date(`${shiftDate}T${shiftData.start_time.slice(0, 5)}:00`);
            // Handle night shifts crossing midnight
            if (shiftData.end_time && shiftData.start_time.slice(0, 5) > shiftData.end_time.slice(0, 5)) {
                // If current time is before the start, shift started previous day
            }
            const now = new Date();
            const elapsedMins = Math.min(prodHours * 60, Math.max(0, Math.round((now - shiftStart) / 60000)));
            elapsedHours = elapsedMins / 60;
        }
        const perfNumerator = elapsedHours - downtimeHours;
        const perfDenominator = elapsedHours - plannedDowntimeHours;
        const perfVal = perfDenominator > 0 ? (perfNumerator / perfDenominator) * 100 : 0;

        // Prefer API-provided metrics when available, fall back to manual calculation
        const apiMetrics = report.metrics || {};
        const oeeMetrics = {
            availability: (apiMetrics.availability != null ? apiMetrics.availability : Math.min(Math.max(availVal || 0, 0), 100)).toFixed(1),
            quality: (apiMetrics.quality != null ? apiMetrics.quality : Math.min(Math.max(qualVal || 0, 0), 100)).toFixed(1),
            performance: (apiMetrics.performance != null ? apiMetrics.performance : Math.min(Math.max(perfVal || 0, 0), 100)).toFixed(1)
        };

        return {
            efficiencyData,
            downtimeData,
            totalOutput: totalOutput || report.total_bottles_produced || 0,
            totalDowntime: totalDowntime || report.total_downtime_minutes || 0,
            efficiency: Number(clampedOee.toFixed(1)),
            productionTime: productionTime || report.total_production_time_hours || 0,
            oeeMetrics,
            plannedDowntime,
            mechanicalDowntime
        };
    };

    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const chartGridColor = isDark ? '#334155' : '#e2e8f0';
    const tooltipBg = isDark ? '#0f172a' : '#ffffff';
    const tooltipBorder = isDark ? '#1e293b' : '#e2e8f0';
    const tooltipText = isDark ? '#f1f5f9' : '#0f172a';

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const stats = report ? calculateStats() : {
        efficiencyData: [], downtimeData: [], totalOutput: 0, totalDowntime: 0, efficiency: 0, productionTime: 0, oeeMetrics: { availability: 0, quality: 0, performance: 0 }, plannedDowntime: 0, mechanicalDowntime: 0
    };
    const { efficiencyData, downtimeData, totalOutput, totalDowntime, efficiency, productionTime, oeeMetrics, plannedDowntime, mechanicalDowntime } = stats;

    if (loading) return <div className="p-4 text-center text-muted">Loading details...</div>;
    if (!report) return <div className="p-4 text-center text-danger">Report not found</div>;

    const tabs = [
        { id: 'batches', label: 'Syrup Batches', count: report.batches?.length || 0 },
        { id: 'materials', label: 'Materials', count: report.materials?.length || 0 }, // Materials is an array of groups, count might be misleading if just groups, but OK for now.
        { id: 'stoppages', label: 'Stoppages', count: report.stoppage_logs?.length || 0 },
        { id: 'workers', label: 'Workers', count: report.workers?.length || 0 },
    ];

    const getStatusColor = (status) => {
        switch (status?.toUpperCase()) {
            case 'COMPLETED': return 'bg-soft-success text-success';
            case 'PENDING': return 'bg-soft-warning text-warning';
            case 'IN_PROGRESS': return 'bg-soft-info text-info';
            case 'APPROVED': return 'bg-soft-purple text-purple';
            default: return 'bg-soft-secondary text-secondary';
        }
    };

    return (
        <>
            {/* Header */}
            <div className="d-flex align-items-center justify-content-between mb-4">
                <div className="d-flex align-items-center gap-3">
                    <button className="btn btn-outline-light" onClick={() => navigate('/dashboard/production')}>
                        <i className="ti ti-arrow-left me-2"></i>
                        Back
                    </button>
                    <div>
                        <div className="d-flex align-items-center gap-3">
                            <h4 className="mb-0">{report.report_code}</h4>
                            <span className={`badge ${getStatusColor(report.status)}`}>
                                {report.status}
                            </span>
                        </div>
                        <p className="text-muted small mb-0 mt-1">
                            {new Date(report.production_date).toLocaleDateString()} • {report.shift_name}
                        </p>
                    </div>
                </div>
                <button className="btn btn-primary" onClick={() => navigate(`/dashboard/production/${id}/edit`)}>
                    Edit Report
                </button>
            </div>

            {/* General Overview Grid */}
            <div className="row g-3 mb-4">
                {/* Product & Line Info */}
                <div className="col-lg-4">
                    <div className="card h-100">
                        <div className="card-header bg-soft-primary">
                            <h6 className="mb-0 d-flex align-items-center gap-2 text-primary">
                                <Package className="h-4 w-4" />
                                Product Details
                            </h6>
                        </div>
                        <div className="card-body">
                            <DetailRow label="Product Name" value={report.product_name} />
                            <DetailRow label="PET Name" value={report.pet_name} />
                            <DetailRow label="Bottle Size" value={report.bottle_size} />
                            <DetailRow label="Bottles / Pack" value={report.bottles_per_pack} />
                            <DetailRow label="Line" value={`Line ${report.line}`} />
                            <DetailRow label="Shift" value={report.shift_name} />
                            <DetailRow label="Packs Per Pallet" value={report.packs_per_pallet} />
                        </div>
                    </div>
                </div>

                {/* Production Metrics */}
                <div className="col-lg-4">
                    <div className="card h-100">
                        <div className="card-header bg-soft-success">
                            <h6 className="mb-0 d-flex align-items-center gap-2 text-success">
                                <Activity className="h-4 w-4" />
                                Metrics & Counters
                            </h6>
                        </div>
                        <div className="card-body">
                            <DetailRow label="Total Bottles" value={report.total_bottles_produced?.toLocaleString()} />
                            <DetailRow label="Total Packs" value={report.total_packs?.toLocaleString()} />
                            <DetailRow label="Total Pallets" value={report.total_pallets?.toLocaleString()} />
                            <DetailRow label="Line Speed" value={report.line_speed} />
                        </div>
                    </div>
                </div>

                {/* Timing & Personnel */}
                <div className="col-lg-4">
                    <div className="card h-100">
                        <div className="card-header bg-soft-info">
                            <h6 className="mb-0 d-flex align-items-center gap-2 text-info">
                                <Clock className="h-4 w-4" />
                                Timing & Team
                            </h6>
                        </div>
                        <div className="card-body">
                            <DetailRow label="Start Time" value={report.start_time} />
                            <DetailRow label="End Time" value={report.end_time} />
                            <DetailRow label="Prod. Time" value={`${report.total_production_time_hours ?? 0} hrs`} />
                            <DetailRow label="Downtime" value={`${report.total_downtime_minutes ?? 0} min`} />
                            <DetailRow label="Supervisor" value={report.supervisor_name} />
                            <DetailRow label="Prod. Manager" value={report.production_manager || '-'} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Production Summary Stats */}
            <div className="card shadow-sm mb-4">
                <div className="card-header bg-white border-bottom">
                    <h6 className="mb-0 fw-semibold">Production Summary</h6>
                </div>
                <div className="card-body">
                    <div className="row row-cols-1 row-cols-sm-2 row-cols-md-4 g-2 mb-2">
                        <div className="col">
                            <div className="card border-0 shadow-sm bg-soft-primary h-100">
                                <div className="card-body p-2 d-flex align-items-center gap-2">
                                    <div className="bg-primary rounded-circle p-2 flex-shrink-0">
                                        <i className="ti ti-package text-white fs-5"></i>
                                    </div>
                                    <div className="flex-grow-1">
                                        <small className="text-muted d-block fs-11 text-uppercase fw-semibold">Total Output</small>
                                        <h6 className="mb-0 text-primary fw-bold">{totalOutput.toLocaleString()}</h6>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col">
                            <div className="card border-0 shadow-sm bg-soft-info h-100">
                                <div className="card-body p-2 d-flex align-items-center gap-2">
                                    <div className="bg-info rounded-circle p-2 flex-shrink-0">
                                        <i className="ti ti-clock-hour-4 text-white fs-5"></i>
                                    </div>
                                    <div className="flex-grow-1">
                                        <small className="text-muted d-block fs-11 text-uppercase fw-semibold">Prod. Time</small>
                                        <h6 className="mb-0 text-info fw-bold">{productionTime} hrs <small className="fw-normal fs-11">({Math.round(productionTime * 60)} min)</small></h6>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col">
                            <div className="card border-0 shadow-sm bg-soft-success h-100">
                                <div className="card-body p-2 d-flex align-items-center gap-2">
                                    <div className="bg-success rounded-circle p-2 flex-shrink-0">
                                        <i className="ti ti-chart-pie text-white fs-5"></i>
                                    </div>
                                    <div className="flex-grow-1">
                                        <small className="text-muted d-block fs-11 text-uppercase fw-semibold">Efficiency</small>
                                        <h6 className="mb-0 text-success fw-bold">{efficiency}%</h6>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col">
                            <div className="card border-0 shadow-sm bg-soft-warning h-100">
                                <div className="card-body p-2 d-flex align-items-center gap-2">
                                    <div className="bg-warning rounded-circle p-2 flex-shrink-0">
                                        <i className="ti ti-clock-pause text-white fs-5"></i>
                                    </div>
                                    <div className="flex-grow-1">
                                        <small className="text-muted d-block fs-11 text-uppercase fw-semibold">Downtime</small>
                                        <h6 className="mb-0 text-warning fw-bold">{Number(totalDowntime).toFixed(2)} min</h6>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="row row-cols-1 row-cols-sm-2 row-cols-md-2 g-2">
                        <div className="col">
                            <div className="card border-0 shadow-sm bg-soft-danger h-100">
                                <div className="card-body p-2 d-flex align-items-center gap-2">
                                    <div className="bg-danger rounded-circle p-2 flex-shrink-0">
                                        <i className="ti ti-tool text-white fs-5"></i>
                                    </div>
                                    <div className="flex-grow-1">
                                        <small className="text-muted d-block fs-11 text-uppercase fw-semibold">Mech. DT</small>
                                        <h6 className="mb-0 text-danger fw-bold">{Number(mechanicalDowntime).toFixed(2)} min</h6>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col">
                            <div className="card border-0 shadow-sm h-100" style={{backgroundColor: '#f8f9fa'}}>
                                <div className="card-body p-2 d-flex align-items-center gap-2">
                                    <div className="rounded-circle p-2 flex-shrink-0" style={{backgroundColor: '#6c757d'}}>
                                        <i className="ti ti-calendar-time text-white fs-5"></i>
                                    </div>
                                    <div className="flex-grow-1">
                                        <small className="text-muted d-block fs-11 text-uppercase fw-semibold">Planned DT</small>
                                        <h6 className="mb-0 fw-bold" style={{color: '#6c757d'}}>{Number(plannedDowntime).toFixed(2)} min</h6>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="row row-cols-1 row-cols-sm-3 g-3 mt-2">
                        <div className="col">
                            <div className="card border-0 shadow-sm">
                                <div className="card-body p-3">
                                    <ResponsiveContainer width="100%" height={200}>
                                        <BarChart data={[{ name: 'Availability', value: parseFloat(oeeMetrics.availability) }]} barSize={60}>
                                            <defs>
                                                <linearGradient id="availGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#06b6d4" stopOpacity={1} />
                                                    <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.7} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                                            <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 600 }} />
                                            <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                                            <Bar dataKey="value" fill="url(#availGradient)" radius={[8, 8, 0, 0]}>
                                                <LabelList dataKey="value" position="inside" formatter={(value) => `${value}%`} style={{ fontWeight: 'bold', fill: '#ffffff', fontSize: 16 }} />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                        <div className="col">
                            <div className="card border-0 shadow-sm">
                                <div className="card-body p-3">
                                    <ResponsiveContainer width="100%" height={200}>
                                        <BarChart data={[{ name: 'Performance', value: parseFloat(oeeMetrics.performance) }]} barSize={60}>
                                            <defs>
                                                <linearGradient id="perfGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1} />
                                                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.7} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                                            <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 600 }} />
                                            <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                                            <Bar dataKey="value" fill="url(#perfGradient)" radius={[8, 8, 0, 0]}>
                                                <LabelList dataKey="value" position="inside" formatter={(value) => `${value}%`} style={{ fontWeight: 'bold', fill: '#ffffff', fontSize: 16 }} />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                        <div className="col">
                            <div className="card border-0 shadow-sm">
                                <div className="card-body p-3">
                                    <ResponsiveContainer width="100%" height={200}>
                                        <BarChart data={[{ name: 'Quality', value: parseFloat(oeeMetrics.quality) }]} barSize={60}>
                                            <defs>
                                                <linearGradient id="qualGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                                                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.7} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                                            <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 600 }} />
                                            <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                                            <Bar dataKey="value" fill="url(#qualGradient)" radius={[8, 8, 0, 0]}>
                                                <LabelList dataKey="value" position="inside" formatter={(value) => `${value}%`} style={{ fontWeight: 'bold', fill: '#ffffff', fontSize: 16 }} />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Production Performance Analysis */}
            <div className="card shadow-sm mb-4 border-0">
                <div className="card-header border-bottom py-3">
                    <h6 className="mb-0 fw-semibold d-flex align-items-center gap-2">
                        <i className="ti ti-chart-bar fs-5 text-primary"></i>
                        Production Performance Analysis
                    </h6>
                    <small className="text-muted">Efficiency and downtime metrics overview</small>
                </div>
                <div className="card-body p-4">
                    <div className="row g-4">
                        {/* Efficiency Chart */}
                        <div className="col-lg-6">
                            <div className="card h-100 border shadow-sm" style={{ overflow: 'hidden' }}>
                                <div className="card-header border-bottom py-3">
                                    <h6 className="mb-0 d-flex align-items-center gap-2 fw-semibold">
                                        <Activity className="h-4 w-4 text-success" />
                                        OEE Analysis
                                    </h6>
                                </div>
                                <div className="card-body p-4">
                                    <div className="d-flex flex-column flex-md-row align-items-center gap-4 justify-content-center" style={{ minHeight: '300px' }}>
                                        <div className="position-relative" style={{ width: '220px', height: '220px' }}>
                                            {efficiencyData.length > 0 ? (
                                                <>
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <PieChart>
                                                            <Pie
                                                                data={[
                                                                    { name: 'Efficiency', value: efficiencyData[0]?.value || 0 },
                                                                    { name: 'Remaining', value: 100 - (efficiencyData[0]?.value || 0) }
                                                                ]}
                                                                cx="50%"
                                                                cy="50%"
                                                                startAngle={90}
                                                                endAngle={450}
                                                                innerRadius={75}
                                                                outerRadius={95}
                                                                dataKey="value"
                                                                stroke="none"
                                                            >
                                                                <Cell fill={efficiencyData[0]?.value >= 80 ? '#10b981' : efficiencyData[0]?.value >= 60 ? '#f59e0b' : '#ef4444'} />
                                                                <Cell fill={isDark ? '#334155' : '#e5e7eb'} />
                                                            </Pie>
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                    <div className="position-absolute top-50 start-50 translate-middle text-center">
                                                        <h1 className={`mb-0 fw-bold ${efficiencyData[0]?.value >= 80 ? 'text-success' : efficiencyData[0]?.value >= 60 ? 'text-warning' : 'text-danger'}`} style={{ fontSize: '3.5rem' }}>
                                                            {efficiencyData[0]?.value}%
                                                        </h1>
                                                        <small className="text-secondary text-uppercase fw-semibold" style={{ letterSpacing: '0.5px' }}>OEE Score</small>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="w-100 h-100 rounded-circle border border-2 border-dashed d-flex align-items-center justify-content-center bg-light">
                                                    <span className="text-muted small">No Data</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="vstack gap-3">
                                            {[
                                                { label: 'Availability', value: parseFloat(oeeMetrics.availability), color: '#06b6d4' },
                                                { label: 'Performance', value: parseFloat(oeeMetrics.performance), color: '#8b5cf6' },
                                                { label: 'Quality', value: parseFloat(oeeMetrics.quality), color: '#10b981' },
                                            ].map(({ label, value, color }) => (
                                                <div key={label} className="text-center p-3 rounded border" style={{ backgroundColor: isDark ? '#1e293b' : '#f9fafb' }}>
                                                    <div className="position-relative d-inline-block mb-2" style={{ width: '110px', height: '110px' }}>
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <PieChart>
                                                                <Pie
                                                                    data={[
                                                                        { value: value || 0 },
                                                                        { value: 100 - (value || 0) }
                                                                    ]}
                                                                    cx="50%"
                                                                    cy="50%"
                                                                    startAngle={90}
                                                                    endAngle={450}
                                                                    innerRadius={35}
                                                                    outerRadius={45}
                                                                    dataKey="value"
                                                                    stroke="none"
                                                                >
                                                                    <Cell fill={color} />
                                                                    <Cell fill={isDark ? '#334155' : '#e5e7eb'} />
                                                                </Pie>
                                                            </PieChart>
                                                        </ResponsiveContainer>
                                                        <div className="position-absolute top-50 start-50 translate-middle text-center">
                                                            <div className="fw-bold" style={{ fontSize: '1.5rem', color }}>{(value || 0).toFixed(1)}%</div>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <small className="text-secondary text-uppercase fw-semibold d-block">{label}</small>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Downtime Analysis Chart */}
                        <div className="col-lg-6">
                            <div className="card h-100 border shadow-sm" style={{ overflow: 'hidden' }}>
                                <div className="card-header border-bottom py-3">
                                    <h6 className="mb-0 d-flex align-items-center gap-2 fw-semibold">
                                        <AlertTriangle className="h-4 w-4 text-warning" />
                                        Downtime Breakdown
                                    </h6>
                                </div>
                                <div className="card-body p-4">
                                    <div style={{ height: '300px', width: '100%' }}>
                                {downtimeData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={downtimeData} layout="vertical" margin={{ top: 10, right: 50, left: 120, bottom: 10 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} stroke={chartGridColor} opacity={0.5} />
                                            <XAxis
                                                type="number"
                                                tick={{ fill: isDark ? '#94a3b8' : '#6b7280', fontSize: 11 }}
                                                axisLine={{ stroke: isDark ? '#475569' : '#d1d5db' }}
                                                tickLine={{ stroke: isDark ? '#475569' : '#d1d5db' }}
                                                label={{ value: 'Duration (minutes)', position: 'insideBottom', offset: -5, fill: isDark ? '#94a3b8' : '#6b7280', fontSize: 11 }}
                                            />
                                            <YAxis
                                                type="category"
                                                dataKey="name"
                                                width={120}
                                                tick={{ fill: isDark ? '#e2e8f0' : '#374151', fontSize: 11, fontWeight: 500 }}
                                                tickLine={false}
                                                axisLine={{ stroke: isDark ? '#475569' : '#d1d5db' }}
                                            />
                                            <RechartsTooltip
                                                cursor={{ fill: isDark ? '#1e293b' : '#f3f4f6', opacity: 0.5 }}
                                                contentStyle={{
                                                    backgroundColor: tooltipBg,
                                                    borderRadius: '8px',
                                                    border: `1px solid ${tooltipBorder}`,
                                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                                                    padding: '10px 14px'
                                                }}
                                                labelStyle={{ fontWeight: '600', color: tooltipText, fontSize: '13px', marginBottom: '4px' }}
                                                formatter={(value) => [`${Number(value).toFixed(1)} min`, 'Duration']}
                                            />
                                            <Bar
                                                dataKey="minutes"
                                                radius={[0, 6, 6, 0]}
                                                barSize={28}
                                                label={{
                                                    position: 'inside',
                                                    fill: '#ffffff',
                                                    fontSize: 11,
                                                    fontWeight: 700,
                                                    formatter: (value) => value ? `${Number(value).toFixed(0)}m` : ''
                                                }}
                                            >
                                                {downtimeData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#06b6d4', '#ec4899', '#6b7280'][index % 8]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="w-100 h-100 d-flex flex-column align-items-center justify-content-center text-muted border border-2 border-dashed rounded bg-light">
                                        <Activity className="h-8 w-8 opacity-25 mb-2" />
                                        <span className="small fw-semibold">No Downtime Recorded</span>
                                    </div>
                                )}
                            </div>
                        </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>



            {/* Meter Readings Section */}
            <div className="card mb-4">
                <div className="card-header bg-soft-indigo">
                    <h6 className="mb-0 text-indigo">Meter Readings</h6>
                    <small className="text-muted">Production, Syrup, and CO2 consumption data</small>
                </div>
                <div className="card-body">
                <MeterReadingsView
                    productionReadings={report.production_readings}
                    syrupReadings={report.syrup_readings}
                    co2Readings={report.co2_readings}
                />
            </div>
        </div>

            {/* Remarks Section */}
            {(report.remarks || report.summary_text) && (
                <div className="card mb-4">
                    <div className="card-header">
                        <h6 className="mb-0 d-flex align-items-center gap-2">
                            <Box className="h-4 w-4" />
                            Remarks & Summary
                        </h6>
                    </div>
                    <div className="card-body">
                        <div className="row g-4">
                            {report.remarks && (
                                <div className="col-md-6">
                                    <small className="text-muted text-uppercase d-block mb-2">Remarks</small>
                                    <div className="bg-light p-3 rounded border">
                                        {report.remarks}
                                    </div>
                                </div>
                            )}
                            {report.summary_text && (
                                <div className="col-md-6">
                                    <small className="text-muted text-uppercase d-block mb-2">Summary Text</small>
                                    <div className="bg-light p-3 rounded border">
                                        {report.summary_text}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}



          


            {/* Stoppage Timeline */}
            <StoppageTimeline logs={report.stoppage_logs} />

            {/* Tabbed Detailed Content */}
            <div className="card shadow-sm">
                <div className="card-header bg-white">
                    <ul className="nav nav-tabs card-header-tabs" role="tablist">
                        {tabs.map(tab => (
                            <li className="nav-item" key={tab.id} role="presentation">
                                <button
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`nav-link d-flex align-items-center gap-2 ${activeTab === tab.id ? 'active' : ''}`}
                                    type="button"
                                    role="tab"
                                >
                                    <span>{tab.label}</span>
                                    <span className={`badge ${activeTab === tab.id ? 'bg-primary' : 'bg-secondary'}`}>
                                        {tab.count}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="card-body p-0">
                    <div className="tab-content p-4">
                        {activeTab === 'batches' && (
                            <div className="tab-pane fade show active">
                                <div className="table-responsive">
                                    <table className="table table-hover align-middle">
                                        <thead className="table-light">
                                            <tr>
                                                <th>Batch #</th>
                                                <th>Syrup Liters</th>
                                                <th>Start Time</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {report.batches?.length > 0 ? (
                                                report.batches.map((batch, idx) => (
                                                    <tr key={idx}>
                                                        <td className="fw-medium">{batch.batch_number}</td>
                                                        <td>{batch.syrup_liters} L</td>
                                                        <td>{batch.start_time}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="3" className="text-center text-muted py-4">
                                                        No batches recorded
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {activeTab === 'materials' && (
                            <div className="tab-pane fade show active">
                                <MaterialsView materials={report.materials} />
                            </div>
                        )}

                        {activeTab === 'stoppages' && (
                            <div className="tab-pane fade show active">
                                <StoppageLogsView logs={report.stoppage_logs} />
                            </div>
                        )}

                        {activeTab === 'workers' && (
                            <div className="tab-pane fade show active">
                                <div className="table-responsive">
                                    <table className="table table-hover align-middle">
                                        <thead className="table-light">
                                            <tr>
                                                <th>Name</th>
                                                <th>Role</th>
                                                <th>Company</th>
                                                <th>Present</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {report.workers?.length > 0 ? (
                                                report.workers.map((worker, idx) => (
                                                    <tr key={idx}>
                                                        <td className="fw-medium">{worker.user?.full_name || worker.user?.username}</td>
                                                        <td><span className="badge bg-info">{worker.user?.role}</span></td>
                                                        <td>{worker.user?.company_name}</td>
                                                        <td>
                                                            {worker.present ? (
                                                                <span className="badge bg-success">Yes</span>
                                                            ) : (
                                                                <span className="badge bg-secondary">No</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="4" className="text-center text-muted py-4">
                                                        No workers recorded
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {activeTab === 'readings' && (
                            <div className="tab-pane fade show active">
                                <MeterReadingsView
                                    productionReadings={report.production_readings}
                                    syrupReadings={report.syrup_readings}
                                    co2Readings={report.co2_readings}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default ReportDetails;
