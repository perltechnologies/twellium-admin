import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { inventoryApi } from '../../api/inventory';
import { Pagination } from '../../components/ui/Pagination';
import { format } from 'date-fns';

const PalletList = () => {
    const { stage } = useParams();
    const navigate = useNavigate();
    const [pallets, setPallets] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);

    // Pagination state
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    const fetchPallets = async (searchTerm = '') => {
        setLoading(true);
        try {
            const response = await inventoryApi.getStageDetails({
                stage,
                search: searchTerm
            });
            const data = response.data?.data || [];
            setPallets(Array.isArray(data) ? data : (data.details || []));
            setPage(1);
        } catch (error) {
            console.error('Failed to fetch pallets:', error);
            setPallets([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPallets();
    }, [stage]);

    const handleSearch = (e) => {
        e.preventDefault();
        fetchPallets(search);
    };

    const paginatedPallets = useMemo(() => {
        const start = (page - 1) * pageSize;
        return pallets.slice(start, start + pageSize);
    }, [pallets, page, pageSize]);

    const getStatusBadge = (status) => {
        const statusMap = {
            PRODUCTION: 'bg-soft-info text-info',
            WAREHOUSE: 'bg-soft-primary text-primary',
            QUALIFIED: 'bg-soft-success text-success',
            LOADING: 'bg-soft-warning text-warning',
            LOADED: 'bg-soft-success text-success',
            DAMAGED: 'bg-soft-danger text-danger',
            FAULTY: 'bg-soft-danger text-danger',
        };
        const cls = statusMap[status] || 'bg-soft-secondary text-secondary';
        return <span className={`badge ${cls}`}>{status}</span>;
    };

    const handleRowClick = (barcode) => {
        navigate(`/post-production/pallets/details/${barcode}`);
    };

    return (
        <div className="container-fluid">
            {/* Page Header */}
            <div className="row mb-4">
                <div className="col-12">
                    <div className="d-flex align-items-center justify-content-between">
                        <div>
                            <h4 className="mb-1">
                                <i className="ti ti-box me-2"></i>
                                {stage?.replace(/_/g, ' ')} Pallets
                            </h4>
                            <p className="text-muted mb-0">View all pallets in the {stage?.replace(/_/g, ' ')} stage</p>
                        </div>
                        <button
                            className="btn btn-outline-secondary"
                            onClick={() => navigate(-1)}
                        >
                            <i className="ti ti-arrow-left me-1"></i>
                            Back
                        </button>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="row mb-4">
                <div className="col-12">
                    <div className="card">
                        <div className="card-body">
                            <form onSubmit={handleSearch}>
                                <div className="row g-3 align-items-end">
                                    <div className="col-md-9">
                                        <label className="form-label">Search</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="Search by barcode, RFID, or product..."
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                        />
                                    </div>
                                    <div className="col-md-3">
                                        <button type="submit" className="btn btn-primary w-100" disabled={loading}>
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

            {/* Table */}
            <div className="row">
                <div className="col-12">
                    <div className="card">
                        <div className="card-header d-flex align-items-center justify-content-between">
                            <h5 className="card-title mb-0">
                                <i className="ti ti-list me-2"></i>
                                Pallets
                            </h5>
                            <span className="badge bg-soft-primary text-primary">
                                {pallets.length} items
                            </span>
                        </div>
                        <div className="card-body p-0">
                            {loading ? (
                                <div className="text-center py-5">
                                    <div className="spinner-border text-primary" role="status">
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                </div>
                            ) : pallets.length === 0 ? (
                                <div className="text-center py-5 text-muted">
                                    <i className="ti ti-box-off fs-1 d-block mb-2"></i>
                                    No pallets found
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <table className="table table-striped table-hover mb-0">
                                        <thead>
                                            <tr>
                                                <th>Barcode</th>
                                                <th>RFID</th>
                                                <th>Product</th>
                                                <th>Line</th>
                                                <th>Qty</th>
                                                <th>Status</th>
                                                <th>Last Updated</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paginatedPallets.map((pallet) => (
                                                <tr
                                                    key={pallet.id || pallet.current_barcode}
                                                    onClick={() => handleRowClick(pallet.current_barcode)}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    <td><code>{pallet.current_barcode || pallet.barcode || '—'}</code></td>
                                                    <td>{pallet.rfid_number || '—'}</td>
                                                    <td>{pallet.product_name || pallet.product || '—'}</td>
                                                    <td>{pallet.pet_name || pallet.pet || '—'}</td>
                                                    <td>{pallet.quantity || 0}</td>
                                                    <td>{getStatusBadge(pallet.current_status || pallet.stage)}</td>
                                                    <td>
                                                        {pallet.updated_at || pallet.created_at
                                                            ? format(new Date(pallet.updated_at || pallet.created_at), 'dd MMM yyyy HH:mm')
                                                            : '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {pallets.length > 0 && (
                            <Pagination
                                page={page}
                                pageSize={pageSize}
                                totalCount={pallets.length}
                                onPageChange={setPage}
                                onPageSizeChange={(newSize) => {
                                    setPageSize(newSize);
                                    setPage(1);
                                }}
                                pageSizeOptions={[10, 20, 50, 100]}
                                itemLabel="pallets"
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PalletList;
