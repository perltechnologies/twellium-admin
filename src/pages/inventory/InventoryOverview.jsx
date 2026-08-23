import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { inventoryApi } from '../../api/inventory';
import { useTheme } from '../../context/ThemeContext';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { Boxes, Package, RefreshCw, Search, Layers, CheckCircle2, AlertTriangle, Truck } from 'lucide-react';

const STAGE_CONFIG = [
  { id: 'PRODUCTION', label: 'Production', icon: 'ti-building-factory', chartColor: '#3b82f6' },
  { id: 'WAREHOUSE', label: 'Warehouse', icon: 'ti-building-warehouse', chartColor: '#06b6d4' },
  { id: 'FAULTY', label: 'Faulty', icon: 'ti-alert-triangle', chartColor: '#ef4444' },
  { id: 'QUALIFIED', label: 'Qualified', icon: 'ti-circle-check', chartColor: '#22c55e' },
  { id: 'EXTERNAL_WAREHOUSE', label: 'External WH', icon: 'ti-truck', chartColor: '#f59e0b' },
  { id: 'DAMAGED', label: 'Damaged', icon: 'ti-alert-octagon', chartColor: '#dc2626' },
  { id: 'LOADING', label: 'Loading', icon: 'ti-loader', chartColor: '#64748b' },
  { id: 'LOADED', label: 'Loaded', icon: 'ti-circle-check-filled', chartColor: '#16a34a' },
];

const InventoryOverview = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [loading, setLoading] = useState(true);
  const [totalUnits, setTotalUnits] = useState(0);
  const [stageCounts, setStageCounts] = useState({});
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await inventoryApi.getStageCounts();
      const data = response?.data?.data ?? response?.data ?? {};
      setTotalUnits(data.total_units || 0);
      setStageCounts(data.stage_counts || {});
      setProducts(Array.isArray(data.product_breakdown) ? data.product_breakdown : []);
    } catch (error) {
      console.error('Failed to fetch inventory data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredProducts = useMemo(() =>
    products.filter((product) =>
      (product.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [products, searchQuery]
  );

  const stageChartData = useMemo(() =>
    STAGE_CONFIG
      .map(stage => ({ name: stage.label, value: Number(stageCounts[stage.id]) || 0, color: stage.chartColor }))
      .filter(d => d.value > 0),
    [stageCounts]
  );

  const productChartData = useMemo(() =>
    [...products]
      .sort((a, b) => (b.total_count || 0) - (a.total_count || 0))
      .slice(0, 10)
      .map(p => ({
        name: (p.name || '').length > 20 ? (p.name || '').slice(0, 18) + '…' : (p.name || 'Unknown'),
        fullName: p.name,
        total: p.total_count || 0
      })),
    [products]
  );

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary mb-2" role="status" />
        <p className="text-muted small">Loading inventory distribution…</p>
      </div>
    );
  }

  const chartGridColor = isDark ? '#334155' : '#f1f5f9';
  const chartTextColor = isDark ? '#94a3b8' : '#64748b';
  const tooltipBg = isDark ? '#1e293b' : '#ffffff';
  const tooltipBorder = isDark ? '#475569' : '#e2e8f0';

  return (
    <div className="container-fluid px-0">
      {/* Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4 pb-2 border-bottom">
        <div>
          <h4 className="fw-bold mb-0 text-dark">Inventory Distribution Overview</h4>
          <p className="text-muted small mb-0">Live stock levels across all post-production and warehouse stages</p>
        </div>
        <button className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1 shadow-sm" onClick={fetchData}>
          <RefreshCw size={14} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Global Summary Bar */}
      <div className="card mb-4 border shadow-none">
        <div className="card-body p-3">
          <div className="row g-3 text-center text-sm-start">
            <div className="col-xl-3 col-sm-6 border-end-sm">
              <div className="d-flex align-items-center gap-3 justify-content-center justify-content-sm-start">
                <div className="avatar avatar-md bg-soft-primary rounded-circle d-flex align-items-center justify-content-center">
                  <Boxes size={20} className="text-primary" />
                </div>
                <div>
                  <span className="text-muted small fw-semibold text-uppercase d-block">Total Inventory</span>
                  <h3 className="fw-bold mb-0 text-dark">{totalUnits.toLocaleString()}</h3>
                  <small className="text-muted">Total units tracked</small>
                </div>
              </div>
            </div>

            <div className="col-xl-3 col-sm-6 border-end-xl">
              <div className="d-flex align-items-center gap-3 justify-content-center justify-content-sm-start">
                <div className="avatar avatar-md bg-soft-success rounded-circle d-flex align-items-center justify-content-center">
                  <Package size={20} className="text-success" />
                </div>
                <div>
                  <span className="text-muted small fw-semibold text-uppercase d-block">Active SKUs</span>
                  <h3 className="fw-bold mb-0 text-dark">{products.length}</h3>
                  <small className="text-muted">Distinct product lines</small>
                </div>
              </div>
            </div>

            <div className="col-xl-3 col-sm-6 border-end-sm">
              <div className="d-flex align-items-center gap-3 justify-content-center justify-content-sm-start">
                <div className="avatar avatar-md bg-soft-info rounded-circle d-flex align-items-center justify-content-center">
                  <Layers size={20} className="text-info" />
                </div>
                <div>
                  <span className="text-muted small fw-semibold text-uppercase d-block">Active Stages</span>
                  <h3 className="fw-bold mb-0 text-dark">{stageChartData.length}</h3>
                  <small className="text-muted">Pipeline locations</small>
                </div>
              </div>
            </div>

            <div className="col-xl-3 col-sm-6">
              <div className="d-flex align-items-center gap-3 justify-content-center justify-content-sm-start">
                <div className="avatar avatar-md bg-soft-warning rounded-circle d-flex align-items-center justify-content-center">
                  <CheckCircle2 size={20} className="text-warning" />
                </div>
                <div>
                  <span className="text-muted small fw-semibold text-uppercase d-block">In Production</span>
                  <h3 className="fw-bold mb-0 text-dark">{(stageCounts.PRODUCTION || 0).toLocaleString()}</h3>
                  <small className="text-muted">Staged on line</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stage Cards Grid */}
      <div className="row g-3 mb-4">
        {STAGE_CONFIG.map((stage) => (
          <div key={stage.id} className="col-xl-3 col-md-4 col-sm-6">
            <div
              className="card h-100 border shadow-none hover-shadow transition-all cursor-pointer"
              onClick={() => navigate(`/post-production/pallets/${stage.id}`)}
            >
              <div className="card-body p-3 d-flex align-items-center justify-content-between">
                <div>
                  <span className="text-muted small fw-semibold text-uppercase d-block">{stage.label}</span>
                  <h4 className="fw-bold mb-0 text-dark mt-1">{(stageCounts[stage.id] || 0).toLocaleString()}</h4>
                  <small className="text-primary mt-1 d-block" style={{ fontSize: '0.75rem' }}>View units →</small>
                </div>
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{ width: 42, height: 42, background: `${stage.chartColor}20` }}
                >
                  <i className={`ti ${stage.icon}`} style={{ fontSize: 18, color: stage.chartColor }}></i>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="row g-3 mb-4">
        {/* Stage Distribution Donut */}
        <div className="col-lg-5">
          <div className="card h-100 border shadow-none">
            <div className="card-header bg-light py-2.5 px-3">
              <h6 className="fw-bold mb-0 text-dark">Stage Distribution</h6>
            </div>
            <div className="card-body p-3">
              {stageChartData.length > 0 ? (
                <div>
                  <div style={{ height: 230 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stageChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {stageChartData.map((entry, idx) => (
                            <Cell key={idx} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v) => [v.toLocaleString(), 'Units']}
                          contentStyle={{ background: tooltipBg, borderColor: tooltipBorder, borderRadius: 6, fontSize: '0.8rem' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="d-flex flex-wrap justify-content-center gap-2 mt-2 pt-2 border-top">
                    {stageChartData.map((entry, idx) => (
                      <span key={idx} className="d-flex align-items-center gap-1.5 px-2 py-1 rounded bg-light border small">
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color, display: 'inline-block' }}></span>
                        <span className="text-muted">{entry.name}:</span>
                        <strong className="text-dark">{entry.value.toLocaleString()}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-5 text-muted small">No stage telemetry data available</div>
              )}
            </div>
          </div>
        </div>

        {/* Top Products Bar Chart */}
        <div className="col-lg-7">
          <div className="card h-100 border shadow-none">
            <div className="card-header bg-light py-2.5 px-3">
              <h6 className="fw-bold mb-0 text-dark">Top Products by Inventory Volume</h6>
            </div>
            <div className="card-body p-3">
              {productChartData.length > 0 ? (
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={productChartData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                      <XAxis type="number" tick={{ fill: chartTextColor, fontSize: 11 }} tickFormatter={v => v.toLocaleString()} />
                      <YAxis type="category" dataKey="name" tick={{ fill: chartTextColor, fontSize: 11 }} width={120} />
                      <Tooltip
                        formatter={(v, name, item) => [v.toLocaleString(), item.payload.fullName || name]}
                        contentStyle={{ background: tooltipBg, borderColor: tooltipBorder, borderRadius: 6, fontSize: '0.8rem' }}
                      />
                      <Bar dataKey="total" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Units" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center py-5 text-muted small">No product data available</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Product Matrix - Stacked Bar */}
      <div className="card border shadow-none">
        <div className="card-header bg-light py-2.5 px-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
          <h6 className="fw-bold mb-0 text-dark">Product SKU Stage Matrix</h6>
          <div className="input-group input-group-sm" style={{ width: '220px' }}>
            <span className="input-group-text"><Search size={14} /></span>
            <input
              type="text"
              className="form-control"
              placeholder="Filter products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="card-body p-3">
          {filteredProducts.length > 0 ? (
            <div style={{ minHeight: Math.max(filteredProducts.length * 36 + 60, 260) }}>
              <ResponsiveContainer width="100%" height={Math.max(filteredProducts.length * 36 + 60, 260)}>
                <BarChart
                  data={filteredProducts.map(p => {
                    const row = { name: (p.name || '').length > 25 ? (p.name || '').slice(0, 23) + '…' : (p.name || 'SKU'), fullName: p.name };
                    STAGE_CONFIG.forEach(stage => { row[stage.label] = p.stages?.[stage.id] || 0; });
                    return row;
                  })}
                  layout="vertical"
                  margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                  <XAxis type="number" tick={{ fill: chartTextColor, fontSize: 11 }} tickFormatter={v => v.toLocaleString()} />
                  <YAxis type="category" dataKey="name" tick={{ fill: chartTextColor, fontSize: 10 }} width={140} />
                  <Tooltip
                    formatter={(v, name) => [v.toLocaleString(), name]}
                    contentStyle={{ background: tooltipBg, borderColor: tooltipBorder, borderRadius: 6, fontSize: '0.8rem' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  {STAGE_CONFIG.map(stage => (
                    <Bar key={stage.id} dataKey={stage.label} stackId="a" fill={stage.chartColor} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-5 text-muted small">
              <Package size={36} strokeWidth={1} className="mb-2 opacity-50" />
              <p className="mb-0">No matching products found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InventoryOverview;
