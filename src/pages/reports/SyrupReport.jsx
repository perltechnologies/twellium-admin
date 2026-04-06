import React, { useState, useEffect, useCallback } from 'react';
import { productionApi } from '../../api/production';
import FilterInputs from '../../components/FilterInputs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { exportToExcel } from '../../utils/exportUtils';
import { useFilters } from '../../context/FilterContext';

const SyrupReport = () => {
    const { filters } = useFilters();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pets, setPets] = useState([]);

    useEffect(() => {
        productionApi.getPets({ page_size: 100 })
            .then(res => setPets((res.data.data || []).filter(p => !p.pet_name?.toLowerCase().includes('can'))))
            .catch(err => console.error('Failed to load pets:', err));
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page_size: 1000 };
            if (filters.pet) params.pet = filters.pet;
            if (filters.log_date) params.production_date = filters.log_date;
            if (filters.start_date) params.production_date_after = filters.start_date;
            if (filters.end_date) params.production_date_before = filters.end_date;

            const res = await productionApi.getReports(params);
            const reports = res.data?.data || res.data?.results || [];
            
            // Group by date and PET from syrup_readings
            const syrupMap = {};
            reports.forEach(r => {
                const date = r.production_date;
                const pet = r.pet_name || 'Unknown';
                const key = `${date}_${pet}`;
                
                if (!syrupMap[key]) {
                    syrupMap[key] = {
                        date,
                        pet,
                        syrup_used: 0,
                        water_used: 0,
                        bottles: 0,
                        brix_level: 0,
                        count: 0
                    };
                }
                
                // Extract from syrup_readings object
                if (r.syrup_readings) {
                    syrupMap[key].brix_level += parseFloat(r.syrup_readings.brix || r.syrup_readings.brix_level || 0);
                    syrupMap[key].count += 1;
                }
                
                // Get bottles from production readings
                if (r.production_readings) {
                    syrupMap[key].bottles += parseInt(r.production_readings.total_output || r.production_readings.total_output_pcs || 0);
                }
                
                // Extract from batches array for syrup/water usage
                if (r.batches && Array.isArray(r.batches)) {
                    r.batches.forEach(batch => {
                        syrupMap[key].syrup_used += parseFloat(batch.syrup_used || batch.syrup_quantity || 0);
                        syrupMap[key].water_used += parseFloat(batch.water_used || batch.water_quantity || 0);
                    });
                }
            });

            // Calculate average brix
            const result = Object.values(syrupMap).map(d => ({
                ...d,
                brix_level: d.count > 0 ? (d.brix_level / d.count).toFixed(2) : 0
            }));

            setData(result.sort((a, b) => 
                a.date.localeCompare(b.date) || a.pet.localeCompare(b.pet)
            ));
        } catch (err) {
            console.error('Failed to load syrup data:', err);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleExport = () => {
        const exportData = data.map(d => ({
            'Date': d.date,
            'PET Line': d.pet,
            'Syrup Used (L)': d.syrup_used,
            'Water Used (L)': d.water_used,
            'Bottles Produced': d.bottles,
            'Brix Level': d.brix_level,
            'Syrup per Bottle (ml)': d.bottles > 0 ? ((d.syrup_used * 1000) / d.bottles).toFixed(2) : 'N/A'
        }));
        exportToExcel(exportData, 'Syrup_Report');
    };

    const totals = data.reduce((acc, d) => ({
        syrup: acc.syrup + d.syrup_used,
        water: acc.water + d.water_used,
        bottles: acc.bottles + d.bottles
    }), { syrup: 0, water: 0, bottles: 0 });

    // Chart data grouped by date
    const chartData = data.reduce((acc, d) => {
        const existing = acc.find(x => x.date === d.date);
        if (existing) {
            existing[d.pet] = d.syrup_used;
        } else {
            acc.push({ date: d.date, [d.pet]: d.syrup_used });
        }
        return acc;
    }, []);

    const petNames = [...new Set(data.map(d => d.pet))];
    const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

    return (
        <>
            <div className="d-flex align-items-center justify-content-between mb-3">
                <h4 className="mb-0">Syrup Report</h4>
                <button onClick={handleExport} className="btn btn-outline-primary btn-sm">
                    <i className="ti ti-download me-1"></i>Export
                </button>
            </div>

            <FilterInputs />

            {loading ? (
                <div className="text-center py-5"><span className="spinner-border"></span></div>
            ) : (
                <>
                    <div className="row g-3 mb-4">
                        <div className="col-md-4">
                            <div className="card">
                                <div className="card-body">
                                    <div className="text-muted mb-1">Total Syrup Used</div>
                                    <h4 className="mb-0">{totals.syrup.toLocaleString()} L</h4>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-4">
                            <div className="card">
                                <div className="card-body">
                                    <div className="text-muted mb-1">Total Water Used</div>
                                    <h4 className="mb-0">{totals.water.toLocaleString()} L</h4>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-4">
                            <div className="card">
                                <div className="card-body">
                                    <div className="text-muted mb-1">Avg Syrup/Bottle</div>
                                    <h4 className="mb-0">
                                        {totals.bottles > 0 
                                            ? ((totals.syrup * 1000) / totals.bottles).toFixed(2) + ' ml'
                                            : 'N/A'}
                                    </h4>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="card mb-4">
                        <div className="card-header">
                            <h6 className="mb-0">Syrup Usage Trend</h6>
                        </div>
                        <div className="card-body">
                            <ResponsiveContainer width="100%" height={400}>
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" />
                                    <YAxis label={{ value: 'Liters', angle: -90, position: 'insideLeft' }} />
                                    <Tooltip />
                                    <Legend />
                                    {petNames.map((pet, idx) => (
                                        <Line 
                                            key={pet} 
                                            type="monotone" 
                                            dataKey={pet} 
                                            stroke={colors[idx % colors.length]} 
                                            strokeWidth={2}
                                        />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <h6 className="mb-0">Syrup Details</h6>
                        </div>
                        <div className="card-body p-0">
                            <div className="table-responsive">
                                <table className="table table-hover mb-0">
                                    <thead className="table-light">
                                        <tr>
                                            <th>Date</th>
                                            <th>PET Line</th>
                                            <th className="text-end">Syrup (L)</th>
                                            <th className="text-end">Water (L)</th>
                                            <th className="text-end">Bottles</th>
                                            <th className="text-end">Brix Level</th>
                                            <th className="text-end">ml/Bottle</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.map((d, idx) => (
                                            <tr key={idx}>
                                                <td>{d.date}</td>
                                                <td className="fw-medium">{d.pet}</td>
                                                <td className="text-end">{d.syrup_used.toLocaleString()}</td>
                                                <td className="text-end">{d.water_used.toLocaleString()}</td>
                                                <td className="text-end">{d.bottles.toLocaleString()}</td>
                                                <td className="text-end">{d.brix_level}</td>
                                                <td className="text-end">
                                                    {d.bottles > 0 
                                                        ? ((d.syrup_used * 1000) / d.bottles).toFixed(2)
                                                        : 'N/A'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </>
    );
};

export default SyrupReport;
