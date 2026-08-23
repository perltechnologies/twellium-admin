import React, { useState, useEffect, useMemo } from 'react';
import { inventoryApi } from '../../api/inventory';
import { productionApi } from '../../api/production';
import { formatAndSortPets } from '../../utils/petUtils';
import { Pagination } from '../../components/ui/Pagination';
import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';

const extractData = (res) => {
    const envelope = res?.data?.data ?? res?.data ?? {};
    if (Array.isArray(envelope)) return envelope;
    if (envelope?.results && Array.isArray(envelope.results)) return envelope.results;
    if (envelope?.data && Array.isArray(envelope.data)) return envelope.data;
    return [];
};

const BulkBarcodePrinting = () => {
    const today = new Date().toISOString().split('T')[0];
    const [filters, setFilters] = useState({
        startDate: today,
        endDate: today,
        startTime: '',
        endTime: '',
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

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    useEffect(() => {
        fetchDropdownData();
    }, []);

    const fetchDropdownData = async () => {
        try {
            const [petsRes, productsRes, batchesRes] = await Promise.all([
                productionApi.getPets(),
                inventoryApi.getProducts({ page_size: 100 }),
                productionApi.getBatches(),
            ]);

            const allPets = formatAndSortPets(petsRes);
            setPets(allPets);

            const prodList = productsRes.data?.data?.data || productsRes.data?.data || productsRes.data?.results || [];
            setProducts(Array.isArray(prodList) ? prodList : prodList.results || []);

            const batchList = batchesRes.data?.data?.data || batchesRes.data?.data || batchesRes.data?.results || [];
            setBatches(Array.isArray(batchList) ? batchList : batchList.results || []);
        } catch (error) {
            console.error('Failed to fetch dropdown data:', error);
        }
    };

    const handleSearch = async () => {
        setLoading(true);
        try {
            const params = { page_size: 1000 };
            if (filters.startDate) params.created_after = filters.startDate;
            if (filters.endDate) params.created_before = filters.endDate;
            if (filters.petName) params.pet = filters.petName;
            if (filters.productType) params.product = filters.productType;
            if (filters.batchNumber) params.batch = filters.batchNumber;

            const response = await inventoryApi.getBulkBarcodes(params);
            const data = extractData(response);
            setBarcodes(data);
            setSelectedForPrint([]);
            setCurrentPage(1);
        } catch (error) {
            console.error('Failed to fetch barcodes:', error);
            setBarcodes([]);
        } finally {
            setLoading(false);
        }
    };

    // Client-side paginated slice
    const paginatedBarcodes = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return barcodes.slice(start, start + pageSize);
    }, [barcodes, currentPage, pageSize]);

    const toggleSelect = (barcode) => {
        setSelectedForPrint(prev =>
            prev.some(b => b.id === barcode.id || b.barcode === barcode.barcode)
                ? prev.filter(b => b.id !== barcode.id && b.barcode !== barcode.barcode)
                : [...prev, barcode]
        );
    };

    const selectAll = () => setSelectedForPrint([...barcodes]);
    const deselectAll = () => setSelectedForPrint([]);

    const generateBarcodeDataUrl = (value) => {
        try {
            const canvas = document.createElement('canvas');
            JsBarcode(canvas, value || '000000000000', {
                width: 2,
                height: 80,
                fontSize: 14,
                displayValue: true,
                margin: 5,
            });
            return canvas.toDataURL('image/png');
        } catch (e) {
            console.error('Barcode generation failed:', e);
            return null;
        }
    };

    const handleGeneratePDF = async () => {
        const items = selectedForPrint.length > 0 ? selectedForPrint : barcodes;
        if (items.length === 0) return;

        setPrinting(true);
        try {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();

            const labelWidth = 80;
            const labelHeight = 55;
            const cols = 2;
            const rows = 4;
            const marginX = (pageWidth - cols * labelWidth) / (cols + 1);
            const marginY = (pageHeight - rows * labelHeight) / (rows + 1);

            let currentPageIdx = 0;

            items.forEach((unit, idx) => {
                const pageIdx = Math.floor(idx / (cols * rows));
                const posInPage = idx % (cols * rows);
                const col = posInPage % cols;
                const row = Math.floor(posInPage / cols);

                if (pageIdx > currentPageIdx) {
                    pdf.addPage();
                    currentPageIdx = pageIdx;
                }

                const x = marginX + col * (labelWidth + marginX);
                const y = marginY + row * (labelHeight + marginY);

                pdf.setDrawColor(200);
                pdf.setLineWidth(0.3);
                pdf.rect(x, y, labelWidth, labelHeight);

                pdf.setFontSize(9);
                pdf.setFont(undefined, 'bold');
                const productName = (unit.product_name || unit.product || 'N/A').toUpperCase();
                pdf.text(productName, x + labelWidth / 2, y + 6, { align: 'center', maxWidth: labelWidth - 4 });

                const barcodeVal = unit.barcode || unit.current_barcode || unit.id || '000000000000';
                const barcodeImg = generateBarcodeDataUrl(barcodeVal);
                if (barcodeImg) {
                    pdf.addImage(barcodeImg, 'PNG', x + 10, y + 9, labelWidth - 20, 22);
                } else {
                    pdf.setFontSize(8);
                    pdf.setFont(undefined, 'normal');
                    pdf.text(barcodeVal, x + labelWidth / 2, y + 20, { align: 'center' });
                }

                pdf.setFontSize(8);
                pdf.setFont(undefined, 'bold');
                pdf.text(`${unit.pet_name || unit.pet || 'N/A'}`, x + 4, y + 36);
                pdf.text(`Qty: ${unit.quantity || 0}`, x + labelWidth - 4, y + 36, { align: 'right' });

                pdf.setFontSize(7);
                pdf.setFont(undefined, 'normal');
                pdf.text(`Seq: ${unit.pet_sequence || unit.sequence || '-'}`, x + 4, y + 41);
                pdf.text(`Batch: ${unit.batch_number || unit.batch || '-'}`, x + labelWidth - 4, y + 41, { align: 'right' });

                pdf.setFontSize(6);
                const timestamp = unit.created_at ? new Date(unit.created_at).toLocaleString() : new Date().toLocaleString();
                pdf.text(timestamp, x + labelWidth / 2, y + 47, { align: 'center' });

                pdf.setFontSize(6);
                pdf.setFont(undefined, 'bold');
                pdf.text((unit.stage || 'PRODUCTION').toUpperCase(), x + labelWidth / 2, y + 52, { align: 'center' });
            });

            pdf.save(`Barcodes_${filters.startDate}_to_${filters.endDate}.pdf`);
        } catch (error) {
            console.error('PDF generation failed:', error);
        } finally {
            setPrinting(false);
        }
    };

    const handlePrintSingle = (unit) => {
        const barcodeVal = unit.barcode || unit.current_barcode || unit.id || '000000000000';
        const barcodeImg = generateBarcodeDataUrl(barcodeVal);
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        printWindow.document.write(`
            <html>
            <head>
                <title>Label - ${barcodeVal}</title>
                <style>
                    @page { margin: 10mm; size: auto; }
                    body { margin: 0; padding: 20px; font-family: Arial, sans-serif; text-align: center; }
                    .label { max-width: 380px; margin: 0 auto; padding: 20px; border: 1px solid #ccc; }
                    h2 { font-size: 20px; text-transform: uppercase; margin: 0 0 8px; }
                    .barcode-img { margin: 12px 0; }
                    .details { border-top: 2px solid #333; padding-top: 10px; margin-top: 10px; }
                    .detail-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 14px; }
                    .timestamp { font-size: 11px; font-family: monospace; margin-top: 8px; border-top: 1px solid #eee; padding-top: 8px; }
                </style>
            </head>
            <body>
                <div class="label">
                    <h2>${unit.product_name || unit.product || 'N/A'}</h2>
                    <div class="barcode-img">
                        ${barcodeImg ? `<img src="${barcodeImg}" style="max-width:100%;" />` : `<p>${barcodeVal}</p>`}
                    </div>
                    <div class="details">
                        <div class="detail-row"><span>Line:</span><strong>${unit.pet_name || unit.pet || 'N/A'}</strong></div>
                        <div class="detail-row"><span>Quantity:</span><strong>${unit.quantity || 0}</strong></div>
                        <div class="detail-row"><span>Sequence:</span><strong>${unit.pet_sequence || unit.sequence || '-'}</strong></div>
                        <div class="detail-row"><span>Batch:</span><strong>${unit.batch_number || unit.batch || '-'}</strong></div>
                        <div class="detail-row"><span>Stage:</span><strong>${unit.stage || 'PRODUCTION'}</strong></div>
                    </div>
                    <p class="timestamp">${unit.created_at ? new Date(unit.created_at).toLocaleString() : new Date().toLocaleString()}</p>
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
        setTimeout(() => {
            printWindow.focus();
            printWindow.print();
            printWindow.close();
        }, 500);
    };

    return (
        <>
            <div className="d-flex align-items-center justify-content-between mb-4">
                <div>
                    <h4 className="mb-0"><i className="ti ti-barcode me-2"></i>Bulk Barcode Printing</h4>
                    <small className="text-muted">Generate and export barcodes in bulk as PDF</small>
                </div>
                {barcodes.length > 0 && (
                    <button
                        className="btn btn-success"
                        onClick={handleGeneratePDF}
                        disabled={printing}
                    >
                        <i className="ti ti-file-type-pdf me-2"></i>
                        {printing ? 'Generating...' : `Export PDF (${selectedForPrint.length || barcodes.length})`}
                    </button>
                )}
            </div>

            {/* Filters */}
            <div className="card mb-4">
                <div className="card-header">
                    <h6 className="mb-0"><i className="ti ti-filter me-2"></i>Selection Filters</h6>
                </div>
                <div className="card-body">
                    <div className="row g-3 align-items-end">
                        <div className="col-lg-2 col-md-4">
                            <label className="form-label">Start Date</label>
                            <input
                                type="date"
                                className="form-control form-control-sm"
                                value={filters.startDate}
                                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                            />
                        </div>
                        <div className="col-lg-2 col-md-4">
                            <label className="form-label">End Date</label>
                            <input
                                type="date"
                                className="form-control form-control-sm"
                                value={filters.endDate}
                                onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                            />
                        </div>
                        <div className="col-lg-2 col-md-4">
                            <label className="form-label">Product Type</label>
                            <select
                                className="form-select form-select-sm"
                                value={filters.productType}
                                onChange={(e) => setFilters(prev => ({ ...prev, productType: e.target.value }))}
                            >
                                <option value="">All Products</option>
                                {products.map(p => (
                                    <option key={p.id} value={p.id}>{p.name || p.product_name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-lg-2 col-md-4">
                            <label className="form-label">Pet Name</label>
                            <select
                                className="form-select form-select-sm"
                                value={filters.petName}
                                onChange={(e) => setFilters(prev => ({ ...prev, petName: e.target.value }))}
                            >
                                <option value="">All Pets</option>
                                {pets.map(p => (
                                    <option key={p.id} value={p.id}>{p.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-lg-2 col-md-4">
                            <label className="form-label">Batch Number</label>
                            <select
                                className="form-select form-select-sm"
                                value={filters.batchNumber}
                                onChange={(e) => setFilters(prev => ({ ...prev, batchNumber: e.target.value }))}
                            >
                                <option value="">All Batches</option>
                                {batches.map(b => (
                                    <option key={b.id} value={b.id}>{b.batch_number}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-lg-2 col-md-4">
                            <button
                                className="btn btn-primary btn-sm w-100"
                                onClick={handleSearch}
                                disabled={loading}
                            >
                                {loading ? (
                                    <><span className="spinner-border spinner-border-sm me-2"></span>Searching...</>
                                ) : (
                                    <><i className="ti ti-search me-2"></i>Search Barcodes</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Results */}
            {barcodes.length > 0 && (
                <div className="card">
                    <div className="card-header d-flex flex-wrap align-items-center justify-content-between gap-2">
                        <div>
                            <h6 className="mb-0">Results</h6>
                            <small className="text-muted">{barcodes.length} barcodes found</small>
                        </div>
                        <div className="d-flex flex-wrap gap-2 align-items-center">
                            {selectedForPrint.length > 0 && (
                                <span className="badge bg-soft-success text-success">{selectedForPrint.length} selected</span>
                            )}
                            <button className="btn btn-sm btn-outline-secondary" onClick={selectAll}>
                                <i className="ti ti-checks me-1"></i>Select All
                            </button>
                            <button className="btn btn-sm btn-outline-secondary" onClick={deselectAll}>
                                <i className="ti ti-x me-1"></i>Clear
                            </button>
                            <button
                                className="btn btn-sm btn-success"
                                onClick={handleGeneratePDF}
                                disabled={printing}
                            >
                                <i className="ti ti-file-type-pdf me-1"></i>
                                {printing ? 'Generating...' : 'Export PDF'}
                            </button>
                        </div>
                    </div>
                    <div className="card-body p-0">
                        <div className="table-responsive">
                            <table className="table table-sm table-hover mb-0">
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
                                        <th className="text-end">Qty</th>
                                        <th className="text-center">Seq</th>
                                        <th>Batch</th>
                                        <th>Stage</th>
                                        <th>Created</th>
                                        <th className="text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedBarcodes.map((unit) => {
                                        const barcodeVal = unit.barcode || unit.current_barcode || unit.id || '-';
                                        const productName = unit.product_name || unit.product?.name || unit.product || '-';
                                        const petName = unit.pet_name || unit.pet?.pet_name || '-';
                                        return (
                                            <tr key={unit.id || barcodeVal}>
                                                <td>
                                                    <input
                                                        type="checkbox"
                                                        className="form-check-input"
                                                        checked={selectedForPrint.some(b => b.id === unit.id || b.barcode === barcodeVal)}
                                                        onChange={() => toggleSelect(unit)}
                                                    />
                                                </td>
                                                <td><code className="fw-bold">{barcodeVal}</code></td>
                                                <td>{productName}</td>
                                                <td>{petName}</td>
                                                <td className="text-end">{unit.quantity || 0}</td>
                                                <td className="text-center">{unit.pet_sequence || unit.sequence || '-'}</td>
                                                <td>{unit.batch_number || unit.batch || '-'}</td>
                                                <td>
                                                    <span className="badge bg-soft-info text-info">{unit.stage || '-'}</span>
                                                </td>
                                                <td className="text-muted" style={{ fontSize: '11px' }}>
                                                    {unit.created_at ? new Date(unit.created_at).toLocaleString() : '-'}
                                                </td>
                                                <td className="text-end">
                                                    <button
                                                        className="btn btn-sm btn-icon btn-outline-primary"
                                                        onClick={() => handlePrintSingle(unit)}
                                                        title="Print this label"
                                                    >
                                                        <i className="ti ti-printer"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Pagination */}
                    <Pagination
                        page={currentPage}
                        pageSize={pageSize}
                        totalCount={barcodes.length}
                        onPageChange={setCurrentPage}
                        onPageSizeChange={(newSize) => {
                            setPageSize(newSize);
                            setCurrentPage(1);
                        }}
                        pageSizeOptions={[10, 20, 50, 100, 250]}
                        itemLabel="barcodes"
                    />
                </div>
            )}

            {/* Empty state */}
            {!loading && barcodes.length === 0 && (
                <div className="card">
                    <div className="card-body text-center py-5">
                        <i className="ti ti-barcode fs-1 text-muted mb-3 d-block"></i>
                        <h6 className="text-muted">No Barcodes Loaded</h6>
                        <p className="text-muted mb-0">Use the filters above to search for barcodes, then export them as PDF.</p>
                    </div>
                </div>
            )}
        </>
    );
};

export default BulkBarcodePrinting;
