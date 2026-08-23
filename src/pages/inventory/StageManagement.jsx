import React, { useState, useEffect, useMemo } from 'react';
import { inventoryApi } from '../../api/inventory';
import { Pagination } from '../../components/ui/Pagination';
import { toast } from 'react-hot-toast';

const StageManagement = () => {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingStage, setEditingStage] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [form, setForm] = useState({ name: '', display_name: '', barcode_prefix: '' });
  const [submitting, setSubmitting] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchStages = async () => {
    setLoading(true);
    try {
      const response = await inventoryApi.getStages();
      const data = response.data;
      const list = Array.isArray(data) ? data : data.data || [];
      setStages(list);
    } catch (error) {
      toast.error('Failed to load stages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStages();
  }, []);

  const paginatedStages = useMemo(() => {
    const start = (page - 1) * pageSize;
    return stages.slice(start, start + pageSize);
  }, [stages, page, pageSize]);

  const resetForm = () => {
    setForm({ name: '', display_name: '', barcode_prefix: '' });
    setEditingStage(null);
    setShowForm(false);
  };

  const handleEdit = (stage) => {
    setEditingStage(stage);
    setForm({
      name: stage.name || '',
      display_name: stage.display_name || '',
      barcode_prefix: stage.barcode_prefix || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.display_name.trim()) {
      toast.error('Name and Display Name are required');
      return;
    }
    if (form.barcode_prefix && form.barcode_prefix.length > 1) {
      toast.error('Barcode prefix must be a single character');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim().toUpperCase(),
        display_name: form.display_name.trim(),
        barcode_prefix: form.barcode_prefix.trim() || null,
      };

      if (editingStage) {
        await inventoryApi.updateStage(editingStage.id, payload);
        toast.success('Stage updated successfully');
      } else {
        await inventoryApi.createStage(payload);
        toast.success('Stage created successfully');
      }
      resetForm();
      fetchStages();
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to save stage';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (stage) => {
    try {
      await inventoryApi.deleteStage(stage.id);
      toast.success('Stage deleted successfully');
      setDeleteConfirm(null);
      fetchStages();
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to delete stage';
      toast.error(msg);
    }
  };

  return (
    <div className="container-fluid">
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0">
            <i className="ti ti-settings me-2"></i>
            Post-Production Stages
          </h5>
          {!showForm && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
              <i className="ti ti-plus me-1"></i>
              Add Stage
            </button>
          )}
        </div>
        <div className="card-body">
          {/* Form */}
          {showForm && (
            <div className="card border mb-4">
              <div className="card-header">
                <h6 className="mb-0">{editingStage ? 'Edit Stage' : 'New Stage'}</h6>
              </div>
              <div className="card-body">
                <form onSubmit={handleSubmit}>
                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="form-label">
                        Internal Name <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. WAREHOUSE"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        disabled={submitting}
                      />
                      <div className="form-text">Uppercase internal identifier</div>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">
                        Display Name <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Warehouse"
                        value={form.display_name}
                        onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                        disabled={submitting}
                      />
                      <div className="form-text">User-friendly label</div>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Barcode Prefix</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. W"
                        maxLength={1}
                        value={form.barcode_prefix}
                        onChange={(e) => setForm({ ...form, barcode_prefix: e.target.value })}
                        disabled={submitting}
                      />
                      <div className="form-text">Single character prefix (optional)</div>
                    </div>
                  </div>
                  <div className="mt-3 d-flex gap-2">
                    <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                      {submitting ? 'Saving...' : editingStage ? 'Update Stage' : 'Create Stage'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={resetForm}
                      disabled={submitting}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="table-responsive">
            <table className="table table-striped table-hover mb-0">
              <thead className="table-light">
                <tr>
                  <th>Internal Name</th>
                  <th>Display Name</th>
                  <th>Barcode Prefix</th>
                  <th style={{ width: '150px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="4" className="text-center py-4">
                      <span className="spinner-border spinner-border-sm me-2"></span>Loading...
                    </td>
                  </tr>
                ) : stages.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-4 text-muted">
                      No stages found
                    </td>
                  </tr>
                ) : (
                  paginatedStages.map((stage) => (
                    <tr key={stage.id}>
                      <td>
                        <span className="badge bg-soft-primary">{stage.name}</span>
                      </td>
                      <td>{stage.display_name}</td>
                      <td>
                        <code>{stage.barcode_prefix || '—'}</code>
                      </td>
                      <td>
                        {deleteConfirm === stage.id ? (
                          <div className="d-flex gap-1">
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDelete(stage)}
                            >
                              Confirm
                            </button>
                            <button
                              className="btn btn-outline-secondary btn-sm"
                              onClick={() => setDeleteConfirm(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="d-flex gap-1">
                            <button
                              className="btn btn-outline-primary btn-sm"
                              onClick={() => handleEdit(stage)}
                            >
                              <i className="ti ti-edit"></i>
                            </button>
                            <button
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => setDeleteConfirm(stage.id)}
                            >
                              <i className="ti ti-trash"></i>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {stages.length > 0 && (
            <Pagination
              page={page}
              pageSize={pageSize}
              totalCount={stages.length}
              onPageChange={setPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setPage(1);
              }}
              pageSizeOptions={[5, 10, 20, 50]}
              itemLabel="stages"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default StageManagement;
