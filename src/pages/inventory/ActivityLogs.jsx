import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { inventoryApi } from '../../api/inventory';
import { format } from 'date-fns';

const ACTION_TYPES = [
  { value: '', label: 'All Actions' },
  { value: 'PRODUCTION_GENERATE', label: 'Production Generate' },
  { value: 'WAREHOUSE_INBOUND', label: 'Warehouse Inbound' },
  { value: 'WAREHOUSE_OUTBOUND', label: 'Warehouse Outbound' },
  { value: 'SHIPMENT_CREATE', label: 'Shipment Create' },
  { value: 'UNIT_SCAN', label: 'Unit Scan' },
];

const BADGE_COLORS = {
  PRODUCTION_GENERATE: 'bg-soft-success',
  WAREHOUSE_INBOUND: 'bg-soft-primary',
  WAREHOUSE_OUTBOUND: 'bg-soft-warning',
  SHIPMENT_CREATE: 'bg-soft-info',
  UNIT_SCAN: 'bg-soft-secondary',
};

const ActivityLogs = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [actionType, setActionType] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = { page, page_size: pageSize };
      if (search.trim()) params.search = search.trim();
      if (actionType) params.action_type = actionType;
      const response = await inventoryApi.getActivityLogs(params);
      const data = response.data;
      setLogs(data.data || []);
      setCount(data.count || 0);
      setHasNext(!!data.next);
      setHasPrevious(!!data.previous);
    } catch (error) {
      console.error('Failed to fetch activity logs', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, pageSize, actionType]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const totalPages = Math.ceil(count / pageSize);

  return (
    <div className="container-fluid">
      <div className="card">
        <div className="card-header">
          <h5 className="mb-0">
            <i className="ti ti-activity me-2"></i>
            Activity Logs
          </h5>
        </div>
        <div className="card-body">
          {/* Filters */}
          <form onSubmit={handleSearchSubmit} className="row g-3 mb-4">
            <div className="col-md-4">
              <input
                type="text"
                className="form-control"
                placeholder="Search logs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <select
                className="form-select"
                value={actionType}
                onChange={(e) => {
                  setActionType(e.target.value);
                  setPage(1);
                }}
              >
                {ACTION_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <select
                className="form-select"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>
            </div>
            <div className="col-md-2">
              <button type="submit" className="btn btn-primary w-100">
                <i className="ti ti-search me-1"></i>
                Search
              </button>
            </div>
          </form>

          {/* Table */}
          <div className="table-responsive">
            <table className="table table-striped table-hover">
              <thead>
                <tr>
                  <th>Activity Type</th>
                  <th>Unit ID</th>
                  <th>Description</th>
                  <th>Performed By</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" className="text-center py-4">
                      Loading...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-4 text-muted">
                      No activity logs found
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr
                      key={log.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/post-production/activity-logs/${log.id}`)}
                    >
                      <td>
                        <span className={`badge ${BADGE_COLORS[log.activity_type] || 'bg-soft-secondary'}`}>
                          {log.activity_type}
                        </span>
                      </td>
                      <td>{log.unit_internal_id || '—'}</td>
                      <td>{log.description || '—'}</td>
                      <td>{log.performed_by_name || '—'}</td>
                      <td>
                        {log.timestamp
                          ? format(new Date(log.timestamp), 'dd MMM yyyy HH:mm')
                          : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="d-flex justify-content-between align-items-center mt-3">
              <small className="text-muted">
                Page {page} of {totalPages} ({count} total)
              </small>
              <nav>
                <ul className="pagination pagination-sm mb-0">
                  <li className={`page-item ${!hasPrevious ? 'disabled' : ''}`}>
                    <button
                      className="page-link"
                      onClick={() => setPage((p) => p - 1)}
                      disabled={!hasPrevious}
                    >
                      <i className="ti ti-chevron-left"></i>
                    </button>
                  </li>
                  <li className="page-item active">
                    <span className="page-link">{page}</span>
                  </li>
                  <li className={`page-item ${!hasNext ? 'disabled' : ''}`}>
                    <button
                      className="page-link"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={!hasNext}
                    >
                      <i className="ti ti-chevron-right"></i>
                    </button>
                  </li>
                </ul>
              </nav>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivityLogs;
