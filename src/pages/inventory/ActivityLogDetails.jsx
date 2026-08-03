import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { inventoryApi } from '../../api/inventory';
import { format } from 'date-fns';

const BADGE_COLORS = {
  PRODUCTION_GENERATE: 'bg-soft-success',
  WAREHOUSE_INBOUND: 'bg-soft-primary',
  WAREHOUSE_OUTBOUND: 'bg-soft-warning',
  SHIPMENT_CREATE: 'bg-soft-info',
  UNIT_SCAN: 'bg-soft-secondary',
};

const ActivityLogDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [log, setLog] = useState(null);
  const [unitStatus, setUnitStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unitLoading, setUnitLoading] = useState(false);

  useEffect(() => {
    const fetchLog = async () => {
      setLoading(true);
      try {
        const response = await inventoryApi.getActivityLog(id);
        const logData = response.data.data;
        setLog(logData);
        if (logData.unit_internal_id) {
          setUnitLoading(true);
          try {
            const unitResponse = await inventoryApi.getUnitStatus(logData.unit_internal_id);
            setUnitStatus(unitResponse.data.data);
          } catch (err) {
            console.error('Failed to fetch unit status', err);
          } finally {
            setUnitLoading(false);
          }
        }
      } catch (error) {
        console.error('Failed to fetch activity log', error);
      } finally {
        setLoading(false);
      }
    };
    fetchLog();
  }, [id]);

  if (loading) {
    return (
      <div className="container-fluid">
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!log) {
    return (
      <div className="container-fluid">
        <div className="alert alert-warning">Activity log not found.</div>
      </div>
    );
  }

  const metadata = log.metadata || {};

  return (
    <div className="container-fluid">
      <button
        className="btn btn-outline-secondary mb-3"
        onClick={() => navigate('/post-production/activity-logs')}
      >
        <i className="ti ti-arrow-left me-1"></i>
        Back to Logs
      </button>

      <div className="row">
        {/* Activity Overview */}
        <div className="col-lg-6">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">
                <i className="ti ti-activity me-2"></i>
                Activity Details
              </h5>
            </div>
            <div className="card-body">
              <table className="table table-striped">
                <tbody>
                  <tr>
                    <th style={{ width: '40%' }}>Activity Type</th>
                    <td>
                      <span className={`badge ${BADGE_COLORS[log.activity_type] || 'bg-soft-secondary'}`}>
                        {log.activity_type}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <th>Description</th>
                    <td>{log.description || '—'}</td>
                  </tr>
                  <tr>
                    <th>Performed By</th>
                    <td>{log.performed_by_name || '—'}</td>
                  </tr>
                  <tr>
                    <th>Timestamp</th>
                    <td>
                      {log.timestamp
                        ? format(new Date(log.timestamp), 'dd MMM yyyy HH:mm:ss')
                        : '—'}
                    </td>
                  </tr>
                  <tr>
                    <th>Unit ID</th>
                    <td>{log.unit_internal_id || '—'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="col-lg-6">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">
                <i className="ti ti-file-info me-2"></i>
                Metadata
              </h5>
            </div>
            <div className="card-body">
              <table className="table table-striped">
                <tbody>
                  <tr>
                    <th style={{ width: '40%' }}>From Stage</th>
                    <td>{metadata.from_stage || '—'}</td>
                  </tr>
                  <tr>
                    <th>To Stage</th>
                    <td>{metadata.to_stage || '—'}</td>
                  </tr>
                  <tr>
                    <th>Trigger Method</th>
                    <td>{metadata.trigger_method || '—'}</td>
                  </tr>
                  <tr>
                    <th>Batch Mode</th>
                    <td>{metadata.batch_mode ? 'Yes' : 'No'}</td>
                  </tr>
                  <tr>
                    <th>Location</th>
                    <td>{metadata.location || '—'}</td>
                  </tr>
                  <tr>
                    <th>Quantity</th>
                    <td>{metadata.quantity ?? '—'}</td>
                  </tr>
                  <tr>
                    <th>Barcode</th>
                    <td>{metadata.barcode || '—'}</td>
                  </tr>
                  <tr>
                    <th>RFID</th>
                    <td>{metadata.rfid_number || '—'}</td>
                  </tr>
                  <tr>
                    <th>Session ID</th>
                    <td><small className="text-muted">{metadata.session_id || '—'}</small></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Unit Intelligence */}
      {log.unit_internal_id && (
        <div className="row mt-3">
          <div className="col-12">
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">
                  <i className="ti ti-cpu me-2"></i>
                  Unit Intelligence
                </h5>
              </div>
              <div className="card-body">
                {unitLoading ? (
                  <div className="text-center py-3">
                    <div className="spinner-border spinner-border-sm text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <span className="ms-2">Loading unit data...</span>
                  </div>
                ) : unitStatus ? (
                  <>
                    <div className="row mb-4">
                      <div className="col-md-4">
                        <div className="border rounded p-3 text-center">
                          <small className="text-muted d-block">Product</small>
                          <strong>{unitStatus.product_name || '—'}</strong>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="border rounded p-3 text-center">
                          <small className="text-muted d-block">Warehouse</small>
                          <strong>{unitStatus.current_warehouse_name || '—'}</strong>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="border rounded p-3 text-center">
                          <small className="text-muted d-block">Quantity</small>
                          <strong>{unitStatus.quantity ?? '—'}</strong>
                        </div>
                      </div>
                    </div>
                    <div className="row mb-4">
                      <div className="col-md-6">
                        <p className="mb-1">
                          <strong>Barcode:</strong>{' '}
                          {unitStatus.barcode || unitStatus.current_barcode || '—'}
                        </p>
                      </div>
                      <div className="col-md-6">
                        <p className="mb-1">
                          <strong>RFID:</strong> {unitStatus.rfid_number || '—'}
                        </p>
                      </div>
                    </div>
                    {unitStatus.history && unitStatus.history.length > 0 && (
                      <div>
                        <h6 className="mb-3">
                          <i className="ti ti-history me-1"></i>
                          Recent History
                        </h6>
                        <ul className="list-group">
                          {unitStatus.history.map((item, index) => (
                            <li key={index} className="list-group-item d-flex justify-content-between align-items-center">
                              <div>
                                <span className="badge bg-soft-secondary me-2">
                                  {item.activity_type || item.action}
                                </span>
                                <span>{item.description || ''}</span>
                              </div>
                              <small className="text-muted">
                                {item.timestamp
                                  ? format(new Date(item.timestamp), 'dd MMM HH:mm')
                                  : ''}
                              </small>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-muted mb-0">Unable to load unit intelligence data.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityLogDetails;
