import React, { useState, useEffect, useRef } from 'react';
import { inventoryApi, productionApi, logisticsApi } from '../../api';
import { toast } from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import BarcodeLabel from '../../components/inventory/BarcodeLabel';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const STAGES = ['PRODUCTION', 'WAREHOUSE', 'QUALIFIED', 'EXTERNAL_WAREHOUSE', 'LOADING', 'LOADED', 'DAMAGED', 'FAULTY'];

const BulkBarcodePrinting = () => {
    const today = new Date().toISOString().split('T')[0];
    const [filters, setFilters] = useState({
        startDate: today,
        endDate: today,
        productType: '',
        petName: '',
        batchNumber: '',
    });
    const [barcodes, setBarcodes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pets, setPets] = useState([]);
    const [products, setProducts] = useState([]);
    const [batches, setBatches] = useState([]);
    const [selectedForPrint, setSelectedForPrint] = useState([]);
    const [printing, setPrinting] = useState(false);
    const [printQueue, setPrintQueue] = useState([]);
    const [currentPrintIndex, setCurrentPrintIndex] = useState(0);
    const printRef = useRef(null);

    useEffect(() => {
        fetchDropdownData();
    }, []);

    const fetchDropdownData = async () => {
        try {
            const [petsRes, productsRes, batchesRes] = await Promise.all([
                productionApi.getPets(),
                inventoryApi.getProducts(),
                productionApi.getBatches(),
            ]);
            setPets(petsRes.data?.data?.data || petsRes.data?.data || []);
            setProducts(productsRes.data?.data?.data || productsRes.data?.data || []);
            setBatches(batchesRes.data?.data?.data || batchesRes.data?.data || []);
        } catch (error) {
            console.error('Failed to fetch dropdown data:', error);
        }
    };

    const handleSearch = async () => {
        setLoading(true);
        try {
            const params = {};
            if (filters.startDate) params.start_date = filters.startDate;
            if (filters.endDate) params.end_date = filters.endDate;
            if (filters.productType) params.product_type = filters.productType;
            if (filters.petName) params.pet_name = filters.petName;
            if (filters.batchNumber) params.batch_number = filters.batchNumber;

            const response = await inventoryApi.getBulkBarcodes(params);
            const data = response.data?.data?.data || response.data?.data || [];
            setBarcodes(Array.isArray(data) ? data : []);
            setSelectedForPrint([]);
            if (data.length === 0) {
                toast('No barcodes found for the selected criteria');
            } else {
                toast.success(`Found ${data.length} barcodes`);
            }
        } catch (error) {
            console.error('Failed to fetch barcodes:', error);
            toast.error('Failed to fetch barcodes');
        } finally {
            setLoading(false);
        }
    };

    const toggleSelect = (barcode) => {
        setSelectedForPrint(prev =>
            prev.some(b => b.id === barcode.id)
                ? prev.filter(b => b.id !== barcode.id)
                : [...prev, barcode]
        );
    };

    const selectAll = () => {
        setSelectedForPrint(barcodes);
    };

    const deselectAll = () => {
        setSelectedForPrint([]);
    };

    const handlePrintSingle = (unit) => {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
            <head><title>Print Barcode</title></head>
            <body style="margin:0;padding:20px;font-family:monospace;">
                <div style="text-align:center;">
                    <h2>${unit.product_name || 'N/A'}</h2>
                    <h1>${(unit.barcode || 'S').charAt(0)}</h1>
                    <div style="margin:10px 0;">
                        <svg id="barcode"></svg>
                    </div>
                    <p style="font-size:16px;font-weight:bold;">${unit.pet_name || 'N/A'}</p>
                    <p style="font-size:16px;font-weight:bold;">Quantity: ${unit.quantity || 0}</p>
                    <p style="font-size:16px;font-weight:bold;">Sequence: ${unit.pet_sequence || '-'}</p>
                    <p style="font-size:12px;font-family:monospace;">${unit.created_at || new Date().toISOString()}</p>
                </div>
                <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
                <script>
                    JsBarcode("#barcode", "${unit.barcode}", {width: 2, height: 80, fontSize: 16, displayValue: false});
                    setTimeout(() => { window.print(); window.close(); }, 500);
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    const handlePrintSelectedPDF = async () => {
        if (selectedForPrint.length === 0) {
            toast.error('No barcodes selected for printing');
            return;
        }
        setPrinting(true);
        try {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            for (let i = 0; i < selectedForPrint.length; i++) {
                const unit = selectedForPrint[i];
                const labelDiv = document.createElement('div');
                labelDiv.style.cssText = 'width:380px;padding:24px;background:white;font-family:monospace;text-align:center;';
                labelDiv.innerHTML = `
                    <h2 style="font-size:24px;font-weight:900;text-transform:uppercase;margin:0 0 8px;">${unit.product_name || 'N/A'}</h2>
                    <h1 style="font-size:32px;font-weight:900;text-transform:uppercase;margin:0 0 8px;">${(unit.barcode || 'S').charAt(0)}</h1>
                    <div style="font-size:14px;margin:8px 0;">${unit.barcode || '000000000000'}</div>
                    <p style="font-size:16px;font-weight:bold;margin:4px 0;">${unit.pet_name || 'N/A'}</p>
                    <p style="font-size:16px;font-weight:bold;margin:4px 0;">Quantity: ${unit.quantity || 0}</p>
                    <p style="font-size:16px;font-weight:bold;margin:4px 0;">Sequence: ${unit.pet_sequence || '-'}</p>
                    <p style="font-size:12px;font-family:monospace;margin-top:8px;border-top:1px solid #ccc;padding-top:8px;">${unit.created_at || new Date().toISOString()}</p>
                `;
                document.body.appendChild(labelDiv);

                const canvas = await html2canvas(labelDiv, { scale: 2, backgroundColor: '#ffffff' });
                document.body.removeChild(labelDiv);

                const imgData = canvas.toDataURL('image/png');
                const imgWidth = 100;
                const imgHeight = (canvas.height * imgWidth) / canvas.width;

                if (i > 0) pdf.addPage();
                const x = (pdfWidth - imgWidth) / 2;
                const y = (pdfHeight - imgHeight) / 2;
                pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
            }

            pdf.save(`bulk_barcodes_${filters.startDate}_${filters.endDate}.pdf`);
            toast.success(`PDF generated with ${selectedForPrint.length} barcodes`);
        } catch (error) {
            console.error('Failed to generate PDF:', error);
            toast.error('Failed to generate PDF');
        } finally {
            setPrinting(false);
        }
    };

    return (
        <div className="container-fluid">
            <div className="d-flex align-items-center justify-content-between mb-4">
                <div>
                    <h4 className="mb-1">
                        <i className="ti ti-barcode me-2"></i>
                        Bulk Barcode Printing
                    </h4>
                    <p className="text-muted mb-0">Generate and print barcodes in bulk as PDF</p>
                </div>
            </div>

            <div className="row mb-4">
                <div className="col-12">
                    <div className="card">
                        <div className="card-header">
                            <h5 className="card-title mb-0">
                                <i className="ti ti-filter me-2"></i>
                                Selection Filters
                            </h5>
                        </div>
                        <div className="card-body">
                            <div className="row g-3 align-items-end">
                                <div className="col-md-2">
                                    <label className="form-label">Start Date</label>
                                    <input
                                        type="date"
                                        className="form-control"
                                        value={filters.startDate}
                                        onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                                    />
                                </div>
                                <div className="col-md-2">
                                    <label className="form-label">End Date</label>
                                    <input
                                        type="date"
                                        className="form-control"
                                        value={filters.endDate}
                                        onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                                    />
                                </div>
                                <div className="col-md-2">
                                    <label className="form-label">Product Type</label>
                                    <select
                                        className="form-select"
                                        value={filters.productType}
                                        onChange={(e) => setFilters({ ...filters, productType: e.target.value })}
                                    >
                                        <option value="">All Products</option>
                                        {products.map(p => (
                                            <option key={p.id} value={p.id}>{p.name || p.product_name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-md-2">
                                    <label className="form-label">Pet Name</label>
                                    <select
                                        className="form-select"
                                        value={filters.petName}
                                        onChange={(e) => setFilters({ ...filters, petName: e.target.value })}
                                    >
                                        <option value="">All Pets</option>
                                        {pets.map(p => (
                                            <option key={p.id} value={p.pet_name}>{p.pet_name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-md-2">
                                    <label className="form-label">Batch Number</label>
                                    <select
                                        className="form-select"
                                        value={filters.batchNumber}
                                        onChange={(e) => setFilters({ ...filters, batchNumber: e.target.value })}
                                    >
                                        <option value="">All Batches</option>
                                        {batches.map(b => (
                                            <option key={b.id} value={b.batch_number}>{b.batch_number}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-md-2">
                                    <button
                                        type="button"
                                        className="btn btn-primary w-100"
                                        onClick={handleSearch}
                                        disabled={loading}
                                    >
                                        <i className="ti ti-search me-2"></i>
                                        {loading ? 'Searching...' : 'Search'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {barcodes.length > 0 && (
                <>
                    <div className="d-flex align-items-center justify-content-between mb-3">
                        <div>
                            <span className="badge bg-soft-primary text-primary">
                                {barcodes.length} barcodes found
                            </span>
                            {selectedForPrint.length > 0 && (
                                <span className="badge bg-soft-success text-success ms-2">
                                    {selectedForPrint.length} selected
                                </span>
                            )}
                        </div>
                        <div className="d-flex gap-2">
                            <button className="btn btn-sm btn-outline-secondary" onClick={selectAll}>
                                <i className="ti ti-checks me-1"></i>Select All
                            </button>
                            <button className="btn btn-sm btn-outline-secondary" onClick={deselectAll}>
                                <i className="ti ti-x me-1"></i>Deselect All
                            </button>
                            <button
                                className="btn btn-sm btn-success"
                                onClick={handlePrintSelectedPDF}
                                disabled={selectedForPrint.length === 0 || printing}
                            >
                                <i className="ti ti-file-type-pdf me-1"></i>
                                {printing ? 'Generating PDF...' : `Print Selected (${selectedForPrint.length})`}
                            </button>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-body p-0">
                            <div className="table-responsive">
                                <table className="table table-striped table-hover mb-0">
                                    <thead className="table-light">
                                        <tr>
                                            <th style={{ width: 40 }}>
                                                <input
                                                    type="checkbox"
                                                    className="form-check-input"
                                                    checked={selectedForPrint.length === barcodes.length && barcodes.length > 0}
                                                    onChange={(e) => e.target.checked ? selectAll() : deselectAll()}
                                                />
                                            </th>
                                            <th>Barcode</th>
                                            <th>Product</th>
                                            <th>Pet/Line</th>
                                            <th>Quantity</th>
                                            <th>Sequence</th>
                                            <th>Batch</th>
                                            <th>Stage</th>
                                            <th className="text-end">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {barcodes.map((unit) => (
                                            <tr key={unit.id}>
                                                <td>
                                                    <input
                                                        type="checkbox"
                                                        className="form-check-input"
                                                        checked={selectedForPrint.some(b => b.id === unit.id)}
                                                        onChange={() => toggleSelect(unit)}
                                                    />
                                                </td>
                                                <td><code>{unit.barcode}</code></td>
                                                <td>{unit.product_name || '-'}</td>
                                                <td>{unit.pet_name || '-'}</td>
                                                <td>{unit.quantity || 0}</td>
                                                <td>{unit.pet_sequence || '-'}</td>
                                                <td>{unit.batch_number || '-'}</td>
                                                <td>
                                                    <span className="badge bg-soft-info text-info">
                                                        {unit.stage || '-'}
                                                    </span>
                                                </td>
                                                <td className="text-end">
                                                    <button
                                                        className="btn btn-sm btn-outline-primary"
                                                        onClick={() => handlePrintSingle(unit)}
                                                    >
                                                        <i className="ti ti-printer me-1"></i>Print
                                                    </button>
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

            <div style={{ display: 'none' }}>
                <div ref={printRef}>
                    {printQueue[currentPrintIndex] && (
                        <BarcodeLabel
                            barcode={printQueue[currentPrintIndex]?.barcode}
                            product={printQueue[currentPrintIndex]?.product_name}
                            line={printQueue[currentPrintIndex]?.pet_name}
                            quantity={printQueue[currentPrintIndex]?.quantity}
                            sequence={printQueue[currentPrintIndex]?.pet_sequence}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default BulkBarcodePrinting;
