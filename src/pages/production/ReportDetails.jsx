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
    // Group items by their specific petline_type
    const groups = {
        preform: items.filter(i => i.petline_type === 'preform').map(i => i.data),
        caps: items.filter(i => i.petline_type === 'caps').map(i => i.data),
        labels: items.filter(i => i.petline_type === 'labels').map(i => i.data),
        shrink: items.filter(i => i.petline_type === 'shrink').map(i => i.data),
    };

    return (
        <div className="vstack gap-3">
            {/* Preforms Section */}
            {groups.preform.length > 0 && (
                <div className="bg-light rounded p-3 border">
                    <h6 className="text-muted text-uppercase small fw-bold mb-3">Preforms</h6>
                    <DataTable
                        columns={[
                            { header: 'Batch', accessor: 'batch_number' },
                            { header: 'Cage #', accessor: 'cage_number' },
                            { header: 'Size (g)', accessor: 'preform_size_value' },
                            { header: 'Color', accessor: 'preform_color_name' },
                            { header: 'Supplier', accessor: 'supplier_name' },
                            { header: 'Qty/Cage', accessor: 'quantity_per_cage_value' },
                            { header: 'Infeed Time', accessor: 'material_infeed_time' },
                        ]}
                        data={groups.preform}
                        isLoading={false}
                        pagination={null}
                    />
                </div>
            )}

            {/* Caps Section */}
            {groups.caps.length > 0 && (
                <div className="bg-light rounded p-3 border">
                    <h6 className="text-muted text-uppercase small fw-bold mb-3">Caps</h6>
                    <DataTable
                        columns={[
                            { header: 'Batch', accessor: 'batch_number' },
                            { header: 'Box #', accessor: 'box_number' },
                            { header: 'Type', accessor: 'cap_type_name' },
                            { header: 'Color', accessor: 'cap_color_name' },
                            { header: 'Supplier', accessor: 'supplier_name' },
                            { header: 'Qty/Box', accessor: 'quantity_per_box_value' },
                            { header: 'Infeed Time', accessor: 'material_infeed_time' },
                        ]}
                        data={groups.caps}
                        isLoading={false}
                        pagination={null}
                    />
                </div>
            )}

            {/* Labels Section */}
            {groups.labels.length > 0 && (
                <div className="bg-light rounded p-3 border">
                    <h6 className="text-muted text-uppercase small fw-bold mb-3">Labels / Sleeves</h6>
                    <DataTable
                        columns={[
                            { header: 'Batch', accessor: 'batch_number' },
                            { header: 'Roll #', accessor: 'roll_number' },
                            { header: 'Name', accessor: 'label_sleeve_name_value' },
                            { header: 'Size', accessor: 'product_size_name' },
                            { header: 'Net Wt', accessor: 'roll_net_weight' },
                            { header: 'Supplier', accessor: 'supplier_name' },
                            { header: 'Infeed Time', accessor: 'material_infeed_time' },
                        ]}
                        data={groups.labels}
                        isLoading={false}
                        pagination={null}
                    />
                </div>
            )}

            {/* Shrink Section */}
            {groups.shrink.length > 0 && (
                <div className="bg-light rounded p-3 border">
                    <h6 className="text-muted text-uppercase small fw-bold mb-3">Shrink Wrap</h6>
                    <DataTable
                        columns={[
                            { header: 'Batch', accessor: 'batch_number' },
                            { header: 'Roll #', accessor: 'roll_number' },
                            { header: 'Name', accessor: 'shrink_name_value' },
                            { header: 'Pack Size', accessor: 'pack_size_name' },
                            { header: 'Net Wt', accessor: 'roll_net_weight' },
                            { header: 'Supplier', accessor: 'supplier_name' },
                            { header: 'Infeed Time', accessor: 'material_infeed_time' },
                        ]}
                        data={groups.shrink}
                        isLoading={false}
                        pagination={null}
                    />
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

    console.log('MeterReadingsView props:', { productionReadings, syrupReadings, co2Readings });

    const ReadingCard = ({ title, data, fields }) => {
        console.log(`ReadingCard for ${title}:`, data);

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
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('batches');

    useEffect(() => {
        const fetchReport = async () => {
            try {
                const res = await productionApi.getReport(id);
                setReport(res.data.data);
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
            report.stoppage_logs.forEach(log => {
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
                        if (!categoryMap[catName]) categoryMap[catName] = 0;
                        categoryMap[catName] += (inc.incident_duration || 0);

                        // Check for Planned Downtime
                        if (catName.toLowerCase().includes('planned')) {
                            plannedDowntime += (inc.incident_duration || 0);
                        }
                        // Check for Mechanical Downtime
                        if (catName.toLowerCase().includes('mechanical')) {
                            mechanicalDowntime += (inc.incident_duration || 0);
                        }
                    });
                } else if (minutes > 0) {
                    if (!categoryMap['Unspecified']) categoryMap['Unspecified'] = 0;
                    categoryMap['Unspecified'] += minutes;
                }
            });


            totalDowntime = totalDowntimeSum / report.stoppage_logs.length;
        }



        const avgEff = logCount > 0 ? totalEfficiency / logCount : 0;
        const effVal = Math.min(Math.max(avgEff, 0), 100);


        let productionTime = 0;
        if (report.start_time && report.end_time) {
            const start = new Date(`${report.production_date}T${report.start_time}`);
            const end = new Date(`${report.production_date}T${report.end_time}`);

            const sTime = new Date(`1970-01-01T${report.start_time}`);
            const eTime = new Date(`1970-01-01T${report.end_time}`);
            if (eTime < sTime) eTime.setDate(eTime.getDate() + 1); // Next day

            const diffMs = eTime - sTime;
            productionTime = (diffMs / (1000 * 60 * 60)).toFixed(1);
        }

        const efficiencyData = [
            { name: 'Efficiency', value: Number(effVal.toFixed(1)) },
            { name: 'Downtime', value: Number((100 - effVal).toFixed(1)) }
        ];

        const downtimeData = Object.keys(categoryMap).map(key => ({
            name: key,
            minutes: categoryMap[key]
        })).sort((a, b) => b.minutes - a.minutes);


        let sumWaste = 0;
        let sumFillerReading = 0;


        if (report.meter_readings) {
            report.meter_readings.forEach(m => {
                sumWaste += (parseFloat(m.filler_rejects) || 0);
                sumFillerReading += (parseFloat(m.filter_reading) || 0);
            });
        }

        // --- OEE CALCULATIONS ---

        // Base values
        const prodHours = report.total_production_time_hours ? parseFloat(report.total_production_time_hours) : (productionTime || 1);
        const downtimeHours = totalDowntime / 60;
        const plannedDowntimeHours = plannedDowntime / 60;
        const unplannedDowntimeHours = downtimeHours - plannedDowntimeHours;
        
        // Use filler_reading from meter_readings if available
        let fillerReading = 0;
        let fillerRejects = 0;
        if (report.meter_readings && report.meter_readings.length > 0) {
            report.meter_readings.forEach(m => {
                fillerReading += (parseFloat(m.filler_reading) || 0);
                fillerRejects += (parseFloat(m.filler_rejects) || 0);
            });
        }

        // Availability = (Total Production Time − Total Downtime) / (Total Production Time − Unplanned Downtime)
        const availNumerator = prodHours - downtimeHours;
        const availDenominator = prodHours - unplannedDowntimeHours;
        const availVal = availDenominator > 0 ? (availNumerator / availDenominator) * 100 : 0;

        // Quality = (Filler Reading − Filler Reject) / Filler Reading
        const qualVal = fillerReading > 0 ? ((fillerReading - fillerRejects) / fillerReading) * 100 : 0;

        // Performance = (Total Production Time − Total Downtime) / (Total Production Time − Planned Downtime)
        const perfNumerator = prodHours - downtimeHours;
        const perfDenominator = prodHours - plannedDowntimeHours;
        const perfVal = perfDenominator > 0 ? (perfNumerator / perfDenominator) * 100 : 0;

        const oeeMetrics = {
            availability: Math.min(Math.max(availVal || 0, 0), 100).toFixed(1),
            quality: Math.min(Math.max(qualVal || 0, 0), 100).toFixed(1),
            performance: Math.min(Math.max(perfVal || 0, 0), 100).toFixed(1)
        };

        return {
            efficiencyData,
            downtimeData,
            totalOutput: totalOutput || report.total_bottles_produced || 0,
            totalDowntime: totalDowntime || report.total_downtime_minutes || 0,
            efficiency: Number(effVal.toFixed(1)) || report.efficiency || 0,
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

    const { efficiencyData, downtimeData, totalOutput, totalDowntime, efficiency, productionTime, oeeMetrics, plannedDowntime, mechanicalDowntime } = report ? calculateStats() : {
        efficiencyData: [], downtimeData: [], totalOutput: 0, totalDowntime: 0, efficiency: 0, productionTime: 0, oeeMetrics: { availability: 0, quality: 0, performance: 0 }, plannedDowntime: 0, mechanicalDowntime: 0
    };
    const COLOR_EFFICIENCY = '#10b981'; // emerald-500
    const COLOR_LOSS = '#ef4444'; // red-500

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
            <div className="row g-3 mb-4">
                <div className="col-lg-3 col-md-6">
                    <div className="card border-0 shadow-sm">
                        <div className="card-body">
                            <small className="text-muted text-uppercase d-block mb-2">Total Output</small>
                            <h3 className="mb-0 fw-bold text-primary">{totalOutput.toLocaleString()}</h3>
                            <small className="text-muted">bottles</small>
                        </div>
                    </div>
                </div>
                <div className="col-lg-3 col-md-6">
                    <div className="card border-0 shadow-sm">
                        <div className="card-body">
                            <small className="text-muted text-uppercase d-block mb-2">Production Time</small>
                            <h3 className="mb-0 fw-bold text-info">{productionTime} hrs</h3>
                            <small className="text-muted">planned time</small>
                        </div>
                    </div>
                </div>
                <div className="col-lg-3 col-md-6">
                    <div className="card border-0 shadow-sm">
                        <div className="card-body">
                            <small className="text-muted text-uppercase d-block mb-2">Efficiency</small>
                            <h3 className="mb-0 fw-bold text-primary">{efficiency}%</h3>
                            <small className="text-muted">OEE score</small>
                        </div>
                    </div>
                </div>
                <div className="col-lg-3 col-md-6">
                    <div className="card border-0 shadow-sm">
                        <div className="card-body">
                            <small className="text-muted text-uppercase d-block mb-2">Downtime</small>
                            <h3 className="mb-0 fw-bold text-warning">{totalDowntime} min</h3>
                            <small className="text-muted">total stoppage</small>
                        </div>
                    </div>
                </div>
            </div>

            {/* OEE Component Stats */}
            <div className="row g-3 mb-4">
                <div className="col-lg-3 col-md-6">
                    <div className="card border-0 shadow-sm bg-light">
                        <div className="card-body">
                            <small className="text-muted text-uppercase fw-semibold d-block mb-2">Mechanical Downtime</small>
                            <h4 className="mb-0 fw-bold">{mechanicalDowntime} min</h4>
                        </div>
                    </div>
                </div>
                <div className="col-lg-3 col-md-6">
                    <div className="card border-0 shadow-sm bg-light">
                        <div className="card-body">
                            <small className="text-muted text-uppercase fw-semibold d-block mb-2">Planned Downtime</small>
                            <h4 className="mb-0 fw-bold">{plannedDowntime} min</h4>
                        </div>
                    </div>
                </div>
                <div className="col-lg-3 col-md-6">
                    <div className="card border-0 shadow-sm bg-light">
                        <div className="card-body">
                            <small className="text-muted text-uppercase fw-semibold d-block mb-2">Availability</small>
                            <h4 className="mb-0 fw-bold">{oeeMetrics.availability}%</h4>
                        </div>
                    </div>
                </div>
                <div className="col-lg-3 col-md-6">
                    <div className="card border-0 shadow-sm bg-light">
                        <div className="card-body">
                            <small className="text-muted text-uppercase fw-semibold d-block mb-2">Performance</small>
                            <h4 className="mb-0 fw-bold">{oeeMetrics.performance}%</h4>
                        </div>
                    </div>
                </div>
                <div className="col-lg-3 col-md-6">
                    <div className="card border-0 shadow-sm bg-light">
                        <div className="card-body">
                            <small className="text-muted text-uppercase fw-semibold d-block mb-2">Quality</small>
                            <h4 className="mb-0 fw-bold">{oeeMetrics.quality}%</h4>
                        </div>
                    </div>
                </div>
            </div>

            {/* Production Performance Analysis */}
            <div className="row g-3 mb-4">
                {/* Efficiency Chart */}
                <div className="col-lg-6">
                    <div className="card h-100">
                        <div className="card-header bg-soft-success">
                            <h6 className="mb-0 d-flex align-items-center gap-2 text-success">
                                <Activity className="h-4 w-4" />
                                Efficiency Analysis
                            </h6>
                        </div>
                        <div className="card-body">
                            <div className="d-flex flex-column flex-md-row align-items-center gap-4 justify-content-center" style={{ minHeight: '250px' }}>
                                <div className="position-relative" style={{ width: '200px', height: '200px' }}>
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
                                                        innerRadius={70}
                                                        outerRadius={90}
                                                        dataKey="value"
                                                        stroke="none"
                                                    >
                                                        <Cell fill={COLOR_EFFICIENCY} />
                                                        <Cell fill="#e9ecef" />
                                                    </Pie>
                                                </PieChart>
                                            </ResponsiveContainer>
                                            <div className="position-absolute top-50 start-50 translate-middle text-center">
                                                <h1 className={`mb-0 fw-bold ${efficiencyData[0]?.value >= 80 ? 'text-success' : efficiencyData[0]?.value >= 50 ? 'text-warning' : 'text-danger'}`} style={{ fontSize: '3rem' }}>
                                                    {efficiencyData[0]?.value}%
                                                </h1>
                                                <small className="text-muted text-uppercase fw-semibold">OEE Score</small>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="w-100 h-100 rounded-circle border border-3 border-dashed d-flex align-items-center justify-content-center">
                                            <span className="text-muted small">No Data</span>
                                        </div>
                                    )}
                                </div>
                                <div className="vstack gap-4">
                                    <div className="text-center">
                                        <div className="position-relative d-inline-block" style={{ width: '100px', height: '100px' }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={[
                                                            { value: efficiencyData[0]?.value || 0 },
                                                            { value: 100 - (efficiencyData[0]?.value || 0) }
                                                        ]}
                                                        cx="50%"
                                                        cy="50%"
                                                        startAngle={90}
                                                        endAngle={450}
                                                        innerRadius={30}
                                                        outerRadius={40}
                                                        dataKey="value"
                                                        stroke="none"
                                                    >
                                                        <Cell fill={COLOR_EFFICIENCY} />
                                                        <Cell fill="#e9ecef" />
                                                    </Pie>
                                                </PieChart>
                                            </ResponsiveContainer>
                                            <div className="position-absolute top-50 start-50 translate-middle text-center">
                                                <div className="fw-bold" style={{ fontSize: '1.2rem' }}>{(efficiencyData[0]?.value || 0).toFixed(1)}%</div>
                                            </div>
                                        </div>
                                        <div className="mt-2">
                                            <small className="text-muted text-uppercase fw-semibold d-block">Efficiency</small>
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <div className="position-relative d-inline-block" style={{ width: '100px', height: '100px' }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={[
                                                            { value: 100 - (efficiencyData[0]?.value || 0) },
                                                            { value: efficiencyData[0]?.value || 0 }
                                                        ]}
                                                        cx="50%"
                                                        cy="50%"
                                                        startAngle={90}
                                                        endAngle={450}
                                                        innerRadius={30}
                                                        outerRadius={40}
                                                        dataKey="value"
                                                        stroke="none"
                                                    >
                                                        <Cell fill="#dc3545" />
                                                        <Cell fill="#e9ecef" />
                                                    </Pie>
                                                </PieChart>
                                            </ResponsiveContainer>
                                            <div className="position-absolute top-50 start-50 translate-middle text-center">
                                                <div className="fw-bold" style={{ fontSize: '1.2rem' }}>{(100 - (efficiencyData[0]?.value || 0)).toFixed(1)}%</div>
                                            </div>
                                        </div>
                                        <div className="mt-2">
                                            <small className="text-muted text-uppercase fw-semibold d-block">Loss</small>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Downtime Analysis Chart */}
                <div className="col-lg-6">
                    <div className="card h-100">
                        <div className="card-header bg-soft-warning">
                            <h6 className="mb-0 d-flex align-items-center gap-2 text-warning">
                                <AlertTriangle className="h-4 w-4" />
                                Downtime Breakdown (Minutes)
                            </h6>
                        </div>
                        <div className="card-body">
                            <div style={{ height: '250px', width: '100%' }}>
                        {downtimeData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={downtimeData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" opacity={0.5} />
                                    <XAxis type="number" hide />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        width={100}
                                        tick={{ fill: '#64748b', fontSize: 11 }}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <RechartsTooltip
                                        cursor={{ fill: '#f1f5f9', opacity: 0.5 }}
                                        contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        formatter={(value) => [`${value} min`, 'Duration']}
                                    />
                                    <Bar dataKey="minutes" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="w-100 h-100 d-flex flex-column align-items-center justify-content-center text-muted border border-2 border-dashed rounded">
                                <Activity className="h-8 w-8 opacity-25 mb-2" />
                                <span className="small">No Downtime Recorded</span>
                            </div>
                        )}
                    </div>
                </div>
                    </div>
                </div>
            </div>

            {/* OEE Analysis Charts */}
            <div className="row g-3 mb-4">
                <div className="col-lg-4">
                    <OEECircularGauge
                        title="Availability"
                        value={Number(oeeMetrics.availability)}
                        color="#3b82f6"
                    />
                </div>
                <div className="col-lg-4">
                    <OEECircularGauge
                        title="Quality"
                        value={Number(oeeMetrics.quality)}
                        color="#10b981"
                    />
                </div>
                <div className="col-lg-4">
                    <OEECircularGauge
                        title="Performance"
                        value={Number(oeeMetrics.performance)}
                        color="#f59e0b"
                    />
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

            {/* High Level Stats Cards */}
            <div className="row g-3 mb-4">
                <div className="col-lg-3 col-md-6">
                    <StatCard
                    title="Total Output"
                    value={totalOutput.toLocaleString()}
                    icon={Layers}
                    cardColor="success"
                />
                </div>
                <div className="col-lg-3 col-md-6">
                    <StatCard
                    title="Production Time"
                    value={`${productionTime} hrs`}
                    icon={Clock}
                    cardColor="info"
                />
                </div>
                <div className="col-lg-3 col-md-6">
                    <StatCard
                    title="Efficiency"
                    value={`${efficiency}%`}
                    icon={Activity}
                    cardColor="indigo"
                />
                </div>
                <div className="col-lg-3 col-md-6">
                    <StatCard
                    title="Downtime"
                    value={`${totalDowntime} min`}
                    icon={AlertTriangle}
                    cardColor="warning"
                />
                </div>
            </div>

            {/* Downtime Breakdown Stats */}
            <div className="row g-3 mb-4">
                <div className="col-md-6">
                    <StatCard
                    title="Mechanical Downtime"
                    value={`${mechanicalDowntime} min`}
                    icon={AlertTriangle}
                    cardColor="danger"
                />
                </div>
                <div className="col-md-6">
                    <StatCard
                    title="Planned Downtime"
                    value={`${plannedDowntime} min`}
                    icon={Clock}
                    cardColor="info"
                />
                </div>
            </div>



            {/* Stoppage Timeline */}
            <StoppageTimeline logs={report.stoppage_logs} />

            {/* Tabbed Detailed Content */}
            <div className="card shadow-sm">
                <div className="card-header bg-white border-bottom">
                    <ul className="nav nav-tabs card-header-tabs border-0" role="tablist">
                        {tabs.map(tab => (
                            <li className="nav-item" key={tab.id} role="presentation">
                                <button
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`nav-link px-4 py-3 d-flex align-items-center gap-2 border-0 ${activeTab === tab.id ? 'active' : ''}`}
                                    type="button"
                                    role="tab"
                                >
                                    <span className="fw-semibold">{tab.label}</span>
                                    <span className={`badge rounded-pill ${activeTab === tab.id ? 'bg-primary' : 'bg-light text-dark'}`}>
                                        {tab.count}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="card-body">
                    <div className="tab-content">
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
