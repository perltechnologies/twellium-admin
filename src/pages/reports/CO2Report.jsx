import React, { useState, useEffect, useCallback } from 'react';
import { productionApi } from '../../api/production';
import FilterInputs from '../../components/FilterInputs';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { exportToExcel } from '../../utils/exportUtils';
import { useFilters } from '../../context/FilterContext';

const CO2Report = () => {
    const { filters } = useFilters();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pets, setPets] = useState([]);

    useEffect(() => {
        productionApi.getPets({ page_size: 100 })
            .then(res => { const d = res.data?.data ?? res.data; setPets((Array.isArray(d) ? d : (d?.results || [])).filter(p => !p.pet_name?.toLowerCase().includes('can'))); })
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
            
            // Group by date and PET from co2_readings
            const co2Map = {};
            reports.forEach(r => {
                const date = r.production_date;
                const pet = r.pet_name || 'Unknown';
                const key = `${date}_${pet}`;
                
                if (!co2Map[key]) {
                    co2Map[key] = {
                        date,
                        pet,
                        co2_used: 0,
                        bottles: 0,
                        pressure: 0,
                        temperature: 0,
                        count: 0
                    };
                }
                
                // Extract from co2_readings object
                if (r.co2_readings) {
                    co2Map[key].co2_used += parseFloat(r.co2_readings.co2_used || r.co2_readings.co2_consumption || 0);
                    co2Map[key].pressure += parseFloat(r.co2_readings.pressure || r.co2_readings.co2_pressure || 0);
                    co2Map[key].temperature += parseFloat(r.co2_readings.temperature || r.co2_readings.co2_temperature || 0);
                    co2Map[key].count += 1;
                }
                
                // Get bottles from production readings
                if (r.production_readings) {
                    co2Map[key].bottles += parseInt(r.production_readings.total_output || r.production_readings.total_output_pcs || 0);
                }
            });

            // Calculate averages
            const result = Object.values(co2Map).map(d => ({
                ...d,
                pressure: d.count > 0 ? (d.pressure / d.count).toFixed(2) : 0,
                temperature: d.count > 0 ? (d.temperature / d.count).toFixed(2) : 0
            }));

            setData(result.sort((a, b) => 
                a.date.localeCompare(b.date) || a.pet.localeCompare(b.pet)
            ));
        } catch (err) {
            console.error('Failed to load CO2 data:', err);
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
            'CO2 Used (kg)': d.co2_used,
            'Bottles Produced': d.bottles,
            'Pressure (bar)': d.pressure,
            'Temperature (°C)': d.temperature,
            'CO2 per Bottle (g)': d.bottles > 0 ? ((d.co2_used * 1000) / d.bottles).toFixed(2) : 'N/A'
        }));
        exportToExcel(exportData, 'CO2_Report');
    };

    const totals = data.reduce((acc, d) => ({
        co2: acc.co2 + d.co2_used,
        bottles: acc.bottles + d.bottles
    }), { co2: 0, bottles: 0 });

    // Chart data grouped by date
    const chartData = data.reduce((acc, d) => {
        const existing = acc.find(x => x.date === d.date);
        if (existing) {
            existing[d.pet] = d.co2_used;
        } else {
            acc.push({ date: d.date, [d.pet]: d.co2_used });
        }
        return acc;
    }, []);

    const petNames = [...new Set(data.map(d => d.pet))];
    const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

    return (
        <>
            <div className="d-flex align-items-center justify-content-between mb-3">
                <h4 className="mb-0">CO2 Report</h4>
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
                                    <div className="text-muted mb-1">Total CO2 Used</div>
                                    <h4 className="mb-0">{totals.co2.toLocaleString()} kg</h4>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-4">
                            <div className="card">
                                <div className="card-body">
                                    <div className="text-muted mb-1">Total Bottles</div>
                                    <h4 className="mb-0">{totals.bottles.toLocaleString()}</h4>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-4">
                            <div className="card">
                                <div className="card-body">
                                    <div className="text-muted mb-1">Avg CO2/Bottle</div>
                                    <h4 className="mb-0">
                                        {totals.bottles > 0 
                                            ? ((totals.co2 * 1000) / totals.bottles).toFixed(2) + ' g'
                                            : 'N/A'}
                                    </h4>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="card mb-4">
                        <div className="card-header">
                            <h6 className="mb-0">CO2 Usage Trend</h6>
                        </div>
                        <div className="card-body">
                            <ResponsiveContainer width="100%" height={400}>
                                <AreaChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" />
                                    <YAxis label={{ value: 'Kilograms', angle: -90, position: 'insideLeft' }} />
                                    <Tooltip />
                                    <Legend />
                                    {petNames.map((pet, idx) => (
                                        <Area 
                                            key={pet} 
                                            type="monotone" 
                                            dataKey={pet} 
                                            stackId="1"
                                            stroke={colors[idx % colors.length]} 
                                            fill={colors[idx % colors.length]}
                                            fillOpacity={0.6}
                                        />
                                    ))}
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <h6 className="mb-0">CO2 Details</h6>
                        </div>
                        <div className="card-body p-0">
                            <div className="table-responsive">
                                <table className="table table-hover mb-0">
                                    <thead className="table-light">
                                        <tr>
                                            <th>Date</th>
                                            <th>PET Line</th>
                                            <th className="text-end">CO2 (kg)</th>
                                            <th className="text-end">Bottles</th>
                                            <th className="text-end">Pressure (bar)</th>
                                            <th className="text-end">Temp (°C)</th>
                                            <th className="text-end">g/Bottle</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.map((d, idx) => (
                                            <tr key={idx}>
                                                <td>{d.date}</td>
                                                <td className="fw-medium">{d.pet}</td>
                                                <td className="text-end">{d.co2_used.toLocaleString()}</td>
                                                <td className="text-end">{d.bottles.toLocaleString()}</td>
                                                <td className="text-end">{d.pressure}</td>
                                                <td className="text-end">{d.temperature}</td>
                                                <td className="text-end">
                                                    {d.bottles > 0 
                                                        ? ((d.co2_used * 1000) / d.bottles).toFixed(2)
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

export default CO2Report;
