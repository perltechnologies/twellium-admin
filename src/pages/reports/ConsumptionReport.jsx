import React, { useState, useEffect, useCallback } from 'react';
import { productionApi } from '../../api/production';
import FilterInputs from '../../components/FilterInputs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { exportToExcel } from '../../utils/exportUtils';
import { useFilters } from '../../context/FilterContext';

const ConsumptionReport = () => {
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
            
            // Aggregate all consumption by PET from various sources
            const consumptionMap = {};
            reports.forEach(r => {
                const pet = r.pet_name || 'Unknown';
                if (!consumptionMap[pet]) {
                    consumptionMap[pet] = {
                        pet,
                        electricity: 0,
                        water: 0,
                        co2: 0,
                        syrup: 0,
                        bottles: 0
                    };
                }
                
                // Electricity from production readings or meters
                if (r.production_readings) {
                    consumptionMap[pet].electricity += parseFloat(r.production_readings.electricity_used || r.production_readings.electricity_consumption || 0);
                }
                
                // Water from batches
                if (r.batches && Array.isArray(r.batches)) {
                    r.batches.forEach(batch => {
                        consumptionMap[pet].water += parseFloat(batch.water_used || batch.water_quantity || 0);
                        consumptionMap[pet].syrup += parseFloat(batch.syrup_used || batch.syrup_quantity || 0);
                    });
                }
                
                // CO2 from co2_readings
                if (r.co2_readings) {
                    consumptionMap[pet].co2 += parseFloat(r.co2_readings.co2_used || r.co2_readings.co2_consumption || 0);
                }
                
                // Bottles from production readings
                if (r.production_readings) {
                    consumptionMap[pet].bottles += parseInt(r.production_readings.total_output || r.production_readings.total_output_pcs || 0);
                }
            });

            setData(Object.values(consumptionMap).sort((a, b) => {
                const aNum = parseInt(a.pet?.match(/(\d+)/)?.[0] || '999');
                const bNum = parseInt(b.pet?.match(/(\d+)/)?.[0] || '999');
                return aNum - bNum;
            }));
        } catch (err) {
            console.error('Failed to load consumption data:', err);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleExport = () => {
        const exportData = data.map(d => ({
            'PET Line': d.pet,
            'Electricity (kWh)': d.electricity,
            'Water (L)': d.water,
            'CO2 (kg)': d.co2,
            'Syrup (L)': d.syrup,
            'Bottles Produced': d.bottles,
            'kWh per 1000 Bottles': d.bottles > 0 ? ((d.electricity / d.bottles) * 1000).toFixed(2) : 'N/A',
            'Water per Bottle (ml)': d.bottles > 0 ? ((d.water * 1000) / d.bottles).toFixed(2) : 'N/A'
        }));
        exportToExcel(exportData, 'Consumption_Report');
    };

    const totals = data.reduce((acc, d) => ({
        electricity: acc.electricity + d.electricity,
        water: acc.water + d.water,
        co2: acc.co2 + d.co2,
        syrup: acc.syrup + d.syrup,
        bottles: acc.bottles + d.bottles
    }), { electricity: 0, water: 0, co2: 0, syrup: 0, bottles: 0 });

    const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

    return (
        <>
            <div className="d-flex align-items-center justify-content-between mb-3">
                <h4 className="mb-0">Consumption Report</h4>
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
                        <div className="col-md-3">
                            <div className="card">
                                <div className="card-body">
                                    <div className="text-muted mb-1">
                                        <i className="ti ti-bolt me-1"></i>Electricity
                                    </div>
                                    <h4 className="mb-0">{totals.electricity.toLocaleString()} kWh</h4>
                                    <small className="text-muted">
                                        {totals.bottles > 0 
                                            ? ((totals.electricity / totals.bottles) * 1000).toFixed(2) + ' kWh/1k bottles'
                                            : 'N/A'}
                                    </small>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-3">
                            <div className="card">
                                <div className="card-body">
                                    <div className="text-muted mb-1">
                                        <i className="ti ti-droplet me-1"></i>Water
                                    </div>
                                    <h4 className="mb-0">{totals.water.toLocaleString()} L</h4>
                                    <small className="text-muted">
                                        {totals.bottles > 0 
                                            ? ((totals.water * 1000) / totals.bottles).toFixed(2) + ' ml/bottle'
                                            : 'N/A'}
                                    </small>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-3">
                            <div className="card">
                                <div className="card-body">
                                    <div className="text-muted mb-1">
                                        <i className="ti ti-cloud me-1"></i>CO2
                                    </div>
                                    <h4 className="mb-0">{totals.co2.toLocaleString()} kg</h4>
                                    <small className="text-muted">
                                        {totals.bottles > 0 
                                            ? ((totals.co2 * 1000) / totals.bottles).toFixed(2) + ' g/bottle'
                                            : 'N/A'}
                                    </small>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-3">
                            <div className="card">
                                <div className="card-body">
                                    <div className="text-muted mb-1">
                                        <i className="ti ti-bottle me-1"></i>Syrup
                                    </div>
                                    <h4 className="mb-0">{totals.syrup.toLocaleString()} L</h4>
                                    <small className="text-muted">
                                        {totals.bottles > 0 
                                            ? ((totals.syrup * 1000) / totals.bottles).toFixed(2) + ' ml/bottle'
                                            : 'N/A'}
                                    </small>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="row g-3 mb-4">
                        <div className="col-md-6">
                            <div className="card">
                                <div className="card-header">
                                    <h6 className="mb-0">Electricity Consumption by PET</h6>
                                </div>
                                <div className="card-body">
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={data}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="pet" />
                                            <YAxis label={{ value: 'kWh', angle: -90, position: 'insideLeft' }} />
                                            <Tooltip />
                                            <Bar dataKey="electricity" name="Electricity (kWh)">
                                                {data.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="card">
                                <div className="card-header">
                                    <h6 className="mb-0">Water Consumption by PET</h6>
                                </div>
                                <div className="card-body">
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={data}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="pet" />
                                            <YAxis label={{ value: 'Liters', angle: -90, position: 'insideLeft' }} />
                                            <Tooltip />
                                            <Bar dataKey="water" name="Water (L)">
                                                {data.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <h6 className="mb-0">Consumption Details</h6>
                        </div>
                        <div className="card-body p-0">
                            <div className="table-responsive">
                                <table className="table table-hover mb-0">
                                    <thead className="table-light">
                                        <tr>
                                            <th>PET Line</th>
                                            <th className="text-end">Electricity (kWh)</th>
                                            <th className="text-end">Water (L)</th>
                                            <th className="text-end">CO2 (kg)</th>
                                            <th className="text-end">Syrup (L)</th>
                                            <th className="text-end">Bottles</th>
                                            <th className="text-end">kWh/1k Bottles</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.map(d => (
                                            <tr key={d.pet}>
                                                <td className="fw-medium">{d.pet}</td>
                                                <td className="text-end">{d.electricity.toLocaleString()}</td>
                                                <td className="text-end">{d.water.toLocaleString()}</td>
                                                <td className="text-end">{d.co2.toLocaleString()}</td>
                                                <td className="text-end">{d.syrup.toLocaleString()}</td>
                                                <td className="text-end">{d.bottles.toLocaleString()}</td>
                                                <td className="text-end">
                                                    {d.bottles > 0 
                                                        ? ((d.electricity / d.bottles) * 1000).toFixed(2)
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

export default ConsumptionReport;
