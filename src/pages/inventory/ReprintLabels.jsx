import React, { useState, useRef } from 'react';
import { inventoryApi } from '../../api/inventory';
import { toast } from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import BarcodeLabel from '../../components/inventory/BarcodeLabel';

const STAGES = ['PRODUCTION', 'WAREHOUSE', 'QUALIFIED', 'LOADING', 'LOADED', 'DAMAGED'];

const ReprintLabels = () => {
    const today = new Date().toISOString().split('T')[0];
    const [filters, setFilters] = useState({
        date: today,
        stage: 'PRODUCTION'
    });
    const [foundUnits, setFoundUnits] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedUnit, setSelectedUnit] = useState(null);

    const labelRef = useRef(null);

    const handlePrint = useReactToPrint({
        contentRef: labelRef,
        documentTitle: `Reprint_${selectedUnit?.barcode || 'label'}`,
    });

    const handleSearch = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await inventoryApi.getBarcodesByStage({
                stage: filters.stage,
                date: filters.date
            });
            const units = response.data?.data?.data || [];
            setFoundUnits(units);
            if (units.length === 0) {
                toast('No labels found for the selected criteria');
            }
        } catch (error) {
            toast.error('Failed to fetch labels');
        } finally {
            setLoading(false);
        }
    };

    const handlePrintLabel = (unit) => {
        setSelectedUnit(unit);
        setTimeout(() => {
            handlePrint();
        }, 300);
    };

    return (
        <div className="container-fluid">
            {/* Page Header */}
            <div className="row mb-4">
                <div className="col-12">
                    <div className="d-flex align-items-center justify-content-between">
                        <div>
                            <h4 className="mb-1">
                                <i className="ti ti-printer me-2"></i>
                                Reprint Labels
                            </h4>
                            <p className="text-muted mb-0">Search and reprint barcode labels by stage and date</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter Card */}
            <div className="row mb-4">
                <div className="col-12">
                    <div className="card">
                        <div className="card-header">
                            <h5 className="card-title mb-0">
                                <i className="ti ti-filter me-2"></i>
                                Filter Labels
                            </h5>
                        </div>
                        <div className="card-body">
                            <form onSubmit={handleSearch}>
                                <div className="row g-3 align-items-end">
                                    <div className="col-md-4">
                                        <label className="form-label">Date</label>
                                        <input
                                            type="date"
                                            className="form-control"
                                            value={filters.date}
                                            onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                                        />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label">Stage</label>
                                        <select
                                            className="form-select"
                                            value={filters.stage}
                                            onChange={(e) => setFilters({ ...filters, stage: e.target.value })}
                                        >
                                            {STAGES.map((stage) => (
                                                <option key={stage} value={stage}>{stage}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-md-4">
                                        <button
                                            type="submit"
                                            className="btn btn-primary w-100"
                                            disabled={loading}
                                        >
                                            <i className="ti ti-search me-2"></i>
                                            {loading ? 'Searching...' : 'Search'}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>

            {/* Results Table */}
            {foundUnits.length > 0 && (
                <div className="row">
                    <div className="col-12">
                        <div className="card">
                            <div className="card-header d-flex align-items-center justify-content-between">
                                <h5 className="card-title mb-0">
                                    <i className="ti ti-list me-2"></i>
                                    Results
                                </h5>
                                <span className="badge bg-soft-primary text-primary">
                                    {foundUnits.length} labels found
                                </span>
                            </div>
                            <div className="card-body p-0">
                                <div className="table-responsive">
                                    <table className="table table-striped mb-0">
                                        <thead>
                                            <tr>
                                                <th>Barcode</th>
                                                <th>Product</th>
                                                <th>Line</th>
                                                <th>Qty</th>
                                                <th>Sequence</th>
                                                <th className="text-end">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {foundUnits.map((unit) => (
                                                <tr key={unit.id}>
                                                    <td>
                                                        <code>{unit.barcode}</code>
                                                    </td>
                                                    <td>{unit.product_name}</td>
                                                    <td>{unit.pet_name}</td>
                                                    <td>{unit.quantity}</td>
                                                    <td>{unit.pet_sequence}</td>
                                                    <td className="text-end">
                                                        <button
                                                            className="btn btn-sm btn-outline-primary"
                                                            onClick={() => handlePrintLabel(unit)}
                                                        >
                                                            <i className="ti ti-printer me-1"></i>
                                                            Print
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden Print Area */}
            <div style={{ display: 'none' }}>
                <div ref={labelRef}>
                    {selectedUnit && (
                        <BarcodeLabel
                            barcode={selectedUnit.barcode}
                            product={selectedUnit.product_name}
                            line={selectedUnit.pet_name}
                            quantity={selectedUnit.quantity}
                            sequence={selectedUnit.pet_sequence}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReprintLabels;
