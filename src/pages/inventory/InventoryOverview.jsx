import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { inventoryApi } from '../../api/inventory';

const STAGE_CONFIG = [
  { id: 'PRODUCTION', label: 'Production', icon: 'ti-building-factory', color: 'primary' },
  { id: 'WAREHOUSE', label: 'Warehouse', icon: 'ti-building-warehouse', color: 'info' },
  { id: 'FAULTY', label: 'Faulty', icon: 'ti-alert-triangle', color: 'danger' },
  { id: 'QUALIFIED', label: 'Qualified', icon: 'ti-circle-check', color: 'success' },
  { id: 'EXTERNAL_WAREHOUSE', label: 'External Warehouse', icon: 'ti-truck', color: 'warning' },
  { id: 'DAMAGED', label: 'Damaged', icon: 'ti-alert-octagon', color: 'danger' },
  { id: 'LOADING', label: 'Loading', icon: 'ti-loader', color: 'secondary' },
  { id: 'LOADED', label: 'Loaded', icon: 'ti-circle-check-filled', color: 'success' },
];

const InventoryOverview = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [totalUnits, setTotalUnits] = useState(0);
  const [stageCounts, setStageCounts] = useState({});
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await inventoryApi.getStageCounts();
      const data = response.data.data;

      setTotalUnits(data.total_units || 0);
      setStageCounts(data.stage_counts || {});
      setProducts(Array.isArray(data.product_breakdown) ? data.product_breakdown : []);
    } catch (error) {
      console.error('Failed to fetch inventory data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeSKUs = products.length;

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid">
      {/* Page Header */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h4 className="mb-0">Inventory Distribution</h4>
        <div className="d-flex gap-2">
          <span className="badge bg-soft-primary text-primary fs-13 px-3 py-2">
            <i className="ti ti-box me-1"></i>Global Units: {totalUnits.toLocaleString()}
          </span>
          <span className="badge bg-soft-success text-success fs-13 px-3 py-2">
            <i className="ti ti-tags me-1"></i>Active SKUs: {activeSKUs}
          </span>
        </div>
      </div>

      {/* Stage Distribution Grid */}
      <h5 className="mb-3">Stage Distribution</h5>
      <div className="row g-3 mb-4">
        {STAGE_CONFIG.map((stage) => (
          <div key={stage.id} className="col-xl-3 col-sm-6">
            <div
              className="card mb-0"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/post-production/pallets/${stage.id}`)}
            >
              <div className="card-body">
                <div className="d-flex align-items-start justify-content-between">
                  <div>
                    <p className="fs-14 mb-1">{stage.label}</p>
                    <h2 className="mb-1 fs-16">
                      {(stageCounts[stage.id] || 0).toLocaleString()}
                    </h2>
                  </div>
                  <span className={`avatar avatar-md rounded-circle bg-soft-${stage.color} border border-${stage.color}`}>
                    <i className={`ti ${stage.icon} fs-16 text-${stage.color}`}></i>
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Product Matrix */}
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h5 className="mb-0">Product Matrix</h5>
        <div style={{ maxWidth: '300px', width: '100%' }}>
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="row g-3">
        {filteredProducts.length === 0 ? (
          <div className="col-12">
            <div className="card mb-0">
              <div className="card-body text-center text-muted py-4">
                <i className="ti ti-package-off fs-24 d-block mb-2"></i>
                No products found
              </div>
            </div>
          </div>
        ) : (
          filteredProducts.map((product) => (
            <div key={product.id} className="col-xl-4 col-md-6">
              <div className="card mb-0 h-100">
                <div className="card-header d-flex align-items-center justify-content-between py-2">
                  <h6 className="card-title mb-0">{product.name}</h6>
                  <span className="badge bg-primary">{(product.total_count || 0).toLocaleString()}</span>
                </div>
                <div className="card-body pt-2">
                  <div className="row g-2">
                    {STAGE_CONFIG.map((stage) => {
                      const count = product.stages?.[stage.id] || 0;
                      if (count === 0) return null;
                      return (
                        <div key={stage.id} className="col-6">
                          <div className="d-flex align-items-center justify-content-between py-1 px-2 rounded bg-light">
                            <small className="text-muted">{stage.label}</small>
                            <span className={`badge bg-soft-${stage.color} text-${stage.color}`}>
                              {count.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default InventoryOverview;
