import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { inventoryApi } from '../../api/inventory';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const STAGE_COLORS = {
  PRODUCTION: '#3b82f6',
  WAREHOUSE: '#06b6d4',
  QUALIFIED: '#22c55e',
  EXTERNAL_WAREHOUSE: '#f59e0b',
  LOADING: '#8b5cf6',
  LOADED: '#16a34a',
  FAULTY: '#ef4444',
  DAMAGED: '#dc2626',
};

const PostProductionDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    palletsToday: 0,
    activeUnits: 0,
    activitiesCount: 0,
  });
  const [stageCounts, setStageCounts] = useState({});
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [overviewRes, stageRes, activityRes] = await Promise.all([
        inventoryApi.getTodayOverview(),
        inventoryApi.getStageCounts(),
        inventoryApi.getActivityLogs({ page_size: 10 }),
      ]);

      const overview = overviewRes.data.data;
      const stageData = stageRes.data.data;
      const activityData = activityRes.data.data;

      setStats({
        palletsToday: overview.new_pallets_produced || 0,
        activeUnits: stageData.total_units || overview.total_units_active || 0,
        activitiesCount: Array.isArray(activityData) ? activityData.length : 0,
      });
      setStageCounts(stageData.stage_counts || {});
      setActivities(Array.isArray(activityData) ? activityData : []);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const stageChartData = Object.entries(stageCounts)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({ name: key.replace(/_/g, ' '), value, color: STAGE_COLORS[key] || '#64748b' }));

  const quickActions = [
    { title: 'Plant Overview', icon: 'ti-chart-dots-3', path: '/post-production/analytics/plant-overview', color: '#8b5cf6' },
    { title: 'Production Mode', icon: 'ti-building-factory', path: '/post-production/production', color: '#3b82f6' },
    { title: 'Inventory', icon: 'ti-chart-bar', path: '/post-production/overview', color: '#06b6d4' },
    { title: 'Bulk Barcodes', icon: 'ti-barcode', path: '/post-production/analytics/bulk-barcodes', color: '#22c55e' },
    { title: 'Batch Trace', icon: 'ti-git-branch', path: '/post-production/analytics/batch-traceability', color: '#f59e0b' },
    { title: 'Trends', icon: 'ti-trending-up', path: '/post-production/analytics/trends', color: '#ec4899' },
    { title: 'Lookup Unit', icon: 'ti-search', path: '/post-production/lookup', color: '#14b8a6' },
    { title: 'Warehouse', icon: 'ti-building-warehouse', path: '/post-production/warehouse', color: '#64748b' },
  ];

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
          Post-Production Dashboard
        </h5>
        <button
          className="btn btn-sm"
          style={{ background: '#334155', color: '#e2e8f0', border: '1px solid #475569' }}
          onClick={fetchDashboardData}
        >
          <i className="ti ti-refresh me-1"></i>Refresh
        </button>
      </div>

      {/* Summary Stats Bar */}
      <div style={{ background: '#1e293b', borderRadius: 8, padding: '14px 20px', marginBottom: 16, border: '1px solid #334155' }}>
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
          <div>
            <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Pallets Today</div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#22c55e' }}>{stats.palletsToday}</div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Active Units</div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#f1f5f9' }}>{stats.activeUnits.toLocaleString()}</div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Recent Activities</div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#3b82f6' }}>{stats.activitiesCount}</div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Stages Active</div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#f59e0b' }}>{stageChartData.length}</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="row g-2 mb-4">
        {quickActions.map((item) => (
          <div key={item.path} className="col-xl-3 col-md-4 col-sm-6">
            <div
              style={{ background: '#1e293b', borderRadius: 8, padding: '14px', border: '1px solid #334155', cursor: 'pointer', transition: 'all 0.2s' }}
              onClick={() => navigate(item.path)}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = item.color; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <div className="d-flex align-items-center gap-3">
                <div style={{ width: 40, height: 40, borderRadius: 8, background: `${item.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className={`ti ${item.icon}`} style={{ fontSize: 18, color: item.color }}></i>
                </div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>{item.title}</span>
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
              Units by Stage
            </h6>
            {stageChartData.length > 0 ? (
              <div>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={stageChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2} dataKey="value">
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
              <div className="text-center py-4" style={{ color: '#64748b' }}>No data available</div>
            )}
          </div>
        </div>

        {/* Stage Cards Grid */}
        <div className="col-lg-7">
          <div style={{ background: '#1e293b', borderRadius: 8, padding: '16px', border: '1px solid #334155', height: '100%' }}>
            <h6 style={{ color: '#f1f5f9', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>
              Stage Breakdown
            </h6>
            <div className="row g-2">
              {Object.entries(stageCounts).map(([stage, count]) => (
                <div key={stage} className="col-6">
                  <div
                    style={{ background: '#0f172a', borderRadius: 6, padding: '10px 12px', cursor: 'pointer', borderLeft: `3px solid ${STAGE_COLORS[stage] || '#64748b'}` }}
                    onClick={() => navigate(`/post-production/pallets/${stage}`)}
                  >
                    <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>{stage.replace(/_/g, ' ')}</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#f1f5f9' }}>{(count || 0).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div style={{ background: '#1e293b', borderRadius: 8, padding: '16px', border: '1px solid #334155' }}>
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h6 style={{ color: '#f1f5f9', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>
            Recent Activity
          </h6>
          <button
            className="btn btn-sm"
            style={{ background: '#334155', color: '#94a3b8', border: 'none', fontSize: 11 }}
            onClick={() => navigate('/post-production/activity-logs')}
          >
            View All →
          </button>
        </div>
        <div className="table-responsive">
          <table className="table table-sm mb-0" style={{ color: '#e2e8f0' }}>
            <thead>
              <tr style={{ borderColor: '#334155' }}>
                <th style={{ color: '#94a3b8', fontSize: 11, borderColor: '#334155' }}>Action</th>
                <th style={{ color: '#94a3b8', fontSize: 11, borderColor: '#334155' }}>Details</th>
                <th style={{ color: '#94a3b8', fontSize: 11, borderColor: '#334155' }}>User</th>
                <th style={{ color: '#94a3b8', fontSize: 11, borderColor: '#334155' }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {activities.length === 0 ? (
                <tr>
                  <td colSpan="4" className="text-center py-4" style={{ color: '#64748b', borderColor: '#334155' }}>
                    No recent activities
                  </td>
                </tr>
              ) : (
                activities.map((activity, index) => (
                  <tr key={activity.id || index} style={{ borderColor: '#334155' }}>
                    <td style={{ borderColor: '#334155' }}>
                      <span style={{ background: '#3b82f620', color: '#3b82f6', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                        {activity.action || activity.type || '-'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, borderColor: '#334155' }}>{activity.details || activity.description || '-'}</td>
                    <td style={{ fontSize: 12, color: '#94a3b8', borderColor: '#334155' }}>{activity.user || activity.performed_by || '-'}</td>
                    <td style={{ fontSize: 11, color: '#64748b', borderColor: '#334155' }}>
                      {activity.created_at || activity.timestamp
                        ? format(new Date(activity.created_at || activity.timestamp), 'MMM dd, HH:mm')
                        : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PostProductionDashboard;
