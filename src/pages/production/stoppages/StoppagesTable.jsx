import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { productionApi } from '../../../api/production';
import { useFilters } from '../../../context/FilterContext';
import FilterInputs from '../../../components/FilterInputs';

const formatMins = (mins) => {
    if (!mins) return '0m';
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
};

const StoppagesTable = () => {
    const navigate = useNavigate();
    const { filters } = useFilters();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const params = { page_size: 1000 };
                if (filters.start_date && filters.end_date) {
                    params.start_datetime = filters.start_date + 'T00:00:00Z';
                    params.end_datetime = filters.end_date + 'T23:59:59Z';
                } else if (filters.log_date) {
                    params.start_datetime = filters.log_date + 'T00:00:00Z';
                    params.end_datetime = filters.log_date + 'T23:59:59Z';
                }
                if (filters.pet) params.pet = filters.pet;
                const res = await productionApi.getStoppagesSummary(params);
                const outer = res?.data?.data || res?.data || {};
                const items = (outer.data || []).filter(r => !r.pet_name?.toLowerCase().includes('can'));
                setData(items);
            } catch (err) {
                console.error('Failed to fetch stoppages summary:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [filters]);

    // Group by PET, then by date
    const grouped = useMemo(() => {
        const map = {};
        data.forEach(item => {
            const pet = item.pet_name || 'Unknown';
            if (!map[pet]) map[pet] = {};
            const date = item.log_date || 'Unknown';
            if (!map[pet][date]) map[pet][date] = [];
            map[pet][date].push(item);
        });

        // Sort PETs numerically
        return Object.entries(map)
            .sort(([a], [b]) => {
                const aNum = parseInt(a.match(/(\d+)/)?.[0] || '999');
                const bNum = parseInt(b.match(/(\d+)/)?.[0] || '999');
                return aNum - bNum;
            })
            .map(([pet, dates]) => ({
                pet,
                dates: Object.entries(dates)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([date, items]) => {
                        const d = items[0]?.metrics?.details || {};
                        const perf = items[0]?.metrics?.performance || 0;
                        return {
                            date,
                            shift: items[0]?.shift_name || '',
                            planned_time: d.planned_time_mins || 0,
                            total_downtime: d.total_downtime_mins || 0,
                            planned_downtime: d.planned_downtime_mins || 0,
                            mech_downtime: d.mechanical_downtime_mins || 0,
                            performance: perf,
                            output: d.total_output_pcs || 0,
                        };
                    })
            }));
    }, [data]);

    return (
        <div className="container-fluid py-4">
            <button
                type="button"
                onClick={() => navigate('/dashboard/production/stoppages')}
                className="btn btn-link p-0 mb-2 text-decoration-none"
            >
                <i className="ti ti-arrow-left me-2"></i>
                Back to Stoppage Logs
            </button>
            <h4 className="fw-bold mb-3">All Stoppages</h4>
            <FilterInputs showPetLine={false} />

            {loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status" />
                </div>
            ) : grouped.length === 0 ? (
                <div className="alert alert-info">No stoppage data found for the selected filters.</div>
            ) : (
                grouped.map(({ pet, dates }) => (
                    <div key={pet} className="card mb-4 shadow-sm">
                        <div className="card-header bg-primary bg-opacity-10">
                            <h5 className="mb-0 fw-semibold">{pet}</h5>
                        </div>
                        <div className="table-responsive">
                            <table className="table table-hover table-striped mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th>Date</th>
                                        <th>Shift</th>
                                        <th className="text-end">Planned Time</th>
                                        <th className="text-end">Total Downtime</th>
                                        <th className="text-end">Planned Downtime</th>
                                        <th className="text-end">Mech Downtime</th>
                                        <th className="text-end">Performance</th>
                                        <th className="text-end">Output (pcs)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dates.map((row, i) => (
                                        <tr key={i}>
                                            <td>{row.date}</td>
                                            <td>{row.shift}</td>
                                            <td className="text-end">{formatMins(row.planned_time)}</td>
                                            <td className="text-end">{formatMins(row.total_downtime)}</td>
                                            <td className="text-end">{formatMins(row.planned_downtime)}</td>
                                            <td className="text-end">{formatMins(row.mech_downtime)}</td>
                                            <td className="text-end">
                                                <span className={`badge ${row.performance >= 85 ? 'bg-success' : row.performance >= 60 ? 'bg-warning' : 'bg-danger'}`}>
                                                    {row.performance.toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="text-end">{(row.output || 0).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};

export default StoppagesTable;
