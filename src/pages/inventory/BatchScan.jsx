import React, { useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { inventoryApi } from '../../api/inventory';
import BarcodeLabel from '../../components/inventory/BarcodeLabel';
import { toast } from 'react-hot-toast';

const BatchScan = () => {
    const location = useLocation();
    const { targetStage, title } = location.state || {};

    const [barcode, setBarcode] = useState('');
    const [scanResults, setScanResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [latestResult, setLatestResult] = useState(null);

    const inputRef = useRef(null);
    const labelRef = useRef(null);

    const handlePrint = useReactToPrint({
        contentRef: labelRef,
        documentTitle: `Label_${latestResult?.barcode || 'scan'}`,
    });

    // Session stats
    const totalScans = scanResults.length;
    const successCount = scanResults.filter(r => r.status === 'success').length;
    const errorCount = scanResults.filter(r => r.status === 'error').length;

    const handleScan = async (e) => {
        e.preventDefault();
        const value = barcode.trim();
        if (!value) return;

        if (!targetStage) {
            toast.error("No target stage configured. Please navigate from Warehouse Workflows.");
            return;
        }

        setLoading(true);
        try {
            const res = await inventoryApi.scanHandlingUnit({
                scan_values: [value],
                target_stage: targetStage
            });
            const data = res.data.data;
            const result = {
                barcode: value,
                product_name: data?.product_name || '-',
                pet_name: data?.pet_name || '-',
                quantity: data?.quantity || '-',
                status: 'success',
                timestamp: new Date()
            };
            setScanResults(prev => [result, ...prev]);
            setLatestResult(result);
            toast.success(`Scanned: ${value}`);
        } catch (err) {
            console.error(err);
            const message = err.response?.data?.message || "Scan failed";
            const result = {
                barcode: value,
                product_name: '-',
                pet_name: '-',
                quantity: '-',
                status: 'error',
                error: message,
                timestamp: new Date()
            };
            setScanResults(prev => [result, ...prev]);
            toast.error(message);
        } finally {
            setLoading(false);
            setBarcode('');
            inputRef.current?.focus();
        }
    };

    return (
        <div className="container-fluid">
            {/* Page Header */}
            <div className="row mb-4">
                <div className="col-12">
                    <div className="d-flex align-items-center gap-3 mb-2">
                        <div className="bg-light rounded p-2">
                            <i className="ti ti-scan fs-4 text-primary"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">
                                {title ? `Batch Scan — ${title}` : 'Batch Scan'}
                            </h4>
                            <p className="text-muted mb-0 fs-7">
                                {targetStage
                                    ? `Scanning units to stage: ${targetStage}`
                                    : 'No target stage selected'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="row g-3">
                {/* Scan Input & Stats */}
                <div className="col-md-8">
                    {/* Scan Input Card */}
                    <div className="card mb-3">
                        <div className="card-body">
                            <form onSubmit={handleScan}>
                                <div className="input-group input-group-lg">
                                    <span className="input-group-text">
                                        <i className="ti ti-barcode"></i>
                                    </span>
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        className="form-control"
                                        placeholder="Scan or enter barcode..."
                                        value={barcode}
                                        onChange={(e) => setBarcode(e.target.value)}
                                        autoFocus
                                        disabled={loading}
                                    />
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        disabled={loading || !barcode.trim()}
                                    >
                                        {loading ? (
                                            <span className="spinner-border spinner-border-sm" role="status"></span>
                                        ) : (
                                            <>
                                                <i className="ti ti-scan me-1"></i>
                                                Scan
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* Session Stats */}
                    <div className="row g-3 mb-3">
                        <div className="col-4">
                            <div className="card">
                                <div className="card-body text-center py-3">
                                    <h3 className="mb-0">{totalScans}</h3>
                                    <small className="text-muted">Total Scans</small>
                                </div>
                            </div>
                        </div>
                        <div className="col-4">
                            <div className="card border-success">
                                <div className="card-body text-center py-3">
                                    <h3 className="mb-0 text-success">{successCount}</h3>
                                    <small className="text-muted">Successes</small>
                                </div>
                            </div>
                        </div>
                        <div className="col-4">
                            <div className="card border-danger">
                                <div className="card-body text-center py-3">
                                    <h3 className="mb-0 text-danger">{errorCount}</h3>
                                    <small className="text-muted">Errors</small>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Scan Results Table */}
                    <div className="card">
                        <div className="card-header d-flex justify-content-between align-items-center">
                            <h5 className="card-title mb-0">
                                <i className="ti ti-list me-2"></i>
                                Scan Results
                            </h5>
                            {scanResults.length > 0 && (
                                <button
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={() => { setScanResults([]); setLatestResult(null); }}
                                >
                                    <i className="ti ti-trash me-1"></i>
                                    Clear
                                </button>
                            )}
                        </div>
                        <div className="card-body p-0">
                            {scanResults.length === 0 ? (
                                <div className="text-center py-5">
                                    <i className="ti ti-scan fs-1 text-muted d-block mb-2"></i>
                                    <p className="text-muted mb-0">No scans yet. Start scanning barcodes above.</p>
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <table className="table table-striped mb-0">
                                        <thead>
                                            <tr>
                                                <th>Barcode</th>
                                                <th>Product</th>
                                                <th>Line</th>
                                                <th>Qty</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {scanResults.map((result, index) => (
                                                <tr key={index}>
                                                    <td className="font-monospace">{result.barcode}</td>
                                                    <td>{result.product_name}</td>
                                                    <td>{result.pet_name}</td>
                                                    <td>{result.quantity}</td>
                                                    <td>
                                                        {result.status === 'success' ? (
                                                            <span className="badge bg-soft-success text-success">
                                                                <i className="ti ti-check me-1"></i>
                                                                Success
                                                            </span>
                                                        ) : (
                                                            <span className="badge bg-soft-danger text-danger">
                                                                <i className="ti ti-x me-1"></i>
                                                                Error
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Print Panel */}
                <div className="col-md-4">
                    <div className="card">
                        <div className="card-header">
                            <h5 className="card-title mb-0">
                                <i className="ti ti-printer me-2"></i>
                                Last Successful Scan
                            </h5>
                        </div>
                        <div className="card-body text-center">
                            {latestResult && latestResult.status === 'success' ? (
                                <>
                                    <div ref={labelRef}>
                                        <BarcodeLabel data={latestResult} />
                                    </div>
                                    <button
                                        className="btn btn-outline-secondary mt-3 w-100"
                                        onClick={handlePrint}
                                    >
                                        <i className="ti ti-printer me-2"></i>
                                        Print Label
                                    </button>
                                </>
                            ) : (
                                <div className="py-5">
                                    <i className="ti ti-printer-off fs-1 text-muted d-block mb-2"></i>
                                    <p className="text-muted mb-0">Successful scan label will appear here</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BatchScan;
