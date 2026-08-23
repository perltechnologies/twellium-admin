import React, { useState, useEffect } from 'react';
import { logisticsApi } from '../../api/logistics';
import { Pagination } from '../../components/ui/Pagination';
import toast from 'react-hot-toast';

const VehicleList = () => {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  const [showModal, setShowModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [formData, setFormData] = useState({ plate_number: '', capacity: '' });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    fetchVehicles();
  }, [page, pageSize, search]);

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const res = await logisticsApi.getVehicles({ search, page, page_size: pageSize });
      const envelope = res.data?.data ?? res.data ?? {};
      const list = Array.isArray(envelope) ? envelope : (envelope.results || envelope.data || []);
      setVehicles(list);
      setTotalCount(envelope.count ?? res.data?.count ?? list.length);
    } catch (error) {
      toast.error('Failed to load vehicles');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const openAddModal = () => {
    setEditingVehicle(null);
    setFormData({ plate_number: '', capacity: '' });
    setShowModal(true);
  };

  const openEditModal = (vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({ plate_number: vehicle.plate_number, capacity: vehicle.capacity });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.plate_number || !formData.capacity) {
      toast.error('Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      if (editingVehicle) {
        await logisticsApi.updateVehicle(editingVehicle.id, formData);
        toast.success('Vehicle updated successfully');
      } else {
        await logisticsApi.createVehicle(formData);
        toast.success('Vehicle created successfully');
      }
      setShowModal(false);
      fetchVehicles();
    } catch (error) {
      toast.error(editingVehicle ? 'Failed to update vehicle' : 'Failed to create vehicle');
    } finally {
      setLoading(false);
    }
  };

  const openDeleteModal = (vehicle) => {
    setDeleteTarget(vehicle);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setLoading(true);
    try {
      await logisticsApi.deleteVehicle(deleteTarget.id);
      toast.success('Vehicle deleted successfully');
      setShowDeleteModal(false);
      setDeleteTarget(null);
      fetchVehicles();
    } catch (error) {
      toast.error('Failed to delete vehicle');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid">
      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between">
              <h5 className="card-title mb-0">
                <i className="ti ti-truck me-2"></i>Vehicles
              </h5>
              <button className="btn btn-primary" onClick={openAddModal}>
                <i className="ti ti-plus me-1"></i>Add Vehicle
              </button>
            </div>
            <div className="card-body">
              <div className="row mb-3">
                <div className="col-md-4">
                  <div className="input-group">
                    <span className="input-group-text"><i className="ti ti-search"></i></span>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Search vehicles..."
                      value={search}
                      onChange={handleSearchChange}
                    />
                  </div>
                </div>
              </div>

              <div className="table-responsive">
                <table className="table table-striped table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Plate Number</th>
                      <th>Capacity (tons)</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr><td colSpan="4" className="text-center py-4"><span className="spinner-border spinner-border-sm me-2"></span>Loading...</td></tr>
                    )}
                    {!loading && vehicles.length === 0 && (
                      <tr><td colSpan="4" className="text-center py-4 text-muted">No vehicles found.</td></tr>
                    )}
                    {!loading && vehicles.map((vehicle) => (
                      <tr key={vehicle.id}>
                        <td><i className="ti ti-truck me-1"></i>{vehicle.plate_number || vehicle.vehicle_number || vehicle.name || '—'}</td>
                        <td>{vehicle.capacity || '—'}</td>
                        <td>
                          <span className={`badge ${vehicle.status === 'ACTIVE' || vehicle.is_active ? 'bg-soft-success text-success' : 'bg-soft-secondary text-secondary'}`}>
                            {vehicle.status || 'Active'}
                          </span>
                        </td>
                        <td>
                          <button className="btn btn-sm btn-outline-primary me-1" onClick={() => openEditModal(vehicle)}>
                            <i className="ti ti-edit"></i>
                          </button>
                          <button className="btn btn-sm btn-outline-danger" onClick={() => openDeleteModal(vehicle)}>
                            <i className="ti ti-trash"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Pagination
                page={page}
                pageSize={pageSize}
                totalCount={totalCount}
                onPageChange={setPage}
                onPageSizeChange={(newSize) => {
                  setPageSize(newSize);
                  setPage(1);
                }}
                pageSizeOptions={[5, 10, 20, 50]}
                itemLabel="vehicles"
              />
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className={`ti ${editingVehicle ? 'ti-edit' : 'ti-plus'} me-2`}></i>
                  {editingVehicle ? 'Edit Vehicle' : 'Add Vehicle'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Plate Number</label>
                    <input type="text" className="form-control" placeholder="Enter plate number" value={formData.plate_number} onChange={(e) => setFormData({ ...formData, plate_number: e.target.value })} required />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Capacity (tons)</label>
                    <input type="number" className="form-control" placeholder="Enter capacity" value={formData.capacity} onChange={(e) => setFormData({ ...formData, capacity: e.target.value })} required />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? <span className="spinner-border spinner-border-sm me-1"></span> : <i className="ti ti-check me-1"></i>}
                    {editingVehicle ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Confirm Delete</h5>
                <button type="button" className="btn-close" onClick={() => setShowDeleteModal(false)}></button>
              </div>
              <div className="modal-body">Are you sure you want to delete vehicle <strong>{deleteTarget?.plate_number}</strong>?</div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                <button className="btn btn-danger" onClick={confirmDelete}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VehicleList;
