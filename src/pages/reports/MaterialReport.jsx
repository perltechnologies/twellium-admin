import React, { useState, useEffect, useCallback } from 'react';
import { productionApi } from '../../api/production';
import FilterInputs from '../../components/FilterInputs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { exportToExcel } from '../../utils/exportUtils';
import { useFilters } from '../../context/FilterContext';

const MaterialReport = () => {
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

            const res = await productionApi.getMaterialConsumptions(params);
            const consumptions = res.data?.data || res.data?.results || [];
            
            const materialMap = {};
            consumptions.forEach(c => {
                const pet = c.pet_name || 'Unknown';
                if (!materialMap[pet]) {
                    materialMap[pet] = { pet, preforms: 0, caps: 0, labels: 0, shrink: 0, bottles: 0 };
                }
                
                materialMap[pet].preforms += parseInt(c.preforms_used || 0);
                materialMap[pet].caps += parseInt(c.caps_used || 0);
                materialMap[pet].labels += parseInt(c.labels_used || 0);
                materialMap[pet].shrink += parseInt(c.shrink_used || 0);
                materialMap[pet].bottles += parseInt(c.bottles_produced || 0);
            });

            setData(Object.values(materialMap).sort((a, b) => {
                const aNum = parseInt(a.pet?.match(/(\d+)/)?.[0] || '999');
                const bNum = parseInt(b.pet?.match(/(\d+)/)?.[0] || '999');
                return aNum - bNum;
            }));
        } catch (err) {
            console.error('Failed to load material data:', err);
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
            'Preforms Used': d.preforms,
            'Caps Used': d.caps,
            'Labels Used': d.labels,
            'Shrink Used': d.shrink,
            'Bottles Produced': d.bottles,
            'Preform Efficiency': d.bottles > 0 ? ((d.bottles / d.preforms) * 100).toFixed(2) + '%' : 'N/A'
        }));
        exportToExcel(exportData, 'Material_Report');
    };

    const totals = data.reduce((acc, d) => ({
        preforms: acc.preforms + d.preforms,
        caps: acc.caps + d.caps,
        labels: acc.labels + d.labels,
        shrink: acc.shrink + d.shrink,
        bottles: acc.bottles + d.bottles
    }), { preforms: 0, caps: 0, labels: 0, shrink: 0, bottles: 0 });

    return (
        <>
            <div className="d-flex align-items-center justify-content-between mb-3">
                <h4 className="mb-0">Material Report</h4>
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
                                    <div className="text-muted mb-1">Total Preforms</div>
                                    <h4 className="mb-0">{totals.preforms.toLocaleString()}</h4>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-3">
                            <div className="card">
                                <div className="card-body">
                                    <div className="text-muted mb-1">Total Caps</div>
                                    <h4 className="mb-0">{totals.caps.toLocaleString()}</h4>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-3">
                            <div className="card">
                                <div className="card-body">
                                    <div className="text-muted mb-1">Total Labels</div>
                                    <h4 className="mb-0">{totals.labels.toLocaleString()}</h4>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-3">
                            <div className="card">
                                <div className="card-body">
                                    <div className="text-muted mb-1">Total Shrink</div>
                                    <h4 className="mb-0">{totals.shrink.toLocaleString()}</h4>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-3">
                            <div className="card">
                                <div className="card-body">
                                    <div className="text-muted mb-1">Total Bottles</div>
                                    <h4 className="mb-0">{totals.bottles.toLocaleString()}</h4>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="card mb-4">
                        <div className="card-header">
                            <h6 className="mb-0">Material Usage by PET Line</h6>
                        </div>
                        <div className="card-body">
                            <ResponsiveContainer width="100%" height={400}>
                                <BarChart data={data}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="pet" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="preforms" fill="#3b82f6" name="Preforms" />
                                    <Bar dataKey="caps" fill="#22c55e" name="Caps" />
                                    <Bar dataKey="labels" fill="#f59e0b" name="Labels" />
                                    <Bar dataKey="shrink" fill="#8b5cf6" name="Shrink" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <h6 className="mb-0">Material Details</h6>
                        </div>
                        <div className="card-body p-0">
                            <div className="table-responsive">
                                <table className="table table-hover mb-0">
                                    <thead className="table-light">
                                        <tr>
                                            <th>PET Line</th>
                                            <th className="text-end">Preforms</th>
                                            <th className="text-end">Caps</th>
                                            <th className="text-end">Labels</th>
                                            <th className="text-end">Shrink</th>
                                            <th className="text-end">Bottles</th>
                                            <th className="text-end">Efficiency</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.map(d => (
                                            <tr key={d.pet}>
                                                <td className="fw-medium">{d.pet}</td>
                                                <td className="text-end">{d.preforms.toLocaleString()}</td>
                                                <td className="text-end">{d.caps.toLocaleString()}</td>
                                                <td className="text-end">{d.labels.toLocaleString()}</td>
                                                <td className="text-end">{d.shrink.toLocaleString()}</td>
                                                <td className="text-end">{d.bottles.toLocaleString()}</td>
                                                <td className="text-end">
                                                    {d.bottles > 0 && d.preforms > 0 
                                                        ? ((d.bottles / d.preforms) * 100).toFixed(1) + '%'
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

export default MaterialReport;
