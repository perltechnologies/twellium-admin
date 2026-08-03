import React, { useState, useEffect } from 'react';
import { inventoryApi } from '../../api/inventory';
import { toast } from 'react-hot-toast';

const StageManagement = () => {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingStage, setEditingStage] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [form, setForm] = useState({ name: '', display_name: '', barcode_prefix: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchStages = async () => {
    setLoading(true);
    try {
      const response = await inventoryApi.getStages();
      const data = response.data;
      setStages(Array.isArray(data) ? data : data.data || []);
    } catch (error) {
      toast.error('Failed to load stages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStages();
  }, []);

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
        name: form.name.toUpperCase().trim(),
        display_name: form.display_name.trim(),
        barcode_prefix: form.barcode_prefix.trim(),
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
      toast.error(error?.response?.data?.message || 'Failed to save stage');
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
      toast.error(error?.response?.data?.message || 'Failed to delete stage');
    }
  };

  return (
    <div className="container-fluid">
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0">
            <i className="ti ti-list-check me-2"></i>
            Stage Management
          </h5>
          {!showForm && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowForm(true)}
            >
              <i className="ti ti-plus me-1"></i>
              Add Stage
            </button>
          )}
        </div>
        <div className="card-body">
          {/* Add/Edit Form */}
          {showForm && (
            <div className="border rounded p-3 mb-4 bg-light">
              <h6 className="mb-3">
                {editingStage ? 'Edit Stage' : 'Add New Stage'}
              </h6>
              <form onSubmit={handleSubmit}>
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label">Name</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="STAGE_NAME"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value.toUpperCase() })}
                    />
                    <small className="text-muted">Uppercase only</small>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Display Name</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Display Name"
                      value={form.display_name}
                      onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label">Barcode Prefix</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="X"
                      maxLength={1}
                      value={form.barcode_prefix}
                      onChange={(e) => setForm({ ...form, barcode_prefix: e.target.value })}
                    />
                    <small className="text-muted">1 character</small>
                  </div>
                  <div className="col-md-2 d-flex align-items-end gap-2">
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={submitting}
                    >
                      {submitting ? 'Saving...' : editingStage ? 'Update' : 'Create'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={resetForm}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Table */}
          <div className="table-responsive">
            <table className="table table-striped">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Display Name</th>
                  <th>Barcode Prefix</th>
                  <th style={{ width: '150px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="4" className="text-center py-4">
                      Loading...
                    </td>
                  </tr>
                ) : stages.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-4 text-muted">
                      No stages found
                    </td>
                  </tr>
                ) : (
                  stages.map((stage) => (
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
        </div>
      </div>
    </div>
  );
};

export default StageManagement;
