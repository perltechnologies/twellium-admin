import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { inventoryApi } from '../../api/inventory';

const PostProductionDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    palletsToday: 0,
    activeUnits: 0,
    activitiesCount: 0,
  });
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
      const activityData = activityRes.data.data;

      setStats({
        palletsToday: overview.new_pallets_produced || 0,
        activeUnits: overview.total_units_active || 0,
        activitiesCount: Array.isArray(activityData) ? activityData.length : 0,
      });

      setActivities(Array.isArray(activityData) ? activityData : []);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const navigationCards = [
    { title: 'Lookup Units', icon: 'ti-search', path: '/post-production/lookup', color: 'primary' },
    { title: 'Manage Stages', icon: 'ti-settings', path: '/post-production/manage-stages', color: 'warning' },
    { title: 'Find Barcode', icon: 'ti-barcode', path: '/post-production/find-barcode', color: 'info' },
    { title: 'Find RFID', icon: 'ti-wifi', path: '/post-production/find-rfid', color: 'success' },
  ];

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
        <h4 className="mb-0">Post-Production Dashboard</h4>
        <div className="d-flex gap-2">
          <button className="btn btn-sm btn-outline-primary" onClick={fetchDashboardData}>
            <i className="ti ti-refresh me-1"></i>Refresh
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="row g-3 mb-4">
        <div className="col-xl-3 col-sm-6">
          <div className="card mb-0">
            <div className="card-body">
              <div className="d-flex align-items-start justify-content-between">
                <div>
                  <p className="fs-14 mb-1">Pallets Produced Today</p>
                  <h2 className="mb-1 fs-16">{stats.palletsToday}</h2>
                </div>
                <span className="avatar avatar-md rounded-circle bg-soft-primary border border-primary">
                  <i className="ti ti-package fs-16 text-primary"></i>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-xl-3 col-sm-6">
          <div className="card mb-0">
            <div className="card-body">
              <div className="d-flex align-items-start justify-content-between">
                <div>
                  <p className="fs-14 mb-1">Active Units in System</p>
                  <h2 className="mb-1 fs-16">{stats.activeUnits.toLocaleString()}</h2>
                </div>
                <span className="avatar avatar-md rounded-circle bg-soft-success border border-success">
                  <i className="ti ti-check fs-16 text-success"></i>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-xl-3 col-sm-6">
          <div className="card mb-0">
            <div className="card-body">
              <div className="d-flex align-items-start justify-content-between">
                <div>
                  <p className="fs-14 mb-1">Recent Activities</p>
                  <h2 className="mb-1 fs-16">{stats.activitiesCount}</h2>
                </div>
                <span className="avatar avatar-md rounded-circle bg-soft-warning border border-warning">
                  <i className="ti ti-activity fs-16 text-warning"></i>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Card */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card bg-primary text-white mb-0">
            <div className="card-body d-flex align-items-center justify-content-between">
              <div>
                <h5 className="text-white mb-1">Inventory Overview</h5>
                <p className="mb-0 opacity-75">View complete inventory distribution across all stages and products</p>
              </div>
              <button
                className="btn btn-light btn-sm"
                onClick={() => navigate('/post-production/overview')}
              >
                <i className="ti ti-arrow-right me-1"></i>View Overview
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Cards */}
      <div className="row g-3 mb-4">
        {navigationCards.map((item) => (
          <div key={item.path} className="col-xl-3 col-sm-6">
            <div
              className="card mb-0"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(item.path)}
            >
              <div className="card-body text-center py-4">
                <span className={`avatar avatar-lg rounded-circle bg-soft-${item.color} border border-${item.color} mb-3`}>
                  <i className={`ti ${item.icon} fs-20 text-${item.color}`}></i>
                </span>
                <h6 className="mb-0">{item.title}</h6>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity Table */}
      <div className="card">
        <div className="card-header d-flex align-items-center justify-content-between">
          <h5 className="card-title mb-0">Recent Activity</h5>
        </div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-striped">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Details</th>
                  <th>User</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {activities.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center text-muted py-4">
                      No recent activities
                    </td>
                  </tr>
                ) : (
                  activities.map((activity, index) => (
                    <tr key={activity.id || index}>
                      <td>
                        <span className="badge bg-soft-primary text-primary">
                          {activity.action || activity.type || '-'}
                        </span>
                      </td>
                      <td>{activity.details || activity.description || '-'}</td>
                      <td>{activity.user || activity.performed_by || '-'}</td>
                      <td>
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
    </div>
  );
};

export default PostProductionDashboard;
