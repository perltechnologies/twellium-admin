import React, { useState, useEffect } from 'react';
import { productionApi } from '../../api/production';
import { DataTable } from '../../components/ui/DataTable';
import FilterInputs from '../../components/FilterInputs';
import { useApiWithFilters } from '../../utils/useApiWithFilters';

const ProductionReports = () => {
    const { data, loading, error, refetch, getParams } = useApiWithFilters(productionApi.getOeeSummary);
    const [selectedReport, setSelectedReport] = useState(null);
    const [showModal, setShowModal] = useState(false);

    const reports = Array.isArray(data) ? data : data?.data?.results || data?.results || data?.data || [];

    const exportToJSON = () => {
        const dataStr = JSON.stringify(reports, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `production-reports-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const exportToCSV = () => {
        if (!reports.length) return;
        const headers = ['Date', 'PET', 'Shift', 'OEE', 'Availability', 'Quality', 'Performance', 'Output', 'Downtime'];
        const rows = reports.map(r => [
            r.production_date,
            r.pet_name,
            r.shift_name,
            r.metrics?.oee?.toFixed(2) || 0,
            r.metrics?.availability?.toFixed(2) || 0,
            r.metrics?.quality?.toFixed(2) || 0,
            r.metrics?.performance?.toFixed(2) || 0,
            r.metrics?.details?.total_output_pcs || 0,
            r.metrics?.details?.total_downtime_mins || 0
        ]);
        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `production-reports-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const viewReport = (report) => {
        setSelectedReport(report);
        setShowModal(true);
    };

    const columns = [
        { key: 'production_date', label: 'Date' },
        { key: 'pet_name', label: 'PET' },
        { key: 'shift_name', label: 'Shift' },
        { key: 'metrics.oee', label: 'OEE (%)', render: (val) => val?.toFixed(1) || '0.0' },
        { key: 'metrics.availability', label: 'Availability (%)', render: (val) => val?.toFixed(1) || '0.0' },
        { key: 'metrics.quality', label: 'Quality (%)', render: (val) => val?.toFixed(1) || '0.0' },
        { key: 'metrics.performance', label: 'Performance (%)', render: (val) => val?.toFixed(1) || '0.0' },
        { key: 'metrics.details.total_output_pcs', label: 'Output', render: (val) => (val || 0).toLocaleString() },
        {
            key: 'actions',
            label: 'Actions',
            render: (_, report) => (
                <button className="btn btn-sm btn-outline-primary" onClick={() => viewReport(report)}>
                    <i className="ti ti-eye me-1"></i>View
                </button>
            )
        }
    ];

    return (
        <>
            <div className="d-flex align-items-center justify-content-between mb-3">
                <h4 className="mb-0">Production Reports</h4>
                <div className="d-flex gap-2">
                    <button className="btn btn-outline-success btn-sm" onClick={exportToCSV} disabled={!reports.length}>
                        <i className="ti ti-file-spreadsheet me-1"></i>Export CSV
                    </button>
                    <button className="btn btn-outline-primary btn-sm" onClick={exportToJSON} disabled={!reports.length}>
                        <i className="ti ti-file-code me-1"></i>Export JSON
                    </button>
                    <button className="btn btn-outline-secondary btn-sm" onClick={refetch}>
                        <i className="ti ti-refresh me-1"></i>Refresh
                    </button>
                </div>
            </div>

            <FilterInputs />

            {error && (
                <div className="alert alert-danger">
                    <i className="ti ti-alert-circle me-2"></i>{error}
                </div>
            )}

            <div className="card">
                <div className="card-body">
                    <DataTable
                        data={reports}
                        columns={columns}
                        loading={loading}
                        emptyMessage="No production reports found"
                    />
                </div>
            </div>

            {/* View Modal */}
            {showModal && selectedReport && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-lg modal-dialog-scrollable">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Production Report Details</h5>
                                <button className="btn-close" onClick={() => setShowModal(false)}></button>
                            </div>
                            <div className="modal-body">
                                <pre className="bg-light p-3 rounded" style={{ maxHeight: '500px', overflow: 'auto' }}>
                                    {JSON.stringify(selectedReport, null, 2)}
                                </pre>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ProductionReports;
