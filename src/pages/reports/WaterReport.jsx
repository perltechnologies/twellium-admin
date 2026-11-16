import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { productionApi } from '../../api/production';
import FilterInputs from '../../components/FilterInputs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { exportToExcel } from '../../utils/exportUtils';
import { useFilters } from '../../context/FilterContext';

const WATER_UNIT = 'L';

const formatValue = (value) => Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
});

const WaterReport = () => {
    const { filters } = useFilters();
    const [rawReadings, setRawReadings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('custom');
    const [viewMode, setViewMode] = useState('chart');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = {
                utility_type: 'WATER',
                page_size: 1000,
            };

            if (filters.log_date) {
                params.production_date = filters.log_date;
                params.start_date = filters.log_date;
                params.end_date = filters.log_date;
            } else if (filters.start_date && filters.end_date) {
                params.start_date = filters.start_date;
                params.end_date = filters.end_date;
            } else if (timeRange === 'today') {
                const today = new Date().toISOString().split('T')[0];
                params.production_date = today;
                params.start_date = today;
                params.end_date = today;
            } else if (timeRange === 'week') {
                const now = new Date();
                const dayOfWeek = now.getDay();
                const sunday = new Date(now);
                sunday.setDate(now.getDate() - dayOfWeek);
                params.start_date = sunday.toISOString().split('T')[0];
                params.end_date = now.toISOString().split('T')[0];
            } else if (timeRange === 'month') {
                const now = new Date();
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                params.start_date = firstDay.toISOString().split('T')[0];
                params.end_date = now.toISOString().split('T')[0];
            }

            const res = await productionApi.getUtilityReadings(params);
            const rawData = res?.data?.data;
            const list = Array.isArray(rawData)
                ? rawData
                : (Array.isArray(res?.data)
                    ? res.data
                    : (Array.isArray(res?.data?.results)
                        ? res.data.results
                        : (Array.isArray(rawData?.results) ? rawData.results : [])));
            setRawReadings(list);
        } catch (err) {
            console.error('Failed to load water readings:', err);
            setRawReadings([]);
        } finally {
            setLoading(false);
        }
    }, [filters, timeRange]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (filters.log_date || filters.start_date || filters.end_date) setTimeRange('custom');
    }, [filters.log_date, filters.start_date, filters.end_date]);

    const dateRangeLabel = useMemo(() => {
        if (filters.log_date) return filters.log_date;
        if (filters.start_date && filters.end_date) {
            return filters.start_date === filters.end_date ? filters.start_date : `${filters.start_date} to ${filters.end_date}`;
        }
        return '';
    }, [filters]);

    const activePeriodText = useMemo(() => {
        if (filters.log_date) return filters.log_date;
        if (filters.start_date && filters.end_date) {
            return `${filters.start_date} to ${filters.end_date}`;
        }
        return '';
    }, [filters.log_date, filters.start_date, filters.end_date]);

    // Normalized table rows based on actual API response fields
    const tableData = useMemo(() => {
        const rows = rawReadings.map((r) => {
            const used = Number(r.used || 0);
            const losses = Number(r.losses || 0);
            const lossPercentage = Number(r.loss_percentage || 0);
            const recordYield = Number(r.yield || 0);
            const unit = r.unit || WATER_UNIT;
            const date = r.production_date || (r.created_at ? r.created_at.split('T')[0] : '-');

            return {
                id: r.id,
                report: r.report,
                report_code: r.report_code || (r.report ? `PR-${r.report}` : '-'),
                production_date: date,
                unit,
                used,
                losses,
                loss_percentage: lossPercentage,
                yield: recordYield,
            };
        });
        return rows.sort((a, b) => b.production_date.localeCompare(a.production_date) || String(a.report_code).localeCompare(String(b.report_code)));
    }, [rawReadings]);

    // Overall summary metrics
    const summaryMetrics = useMemo(() => {
        const totalConsumed = tableData.reduce((sum, r) => sum + r.used, 0);
        const totalLosses = tableData.reduce((sum, r) => sum + r.losses, 0);
        const avgYield = tableData.length > 0
            ? tableData.reduce((sum, r) => sum + r.yield, 0) / tableData.length
            : 0;
        const unit = tableData[0]?.unit || WATER_UNIT;

        return {
            totalConsumed,
            totalLosses,
            avgYield,
            recordCount: tableData.length,
            unit,
        };
    }, [tableData]);

    // Daily consumption for chart (production_date on x-axis, used on y-axis)
    const dailyChartData = useMemo(() => {
        const dayMap = {};
        tableData.forEach((row) => {
            const date = row.production_date;
            if (!date || date === '-') return;
            if (!dayMap[date]) {
                dayMap[date] = { date, used: 0, count: 0 };
            }
            dayMap[date].used += row.used;
            dayMap[date].count += 1;
        });

        return Object.values(dayMap)
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((d) => ({
                ...d,
                used: Number(d.used.toFixed(2)),
            }));
    }, [tableData]);

    const handleExport = () => {
        const summaryRows = [
            { 'Report Code': '--- KPI SUMMARY ---', 'Production Date': '' },
            { 'Report Code': 'Period', 'Production Date': dateRangeLabel || 'N/A' },
            { 'Report Code': 'Total Water Consumed', 'Production Date': summaryMetrics.recordCount > 0 ? `${formatValue(summaryMetrics.totalConsumed)} ${summaryMetrics.unit}` : 'No data' },
            { 'Report Code': 'Total Losses', 'Production Date': summaryMetrics.recordCount > 0 ? `${formatValue(summaryMetrics.totalLosses)} ${summaryMetrics.unit}` : 'No data' },
            { 'Report Code': 'Average Yield', 'Production Date': summaryMetrics.recordCount > 0 ? `${summaryMetrics.avgYield.toFixed(2)}%` : 'No data' },
            { 'Report Code': 'Total Readings', 'Production Date': summaryMetrics.recordCount },
            {},
        ];

        const detailRows = tableData.map(d => ({
            'Report Code': d.report_code,
            'Production Date': d.production_date,
            'Unit': d.unit,
            [`Used (${d.unit})`]: d.used,
            [`Losses (${d.unit})`]: d.losses,
            'Loss %': `${d.loss_percentage.toFixed(2)}%`,
            'Yield %': `${d.yield.toFixed(2)}%`,
        }));

        exportToExcel([...summaryRows, ...detailRows], `Water_Analytics_${(dateRangeLabel || 'export').replace(/ to /g, '_')}`, 'Water Analytics');
    };

    return (
        <>
            <div className="d-flex align-items-center justify-content-between mb-3">
                <div>
                    <h4 className="mb-0">Water Analytics</h4>
                    <small className="text-muted">Water consumption, losses, and yield performance</small>
                </div>
                <div className="d-flex gap-2 align-items-center">
                    {loading && <span className="spinner-border spinner-border-sm text-primary" role="status" />}
                    <div className="btn-group btn-group-sm">
                        <button className={`btn ${timeRange === 'today' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setTimeRange('today')}>Today</button>
                        <button className={`btn ${timeRange === 'week' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setTimeRange('week')}>Week</button>
                        <button className={`btn ${timeRange === 'month' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setTimeRange('month')}>Month</button>
                    </div>
                    <div className="btn-group btn-group-sm">
                        <button className={`btn ${viewMode === 'chart' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setViewMode('chart')}>
                            <i className="ti ti-chart-bar me-1"></i>Chart
                        </button>
                        <button className={`btn ${viewMode === 'table' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setViewMode('table')}>
                            <i className="ti ti-table me-1"></i>Table
                        </button>
                    </div>
                    <button onClick={handleExport} className="btn btn-success btn-sm">
                        <i className="ti ti-file-spreadsheet me-1"></i>Export
                    </button>
                    <button className="btn btn-outline-secondary btn-sm" onClick={fetchData}>
                        <i className="ti ti-refresh me-1"></i>Refresh
                    </button>
                </div>
            </div>

            <FilterInputs showPetLine={false} showProduct={false} />

            {dateRangeLabel && (
                <div className="alert alert-light border mb-3">
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                        <span><i className="ti ti-calendar me-2 text-primary"></i>Period: <strong>{dateRangeLabel}</strong></span>
                        <small className="text-muted">Total Consumption &amp; Loss Breakdown</small>
                    </div>
                    <div className="row g-2 mt-1">
                        <div className="col-md-4">
                            <div className="bg-white border rounded-3 px-3 py-2 h-100">
                                <small className="text-muted d-block">Total Water Consumed</small>
                                <strong className="fs-5 text-primary">
                                    {summaryMetrics.recordCount > 0 ? `${formatValue(summaryMetrics.totalConsumed)} ${summaryMetrics.unit}` : 'No data'}
                                </strong>
                            </div>
                        </div>
                        <div className="col-md-4">
                            <div className="bg-white border rounded-3 px-3 py-2 h-100">
                                <small className="text-muted d-block">Total Losses</small>
                                <strong className="fs-5 text-danger">
                                    {summaryMetrics.recordCount > 0 ? `${formatValue(summaryMetrics.totalLosses)} ${summaryMetrics.unit}` : 'No data'}
                                </strong>
                            </div>
                        </div>
                        <div className="col-md-4">
                            <div className="bg-white border rounded-3 px-3 py-2 h-100">
                                <small className="text-muted d-block">Average Yield</small>
                                <strong className="fs-5 text-success">
                                    {summaryMetrics.recordCount > 0 ? `${summaryMetrics.avgYield.toFixed(1)}%` : 'No data'}
                                </strong>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="text-center py-5"><span className="spinner-border text-primary"></span></div>
            ) : tableData.length === 0 ? (
                <div className="text-center py-5 text-muted">
                    <i className="ti ti-droplet fs-1 mb-3 d-block"></i>
                    <p className="mb-1">No water data available for this period</p>
                    {activePeriodText && <small className="text-muted d-block">{activePeriodText}</small>}
                </div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="row g-3 mb-4">
                        <div className="col-md-4">
                            <div className="card border-0 shadow-sm h-100">
                                <div className="card-body py-3">
                                    <div className="d-flex align-items-center justify-content-between mb-2">
                                        <span className="text-muted fs-13">Total Water Consumed</span>
                                        <span className="badge bg-primary-subtle text-primary"><i className="ti ti-droplet"></i></span>
                                    </div>
                                    <h3 className="mb-0 fw-bold text-primary">
                                        {summaryMetrics.recordCount > 0 ? formatValue(summaryMetrics.totalConsumed) : '0'}{' '}
                                        <span className="fs-13 text-muted">{summaryMetrics.unit}</span>
                                    </h3>
                                    <small className="text-muted">{summaryMetrics.recordCount} reading{summaryMetrics.recordCount !== 1 ? 's' : ''}</small>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-4">
                            <div className="card border-0 shadow-sm h-100">
                                <div className="card-body py-3">
                                    <div className="d-flex align-items-center justify-content-between mb-2">
                                        <span className="text-muted fs-13">Total Losses</span>
                                        <span className="badge bg-danger-subtle text-danger"><i className="ti ti-alert-triangle"></i></span>
                                    </div>
                                    <h3 className="mb-0 fw-bold text-danger">
                                        {summaryMetrics.recordCount > 0 ? formatValue(summaryMetrics.totalLosses) : '0'}{' '}
                                        <span className="fs-13 text-muted">{summaryMetrics.unit}</span>
                                    </h3>
                                    <small className="text-muted">
                                        {summaryMetrics.recordCount > 0 && summaryMetrics.totalConsumed > 0
                                            ? `${((summaryMetrics.totalLosses / summaryMetrics.totalConsumed) * 100).toFixed(2)}% loss`
                                            : '0% loss'}
                                    </small>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-4">
                            <div className="card border-0 shadow-sm h-100">
                                <div className="card-body py-3">
                                    <div className="d-flex align-items-center justify-content-between mb-2">
                                        <span className="text-muted fs-13">Average Yield</span>
                                        <span className="badge bg-success-subtle text-success"><i className="ti ti-chart-arrows"></i></span>
                                    </div>
                                    <h3 className="mb-0 fw-bold text-success">
                                        {summaryMetrics.recordCount > 0 ? `${summaryMetrics.avgYield.toFixed(1)}%` : '0.0%'}
                                    </h3>
                                    <small className="text-muted">Target: 100%</small>
                                </div>
                            </div>
                        </div>
                    </div>

                    {viewMode === 'chart' ? (
                        <>
                            {/* Chart: Water Consumption by Date */}
                            <div className="card mb-4">
                                <div className="card-header">
                                    <h6 className="mb-0">Water Consumption by Date</h6>
                                    <small className="text-muted">Daily water consumption ({summaryMetrics.unit})</small>
                                </div>
                                <div className="card-body">
                                    {dailyChartData.length === 0 ? (
                                        <p className="text-center text-muted py-5">No chart data</p>
                                    ) : (
                                        <ResponsiveContainer width="100%" height={340}>
                                            <BarChart data={dailyChartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                                                <Tooltip formatter={(v) => [`${formatValue(v)} ${summaryMetrics.unit}`, 'Water Consumed']} />
                                                <Bar dataKey="used" name={`Water (${summaryMetrics.unit})`} fill="#06b6d4" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>

                            {/* Detail Table */}
                            <div className="card">
                                <div className="card-header d-flex align-items-center justify-content-between">
                                    <div>
                                        <h6 className="mb-0">Water Reading Details</h6>
                                        <small className="text-muted">{tableData.length} records</small>
                                    </div>
                                </div>
                                <div className="card-body p-0">
                                    <div className="table-responsive" style={{ maxHeight: 420 }}>
                                        <table className="table table-sm table-hover mb-0">
                                            <thead className="table-light sticky-top">
                                                <tr>
                                                    <th>Report Code</th>
                                                    <th>Production Date</th>
                                                    <th>Unit</th>
                                                    <th className="text-end">Used ({summaryMetrics.unit})</th>
                                                    <th className="text-end">Losses ({summaryMetrics.unit})</th>
                                                    <th className="text-end">Loss %</th>
                                                    <th className="text-end">Yield %</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {tableData.length === 0 ? (
                                                    <tr><td colSpan={7} className="text-center text-muted py-4">No water consumption data</td></tr>
                                                ) : tableData.map((row) => (
                                                    <tr key={row.id || `${row.report_code}-${row.production_date}`}>
                                                        <td className="fw-medium">{row.report_code}</td>
                                                        <td>{row.production_date}</td>
                                                        <td><span className="badge bg-secondary-subtle text-secondary">{row.unit}</span></td>
                                                        <td className="text-end fw-semibold text-primary">{formatValue(row.used)}</td>
                                                        <td className="text-end text-danger">{formatValue(row.losses)}</td>
                                                        <td className="text-end">{row.loss_percentage.toFixed(2)}%</td>
                                                        <td className="text-end fw-semibold text-success">{row.yield.toFixed(2)}%</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot className="table-light">
                                                <tr>
                                                    <th>Total / Average</th>
                                                    <th>{tableData.length} records</th>
                                                    <th>{summaryMetrics.unit}</th>
                                                    <th className="text-end text-primary">{formatValue(summaryMetrics.totalConsumed)}</th>
                                                    <th className="text-end text-danger">{formatValue(summaryMetrics.totalLosses)}</th>
                                                    <th className="text-end">
                                                        {summaryMetrics.totalConsumed > 0
                                                            ? `${((summaryMetrics.totalLosses / summaryMetrics.totalConsumed) * 100).toFixed(2)}%`
                                                            : '0.00%'}
                                                    </th>
                                                    <th className="text-end text-success">{summaryMetrics.avgYield.toFixed(2)}%</th>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        /* Table View */
                        <div className="card">
                            <div className="card-header d-flex align-items-center justify-content-between">
                                <div>
                                    <h6 className="mb-0">Water Consumption Records</h6>
                                    <small className="text-muted">{tableData.length} records {dateRangeLabel && `(${dateRangeLabel})`}</small>
                                </div>
                            </div>
                            <div className="card-body p-0">
                                <div className="table-responsive">
                                    <table className="table table-sm table-hover mb-0">
                                        <thead className="table-light">
                                            <tr>
                                                <th>Report Code</th>
                                                <th>Production Date</th>
                                                <th>Unit</th>
                                                <th className="text-end">Used ({summaryMetrics.unit})</th>
                                                <th className="text-end">Losses ({summaryMetrics.unit})</th>
                                                <th className="text-end">Loss %</th>
                                                <th className="text-end">Yield %</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tableData.length === 0 ? (
                                                <tr><td colSpan={7} className="text-center text-muted py-4">No water consumption data</td></tr>
                                            ) : tableData.map((row) => (
                                                <tr key={row.id || `${row.report_code}-${row.production_date}`}>
                                                    <td className="fw-medium">{row.report_code}</td>
                                                    <td>{row.production_date}</td>
                                                    <td><span className="badge bg-secondary-subtle text-secondary">{row.unit}</span></td>
                                                    <td className="text-end fw-semibold text-primary">{formatValue(row.used)}</td>
                                                    <td className="text-end text-danger">{formatValue(row.losses)}</td>
                                                    <td className="text-end">{row.loss_percentage.toFixed(2)}%</td>
                                                    <td className="text-end fw-semibold text-success">{row.yield.toFixed(2)}%</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="table-light">
                                            <tr>
                                                <th>Total / Average</th>
                                                <th>{tableData.length} records</th>
                                                <th>{summaryMetrics.unit}</th>
                                                <th className="text-end text-primary">{formatValue(summaryMetrics.totalConsumed)}</th>
                                                <th className="text-end text-danger">{formatValue(summaryMetrics.totalLosses)}</th>
                                                <th className="text-end">
                                                    {summaryMetrics.totalConsumed > 0
                                                        ? `${((summaryMetrics.totalLosses / summaryMetrics.totalConsumed) * 100).toFixed(2)}%`
                                                        : '0.00%'}
                                                </th>
                                                <th className="text-end text-success">{summaryMetrics.avgYield.toFixed(2)}%</th>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </>
    );
};

export default WaterReport;
