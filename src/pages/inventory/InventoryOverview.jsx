import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { inventoryApi } from '../../api/inventory';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

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

  const stageChartData = useMemo(() =>
    STAGE_CONFIG
      .map(stage => ({ name: stage.label, value: stageCounts[stage.id] || 0, color: stage.chartColor }))
      .filter(d => d.value > 0)
  , [stageCounts]);

  const productChartData = useMemo(() =>
    [...products]
      .sort((a, b) => (b.total_count || 0) - (a.total_count || 0))
      .slice(0, 10)
      .map(p => ({ name: p.name?.length > 20 ? p.name.slice(0, 18) + '…' : p.name, total: p.total_count || 0 }))
  , [products]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px', background: '#0f172a' }}>
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  return (
    <div style={{ background: '#0f172a', minHeight: '100vh', padding: '16px', color: '#e2e8f0', margin: '-24px', marginBottom: '-48px' }}>
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h5 className="mb-0 fw-bold" style={{ color: '#f1f5f9', fontSize: '15px', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Inventory Distribution Overview
        </h5>
        <button className="btn btn-sm" style={{ background: '#334155', color: '#e2e8f0', border: '1px solid #475569' }} onClick={fetchData}>
          <i className="ti ti-refresh me-1"></i>Refresh
        </button>
      </div>

      {/* Global Summary Bar */}
      <div style={{ background: '#1e293b', borderRadius: 8, padding: '12px 20px', marginBottom: 16, border: '1px solid #334155' }}>
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
          <div>
            <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Total Units</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#f1f5f9' }}>{totalUnits.toLocaleString()}</div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Active SKUs</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#22c55e' }}>{products.length}</div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Stages Active</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#3b82f6' }}>{stageChartData.length}</div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>In Production</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#f59e0b' }}>{(stageCounts.PRODUCTION || 0).toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Stage Cards */}
      <div className="row g-2 mb-4">
        {STAGE_CONFIG.map((stage) => (
          <div key={stage.id} className="col-xl-3 col-md-4 col-sm-6">
            <div
              style={{ background: '#1e293b', borderRadius: 8, padding: '12px 16px', border: '1px solid #334155', cursor: 'pointer', transition: 'border-color 0.2s' }}
              onClick={() => navigate(`/post-production/pallets/${stage.id}`)}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = stage.chartColor}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = '#334155'}
            >
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>{stage.label}</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#f1f5f9' }}>{(stageCounts[stage.id] || 0).toLocaleString()}</div>
                </div>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${stage.chartColor}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className={`ti ${stage.icon}`} style={{ fontSize: 16, color: stage.chartColor }}></i>
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
          <div style={{ background: '#1e293b', borderRadius: 8, padding: '16px', border: '1px solid #334155', height: '100%' }}>
            <h6 style={{ color: '#f1f5f9', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>
              Stage Distribution
            </h6>
            {stageChartData.length > 0 ? (
              <div>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={stageChartData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={2} dataKey="value">
                      {stageChartData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) => [v.toLocaleString(), 'Units']}
                      contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 6, color: '#e2e8f0' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="d-flex flex-wrap justify-content-center gap-2 mt-2">
                  {stageChartData.map((entry, idx) => (
                    <span key={idx} className="d-flex align-items-center gap-1" style={{ fontSize: '10px', color: '#94a3b8' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color, display: 'inline-block' }}></span>
                      {entry.name}: {entry.value.toLocaleString()}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-4" style={{ color: '#64748b' }}>No stage data</div>
            )}
          </div>
        </div>

        {/* Top Products Bar */}
        <div className="col-lg-7">
          <div style={{ background: '#1e293b', borderRadius: 8, padding: '16px', border: '1px solid #334155', height: '100%' }}>
            <h6 style={{ color: '#f1f5f9', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>
              Top Products by Volume
            </h6>
            {productChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={productChartData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => v.toLocaleString()} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} width={120} />
                  <Tooltip
                    formatter={(v) => [v.toLocaleString(), 'Units']}
                    contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 6, color: '#e2e8f0' }}
                  />
                  <Bar dataKey="total" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-4" style={{ color: '#64748b' }}>No product data</div>
            )}
          </div>
        </div>
      </div>

      {/* Product Matrix - Stacked Bar */}
      <div style={{ background: '#1e293b', borderRadius: 8, padding: '16px', border: '1px solid #334155' }}>
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h6 style={{ color: '#f1f5f9', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>
            Product Matrix
          </h6>
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 200, background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0', borderRadius: 6, padding: '4px 10px', fontSize: 12 }}
          />
        </div>
        {filteredProducts.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(filteredProducts.length * 38 + 60, 300)}>
            <BarChart
              data={filteredProducts.map(p => {
                const row = { name: p.name?.length > 25 ? p.name.slice(0, 23) + '…' : p.name };
                STAGE_CONFIG.forEach(stage => { row[stage.label] = p.stages?.[stage.id] || 0; });
                return row;
              })}
              layout="vertical"
              margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => v.toLocaleString()} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} width={140} />
              <Tooltip
                formatter={(v, name) => [v.toLocaleString(), name]}
                contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 6, color: '#e2e8f0', fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
              {STAGE_CONFIG.map(stage => (
                <Bar key={stage.id} dataKey={stage.label} stackId="a" fill={stage.chartColor} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-4" style={{ color: '#64748b' }}>
            <i className="ti ti-package-off" style={{ fontSize: 32, display: 'block', marginBottom: 8 }}></i>
            No products found
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryOverview;
