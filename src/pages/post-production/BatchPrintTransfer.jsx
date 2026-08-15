import React, { useState, useEffect, useRef } from 'react';
import { Printer, Loader2, Calendar, Search } from 'lucide-react';
import { inventoryApi } from '../../api/inventory';
import { productionApi } from '../../api/production';

const BatchPrintTransfer = () => {
    const printRef = useRef();
    const today = new Date().toISOString().split('T')[0];
    const [loading, setLoading] = useState(false);
    const [barcodes, setBarcodes] = useState([]);
    const [pets, setPets] = useState([]);
    const [products, setProducts] = useState([]);
    const [shifts] = useState([
        { id: 'DAY', name: 'DAY' },
        { id: 'NIGHT', name: 'NIGHT' },
    ]);

    const [filters, setFilters] = useState({
        startDate: today,
        endDate: today,
        productType: '',
        petName: '',
        shift: '',
    });

    // Transfer form editable fields
    const [documentCode, setDocumentCode] = useState('');
    const [singlePacks, setSinglePacks] = useState('');

    useEffect(() => {
        fetchDropdownData();
        generateDocumentCode();
    }, []);

    const generateDocumentCode = () => {
        const now = new Date();
        const code = `PD${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
        setDocumentCode(code);
    };

    const fetchDropdownData = async () => {
        try {
            const [petsRes, productsRes] = await Promise.all([
                productionApi.getPets(),
                inventoryApi.getProducts({ page_size: 100 }),
            ]);

            const petList = petsRes.data?.data?.data || petsRes.data?.data || petsRes.data?.results || [];
            const allPets = (Array.isArray(petList) ? petList : petList.results || [])
                .filter(p => !(p.pet_name || '').toLowerCase().includes('can'))
                .sort((a, b) => {
                    const aNum = parseInt(a.pet_name?.match(/(\d+)/)?.[0] || '999');
                    const bNum = parseInt(b.pet_name?.match(/(\d+)/)?.[0] || '999');
                    return aNum - bNum;
                });
            setPets(allPets);

            const prodList = productsRes.data?.data?.data || productsRes.data?.data || productsRes.data?.results || [];
            setProducts(Array.isArray(prodList) ? prodList : prodList.results || []);
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

            const response = await inventoryApi.getBulkBarcodes(params);
            const data = response.data?.data?.data || response.data?.data || response.data?.results || [];
            const list = Array.isArray(data) ? data : data.results || [];

            // Filter by shift if selected
            const filtered = filters.shift
                ? list.filter(b => (b.shift || '').toUpperCase() === filters.shift.toUpperCase())
                : list;

            setBarcodes(filtered);
        } catch (error) {
            console.error('Failed to fetch barcodes:', error);
            setBarcodes([]);
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        const prevTitle = document.title;
        const productLabel = filters.productType || 'All Products';
        document.title = `Transfer Form - ${productLabel} - ${filters.startDate}`;
        window.print();
        document.title = prevTitle;
    };

    // Computed values
    const totalPallets = barcodes.length;
    const totalPacks = barcodes.reduce((sum, b) => sum + (parseInt(b.packs_per_pallet) || parseInt(b.total_packs) || 0), 0);
    const productName = filters.productType || barcodes[0]?.product_name || barcodes[0]?.product_type || '';
    const displayDate = filters.startDate === filters.endDate
        ? new Date(filters.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : `${new Date(filters.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} - ${new Date(filters.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;

    return (
        <div>
            {/* Filter Controls - hidden on print */}
            <div className="no-print mb-3">
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <div>
                        <h4 className="fw-bold mb-1">Batch Print — Transfer Form</h4>
                        <p className="text-muted mb-0">Production to Warehouse transfer documentation</p>
                    </div>
                    <button
                        className="btn btn-primary d-flex align-items-center gap-2"
                        onClick={handlePrint}
                        disabled={loading || barcodes.length === 0}
                    >
                        <Printer size={18} />
                        Print Form
                    </button>
                </div>

                <div className="card">
                    <div className="card-body">
                        <div className="row g-3 align-items-end">
                            <div className="col-md-2">
                                <label className="form-label">Start Date</label>
                                <div className="d-flex align-items-center gap-1">
                                    <Calendar size={16} className="text-muted" />
                                    <input
                                        type="date"
                                        className="form-control form-control-sm"
                                        value={filters.startDate}
                                        onChange={(e) => setFilters(f => ({ ...f, startDate: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div className="col-md-2">
                                <label className="form-label">End Date</label>
                                <input
                                    type="date"
                                    className="form-control form-control-sm"
                                    value={filters.endDate}
                                    onChange={(e) => setFilters(f => ({ ...f, endDate: e.target.value }))}
                                />
                            </div>
                            <div className="col-md-2">
                                <label className="form-label">Product</label>
                                <select
                                    className="form-select form-select-sm"
                                    value={filters.productType}
                                    onChange={(e) => setFilters(f => ({ ...f, productType: e.target.value }))}
                                >
                                    <option value="">All Products</option>
                                    {products.map(p => (
                                        <option key={p.id} value={p.name}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-md-2">
                                <label className="form-label">Line</label>
                                <select
                                    className="form-select form-select-sm"
                                    value={filters.petName}
                                    onChange={(e) => setFilters(f => ({ ...f, petName: e.target.value }))}
                                >
                                    <option value="">All Lines</option>
                                    {pets.map(p => (
                                        <option key={p.id} value={p.pet_name}>{p.pet_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-md-2">
                                <label className="form-label">Shift</label>
                                <select
                                    className="form-select form-select-sm"
                                    value={filters.shift}
                                    onChange={(e) => setFilters(f => ({ ...f, shift: e.target.value }))}
                                >
                                    <option value="">All Shifts</option>
                                    {shifts.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-md-2">
                                <button
                                    className="btn btn-dark btn-sm w-100 d-flex align-items-center justify-content-center gap-2"
                                    onClick={handleSearch}
                                    disabled={loading}
                                >
                                    {loading ? <Loader2 size={16} className="spinning" /> : <Search size={16} />}
                                    Search
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Results count */}
                {barcodes.length > 0 && (
                    <div className="d-flex align-items-center gap-3 mt-2">
                        <span className="badge bg-primary fs-13">{barcodes.length} pallets found</span>
                        <span className="text-muted fs-13">Total Packs: {totalPacks.toLocaleString()}</span>
                    </div>
                )}
            </div>

            {/* Loading */}
            {loading && (
                <div className="d-flex justify-content-center align-items-center py-5 no-print">
                    <Loader2 size={32} className="text-primary spinning" />
                    <span className="ms-2 text-muted">Searching pallets...</span>
                </div>
            )}

            {/* Printable Transfer Form */}
            {!loading && barcodes.length > 0 && (
                <div className="print-form-container" ref={printRef}>
                    <div className="production-report-form">

                        {/* Header */}
                        <div className="form-header">
                            <div className="header-left">
                                <img src="/logo.jpeg" alt="Twellium" className="print-logo" />
                                <h5 className="company-name">TWELLIUM INDUSTRIAL COMPANY LTD.</h5>
                            </div>
                            <div className="header-center">
                                <h4 className="report-title" style={{ fontSize: '14px' }}>Transfer Form from Production to Warehouse</h4>
                                <span className="doc-ref" style={{ fontSize: '13px', fontWeight: 'bold' }}>{documentCode}</span>
                            </div>
                            <div className="header-right">
                                <div className="header-info">
                                    <span className="doc-ref">PRODUCTION DEPARTMENT</span>
                                    <span>Page 1 of 1</span>
                                </div>
                            </div>
                        </div>

                        {/* Product & Summary Section */}
                        <table className="form-table">
                            <tbody>
                                <tr>
                                    <td className="label-cell" style={{ width: '12%' }}>Product Name</td>
                                    <td className="input-cell" style={{ width: '38%' }}>{productName}</td>
                                    <td className="label-cell" style={{ width: '12%' }}>Total Pallet</td>
                                    <td className="input-cell numeric" style={{ width: '38%' }}>{totalPallets}</td>
                                </tr>
                                <tr>
                                    <td className="label-cell">Date</td>
                                    <td className="input-cell">{displayDate}</td>
                                    <td className="label-cell">Single Packs</td>
                                    <td className="input-cell numeric">
                                        <input
                                            type="number"
                                            className="form-control form-control-sm border-0 rounded-0 shadow-none no-print-input"
                                            style={{ minWidth: '60px', height: '1.6rem', padding: '0.1rem 0.25rem', textAlign: 'right', backgroundColor: 'transparent', borderBottom: '1px dashed rgba(33,37,41,0.35)', fontSize: '0.85rem' }}
                                            value={singlePacks}
                                            onChange={(e) => setSinglePacks(e.target.value)}
                                        />
                                    </td>
                                </tr>
                                <tr>
                                    <td className="label-cell">Shift</td>
                                    <td className="input-cell">{filters.shift || 'All Shifts'}</td>
                                    <td className="label-cell">Total Packs</td>
                                    <td className="input-cell numeric">{(totalPacks + (parseInt(singlePacks) || 0)).toLocaleString()}</td>
                                </tr>
                            </tbody>
                        </table>

                        {/* Pallet Details Table */}
                        <table className="form-table section-table">
                            <thead>
                                <tr className="section-header-row">
                                    <th colSpan={4}>Pallet Details</th>
                                </tr>
                                <tr className="sub-header-row">
                                    <th style={{ width: '35%' }}>Barcode</th>
                                    <th style={{ width: '15%' }}>Sequence Number</th>
                                    <th style={{ width: '20%' }}>Packs per Pallet</th>
                                    <th style={{ width: '30%' }}>Trnce</th>
                                </tr>
                            </thead>
                            <tbody>
                                {barcodes.map((barcode, idx) => (
                                    <tr key={barcode.id || barcode.barcode || idx}>
                                        <td className="label-cell" style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                            {barcode.current_barcode || barcode.barcode || ''}
                                        </td>
                                        <td className="input-cell numeric">{idx + 1}</td>
                                        <td className="input-cell numeric">
                                            {barcode.packs_per_pallet || barcode.total_packs || barcode.packs || ''}
                                        </td>
                                        <td className="input-cell" style={{ fontSize: '0.8rem' }}>
                                            {barcode.batch_number || barcode.batch || barcode.traceability || ''}
                                        </td>
                                    </tr>
                                ))}
                                {/* Totals row */}
                                <tr style={{ fontWeight: 'bold', borderTop: '2px solid #333' }}>
                                    <td className="label-cell">TOTAL</td>
                                    <td className="input-cell numeric">{barcodes.length}</td>
                                    <td className="input-cell numeric">{totalPacks.toLocaleString()}</td>
                                    <td className="input-cell"></td>
                                </tr>
                            </tbody>
                        </table>

                        {/* Sign Off Section */}
                        <div className="sign-off-section">
                            <div className="sign-off-row">
                                <div className="sign-off-field">
                                    <label>Production Supervisor</label>
                                </div>
                                <div className="sign-off-field">
                                    <label>Warehouse Supervisor</label>
                                </div>
                            </div>
                            <div className="sign-off-row">
                                <div className="sign-off-field">
                                    <label>Name:</label>
                                    <div className="sign-line"></div>
                                </div>
                                <div className="sign-off-field">
                                    <label>Name:</label>
                                    <div className="sign-line"></div>
                                </div>
                            </div>
                            <div className="sign-off-row">
                                <div className="sign-off-field">
                                    <label>Signature:</label>
                                    <div className="sign-line"></div>
                                </div>
                                <div className="sign-off-field">
                                    <label>Signature:</label>
                                    <div className="sign-line"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Empty state */}
            {!loading && barcodes.length === 0 && (
                <div className="text-center py-5 no-print">
                    <div className="text-muted mb-2">
                        <Search size={48} strokeWidth={1} />
                    </div>
                    <p className="text-muted">Select filters and search to load pallets for the transfer form.</p>
                </div>
            )}
        </div>
    );
};

export default BatchPrintTransfer;
