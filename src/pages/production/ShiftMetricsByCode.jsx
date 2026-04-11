import React, { useState, useEffect } from 'react';
import { productionApi } from '../../api/production';
import { AlertCircle, TrendingUp, Clock, Activity } from 'lucide-react';

const ShiftMetricsByCode = () => {
    const [reportCode, setReportCode] = useState('');
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchMetrics = async (code) => {
        if (!code) return;
        
        setLoading(true);
        setError('');
        
        try {
            const res = await productionApi.getOeeSummary({ report_code: code });
            const data = res.data?.results?.[0] || res.data?.data?.results?.[0] || res.data?.[0];
            
            if (data) {
                setMetrics(data);
            } else {
                setError('No metrics found for this report code');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to fetch metrics');
        } finally {
            setLoading(false);
        }
    };

    const quickFill = (shift) => {
        const today = new Date().toISOString().split('T')[0];
        const code = `PR-${today}-${shift}`;
        setReportCode(code);
        fetchMetrics(code);
    };

    return (
        <div className="container-fluid p-4">
            <div className="row mb-4">
                <div className="col-12">
                    <h4 className="mb-3">Shift Production Metrics</h4>
                    
                    <div className="card">
                        <div className="card-body">
                            <div className="row g-3 align-items-end">
                                <div className="col-md-6">
                                    <label className="form-label">Report Code</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="e.g., PR-2026-04-10-NIGHT"
                                        value={reportCode}
                                        onChange={(e) => setReportCode(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && fetchMetrics(reportCode)}
                                    />
                                </div>
                                <div className="col-md-6">
                                    <button 
                                        className="btn btn-primary me-2"
                                        onClick={() => fetchMetrics(reportCode)}
                                        disabled={loading || !reportCode}
                                    >
                                        {loading ? 'Loading...' : 'Fetch Metrics'}
                                    </button>
                                    <button 
                                        className="btn btn-outline-secondary me-2"
                                        onClick={() => quickFill('DAY')}
                                    >
                                        Today DAY
                                    </button>
                                    <button 
                                        className="btn btn-outline-secondary"
                                        onClick={() => quickFill('NIGHT')}
                                    >
                                        Today NIGHT
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {error && (
                <div className="alert alert-danger d-flex align-items-center">
                    <AlertCircle className="me-2" size={20} />
                    {error}
                </div>
            )}

            {metrics && (
                <div className="row g-4">
                    <div className="col-md-3">
                        <div className="card">
                            <div className="card-body">
                                <div className="d-flex align-items-center mb-2">
                                    <TrendingUp className="text-primary me-2" size={20} />
                                    <h6 className="mb-0">OEE</h6>
                                </div>
                                <h3 className="mb-0">{metrics.oee?.toFixed(1) || 0}%</h3>
                            </div>
                        </div>
                    </div>
                    
                    <div className="col-md-3">
                        <div className="card">
                            <div className="card-body">
                                <div className="d-flex align-items-center mb-2">
                                    <Activity className="text-success me-2" size={20} />
                                    <h6 className="mb-0">Production</h6>
                                </div>
                                <h3 className="mb-0">{metrics.total_production?.toLocaleString() || 0}</h3>
                            </div>
                        </div>
                    </div>
                    
                    <div className="col-md-3">
                        <div className="card">
                            <div className="card-body">
                                <div className="d-flex align-items-center mb-2">
                                    <Clock className="text-warning me-2" size={20} />
                                    <h6 className="mb-0">Downtime</h6>
                                </div>
                                <h3 className="mb-0">{metrics.total_downtime?.toFixed(1) || 0} hrs</h3>
                            </div>
                        </div>
                    </div>
                    
                    <div className="col-md-3">
                        <div className="card">
                            <div className="card-body">
                                <h6 className="mb-2">Shift</h6>
                                <h3 className="mb-0">{metrics.shift_name || '-'}</h3>
                            </div>
                        </div>
                    </div>

                    <div className="col-12">
                        <div className="card">
                            <div className="card-header">
                                <h6 className="mb-0">Details</h6>
                            </div>
                            <div className="card-body">
                                <div className="row">
                                    <div className="col-md-6">
                                        <p><strong>Date:</strong> {metrics.production_date}</p>
                                        <p><strong>Product:</strong> {metrics.product_name || '-'}</p>
                                        <p><strong>Line:</strong> {metrics.line_name || '-'}</p>
                                    </div>
                                    <div className="col-md-6">
                                        <p><strong>Availability:</strong> {metrics.availability?.toFixed(1) || 0}%</p>
                                        <p><strong>Performance:</strong> {metrics.performance?.toFixed(1) || 0}%</p>
                                        <p><strong>Quality:</strong> {metrics.quality?.toFixed(1) || 0}%</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ShiftMetricsByCode;
