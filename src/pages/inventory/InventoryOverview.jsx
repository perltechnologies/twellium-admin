import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { inventoryApi } from '../../api/inventory';
import { useTheme } from '../../context/ThemeContext';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { Boxes, Package, RefreshCw, Search, Layers, CheckCircle2, AlertTriangle, Truck, ChevronDown, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';

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

// Stages shown in the Warehouse Distribution chart legend, in display order.
const WAREHOUSE_STAGE_IDS = [
  'WAREHOUSE',
  'QUALIFIED',
  'LOADING',
  'FAULTY',
  'DAMAGED',
  'EXTERNAL_WAREHOUSE',
  'PRODUCTION',
];

// Rows shown in each Product Matrix card (labels follow the warehouse workflows).
const MATRIX_CARD_STAGES = [
  { id: 'PRODUCTION', label: 'Production' },
  { id: 'WAREHOUSE', label: 'Warehouse (Inbound)' },
  { id: 'FAULTY', label: 'Warehouse (Reject)' },
  { id: 'QUALIFIED', label: 'Warehouse (Restore)' },
  { id: 'EXTERNAL_WAREHOUSE', label: 'Ex-Warehouse' },
  { id: 'DAMAGED', label: 'Damaged' },
].map(s => ({ ...s, color: STAGE_CONFIG.find(c => c.id === s.id)?.chartColor || '#94a3b8' }));

const ProductMatrixCard = ({ product, index, expanded, onToggle }) => {
  const stages = product.stages || {};
  const rows = MATRIX_CARD_STAGES.map(s => ({ ...s, value: Number(stages[s.id]) || 0 }));
  const listed = rows.reduce((sum, r) => sum + r.value, 0);
  const total = Number(product.total_count ?? product.total) || listed;
  if (total - listed > 0) rows.push({ id: 'OTHER', label: 'Other', color: '#94a3b8', value: total - listed });
  const sku = [product.sku_code, product.sku, product.product_sku]
    .map((v) => (v == null ? '' : String(v).trim()))
    .find(Boolean);
  const pct = (v) => (total > 0 ? (v / total) * 100 : 0);

  return (
    <div className="card h-100 border shadow-none hover-shadow transition-all">
      <div className="card-body p-3 d-flex flex-column">
        {/* Header */}
        <div
          className="d-flex align-items-start justify-content-between gap-3 mb-3"
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          onClick={onToggle}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onToggle();
            }
          }}
          style={{ cursor: 'pointer', userSelect: 'none' }}
        >
          <div className="d-flex align-items-start gap-2 min-w-0" style={{ minWidth: 0 }}>
            <span
              className="rounded-circle bg-soft-primary text-primary fw-bold d-flex align-items-center justify-content-center flex-shrink-0"
              style={{ width: 28, height: 28, fontSize: '0.8rem' }}
            >
              {index}
            </span>
            <div style={{ minWidth: 0 }}>
              <h6 className="fw-bold text-dark text-uppercase mb-1" style={{ lineHeight: 1.25, wordBreak: 'break-word' }}>
                {product.name || 'Unknown'}
              </h6>
              {sku && (
                <span className="badge bg-light text-muted border fw-semibold" style={{ fontSize: '0.7rem' }}>
                  SKU: <span className="text-dark">{sku}</span>
                </span>
              )}
            </div>
          </div>
          <div className="d-flex align-items-start gap-2 flex-shrink-0">
            <div className="text-end">
              <span className="text-muted fw-semibold text-uppercase d-block" style={{ fontSize: '0.65rem', letterSpacing: '0.04em' }}>Total</span>
              <span className="fw-bold text-dark" style={{ fontSize: '1.5rem', lineHeight: 1 }}>{total.toLocaleString()}</span>
            </div>
            <ChevronDown
              size={18}
              className="text-muted mt-1"
              style={{ transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          </div>
        </div>

        {/* Distribution bar */}
        <div className={`d-flex rounded-pill overflow-hidden ${expanded ? 'mb-3' : ''}`} style={{ height: 8, background: 'rgba(148,163,184,0.2)' }}>
          {rows.filter(r => r.value > 0).map(r => (
            <div
              key={r.id}
              title={`${r.label}: ${r.value.toLocaleString()}`}
              style={{ width: `${pct(r.value)}%`, background: r.color }}
            />
          ))}
        </div>

        {/* Stage rows */}
        {expanded && (
        <div className="d-flex flex-column mt-auto">
          <div className="d-flex justify-content-between text-muted text-uppercase fw-semibold pb-1 border-bottom" style={{ fontSize: '0.65rem', letterSpacing: '0.04em' }}>
            <span>Stage</span>
            <span>Quantity</span>
          </div>
          {rows.map(r => (
            <div
              key={r.id}
              className="d-flex align-items-center justify-content-between gap-2 py-1 border-bottom small"
              style={{ opacity: r.value === 0 ? 0.55 : 1 }}
            >
              <span className="d-flex align-items-center gap-2 text-truncate">
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, flex: '0 0 auto' }} />
                <span className="text-dark text-truncate">{r.label}</span>
              </span>
              <span className="d-flex align-items-center gap-2 flex-shrink-0">
                {r.value > 0 && (
                  <span className="text-muted" style={{ fontSize: '0.7rem' }}>{pct(r.value).toFixed(pct(r.value) % 1 === 0 ? 0 : 1)}%</span>
                )}
                <strong className="text-dark text-end" style={{ minWidth: 32 }}>{r.value.toLocaleString()}</strong>
              </span>
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
};

const InventoryOverview = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [loading, setLoading] = useState(true);
  const [totalUnits, setTotalUnits] = useState(0);
  const [stageCounts, setStageCounts] = useState({});
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedCards, setCollapsedCards] = useState(() => new Set());

  const fetchData = async () => {
    try {
      setLoading(true);
      const [response, productsRes] = await Promise.all([
        inventoryApi.getStageCounts(),
        // Stage-counts only returns id/name/total/stages, so SKU codes come from the product list.
        inventoryApi.getProducts({ page_size: 1000 }).catch(() => null),
      ]);
      const data = response?.data?.data ?? response?.data ?? {};
      setTotalUnits(data.total_units || 0);
      setStageCounts(data.stage_counts || {});
      const pd = productsRes?.data;
      const productList = Array.isArray(pd) ? pd : pd?.results ?? pd?.data?.results ?? pd?.data ?? [];
      const skuById = {};
      const skuByName = {};
      (Array.isArray(productList) ? productList : []).forEach((p) => {
        if (p.id != null) skuById[String(p.id)] = p.sku_code;
        if (p.name) skuByName[p.name.trim().toLowerCase()] = p.sku_code;
      });
      const breakdown = Array.isArray(data.product_breakdown) ? data.product_breakdown : [];
      setProducts(
        breakdown.map((item) => ({
          ...item,
          sku_code:
            item.sku_code ??
            item.sku ??
            skuById[String(item.id ?? item.product_id)] ??
            skuByName[(item.name || '').trim().toLowerCase()],
        }))
      );
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

  const productKey = (product, idx) => String(product.id ?? product.product_id ?? `${product.name}-${idx}`);

  const toggleCard = (key) =>
    setCollapsedCards((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const allCollapsed = products.length > 0 && collapsedCards.size >= products.length;
  const toggleAllCards = () =>
    setCollapsedCards(allCollapsed ? new Set() : new Set(products.map(productKey)));

  const stageChartData = useMemo(() =>
    STAGE_CONFIG
      .map(stage => ({ name: stage.label, value: Number(stageCounts[stage.id]) || 0, color: stage.chartColor }))
      .filter(d => d.value > 0),
    [stageCounts]
  );

  // Distribution across the configured warehouse-related stages. Ordered to
  // match WAREHOUSE_STAGE_IDS. The legend lists every configured stage; the pie
  // only renders slices with a non-zero count.
  const warehouseLegend = useMemo(() =>
    WAREHOUSE_STAGE_IDS.map(id => {
      const stage = STAGE_CONFIG.find(s => s.id === id);
      return {
        id,
        name: stage?.label || id,
        color: stage?.chartColor || '#94a3b8',
        value: Number(stageCounts[id]) || 0,
      };
    }),
    [stageCounts]
  );

  const warehouseChartData = useMemo(
    () => warehouseLegend.filter(d => d.value > 0),
    [warehouseLegend]
  );

  const warehouseTotal = useMemo(
    () => warehouseLegend.reduce((s, d) => s + d.value, 0),
    [warehouseLegend]
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
        {/* Warehouse Distribution Donut */}
        <div className="col-lg-5">
          <div className="card h-100 border shadow-none">
            <div className="card-header bg-light py-2.5 px-3 d-flex align-items-center justify-content-between">
              <h6 className="fw-bold mb-0 text-dark">Warehouse Distribution</h6>
              {warehouseTotal > 0 && (
                <span className="badge bg-soft-primary text-primary">{warehouseTotal.toLocaleString()} units</span>
              )}
            </div>
            <div className="card-body p-3">
              <div className="d-flex flex-column flex-md-row align-items-center gap-3">
                <div style={{ height: 230, flex: '1 1 55%', minWidth: 0, width: '100%' }}>
                  {warehouseChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={warehouseChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {warehouseChartData.map((entry, idx) => (
                            <Cell key={idx} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v) => [v.toLocaleString(), 'Units']}
                          contentStyle={{ background: tooltipBg, borderColor: tooltipBorder, borderRadius: 6, fontSize: '0.8rem' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="d-flex align-items-center justify-content-center h-100 text-muted small">
                      No warehouse stock currently in storage
                    </div>
                  )}
                </div>
                <div
                  className="d-flex flex-column gap-2 ps-md-3 w-100"
                  style={{ flex: '1 1 45%', maxWidth: 260 }}
                >
                  {warehouseLegend.map((entry) => (
                    <div key={entry.id} className="d-flex align-items-center justify-content-between gap-2 small">
                      <span className="d-flex align-items-center gap-2 text-truncate">
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: entry.color, display: 'inline-block', flex: '0 0 auto' }}></span>
                        <span className="text-muted text-truncate">{entry.name}</span>
                      </span>
                      <strong className="text-dark">{entry.value.toLocaleString()}</strong>
                    </div>
                  ))}
                </div>
              </div>
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

      {/* Product Matrix - per-product cards */}
      <div className="card border shadow-none mb-4">
        <div className="card-header bg-light py-2.5 px-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div className="d-flex align-items-center gap-2">
            <Layers size={16} className="text-primary" />
            <h6 className="fw-bold mb-0 text-dark">Product Matrix</h6>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="badge bg-soft-primary text-primary">{products.length} products</span>
            {products.length > 0 && (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                onClick={toggleAllCards}
              >
                {allCollapsed ? <ChevronsUpDown size={14} /> : <ChevronsDownUp size={14} />}
                <span>{allCollapsed ? 'Expand all' : 'Collapse all'}</span>
              </button>
            )}
          </div>
        </div>
        <div className="card-body p-3">
          {products.length > 0 ? (
            <div className="row g-3">
              {products.map((product, idx) => (
                <div key={productKey(product, idx)} className="col-xxl-4 col-lg-6">
                  <ProductMatrixCard
                    product={product}
                    index={idx + 1}
                    expanded={!collapsedCards.has(productKey(product, idx))}
                    onToggle={() => toggleCard(productKey(product, idx))}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-muted small">No product data available</div>
          )}
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
