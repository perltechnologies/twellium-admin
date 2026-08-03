import React, { useState, useEffect } from 'react';
import { logisticsApi } from '../../api/logistics';
import toast from 'react-hot-toast';

const DriverList = () => {
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingDriver, setEditingDriver] = useState(null);
  const [formData, setFormData] = useState({ name: '', license_number: '', phone_number: '', current_vehicle: '' });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    fetchDrivers();
  }, [page, search]);

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchDrivers = async () => {
    setLoading(true);
    try {
      const res = await logisticsApi.getDrivers({ search, page });
      setDrivers(res.data.data || []);
      setTotalCount(res.data.count || 0);
      setHasNext(!!res.data.next);
      setHasPrevious(!!res.data.previous);
    } catch (error) {
      toast.error('Failed to load drivers');
    } finally {
      setLoading(false);
    }
  };

  const fetchVehicles = async () => {
    try {
      const res = await logisticsApi.getVehicles({ page_size: 100 });
      setVehicles(res.data.data || []);
    } catch (error) {
      toast.error('Failed to load vehicles');
    }
  };

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const openAddModal = () => {
    setEditingDriver(null);
    setFormData({ name: '', license_number: '', phone_number: '', current_vehicle: '' });
    setShowModal(true);
  };

  const openEditModal = (driver) => {
    setEditingDriver(driver);
    setFormData({
      name: driver.name || '',
      license_number: driver.license_number || '',
      phone_number: driver.phone_number || '',
      current_vehicle: driver.current_vehicle || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.license_number || !formData.phone_number) {
      toast.error('Please fill in all required fields');
      return;
    }
    setLoading(true);
    try {
      const payload = { ...formData };
      if (!payload.current_vehicle) delete payload.current_vehicle;
      if (editingDriver) {
        await logisticsApi.updateDriver(editingDriver.id, payload);
        toast.success('Driver updated successfully');
      } else {
        await logisticsApi.createDriver(payload);
        toast.success('Driver created successfully');
      }
      setShowModal(false);
      fetchDrivers();
    } catch (error) {
      toast.error(editingDriver ? 'Failed to update driver' : 'Failed to create driver');
    } finally {
      setLoading(false);
    }
  };

  const openDeleteModal = (driver) => {
    setDeleteTarget(driver);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setLoading(true);
    try {
      await logisticsApi.deleteDriver(deleteTarget.id);
      toast.success('Driver deleted successfully');
      setShowDeleteModal(false);
      setDeleteTarget(null);
      fetchDrivers();
    } catch (error) {
      toast.error('Failed to delete driver');
    } finally {
      setLoading(false);
    }
  };

  const getVehiclePlate = (vehicleId) => {
    const v = vehicles.find((veh) => veh.id === vehicleId);
    return v ? v.plate_number : '—';
  };

  return (
    <div className="container-fluid">
      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between">
              <h5 className="card-title mb-0">
                <i className="ti ti-users me-2"></i>Drivers
              </h5>
              <button className="btn btn-primary" onClick={openAddModal}>
                <i className="ti ti-plus me-1"></i>Add Driver
              </button>
            </div>
            <div className="card-body">
              <div className="row mb-3">
                <div className="col-md-4">
                  <div className="input-group">
                    <span className="input-group-text"><i className="ti ti-search"></i></span>
                    <input type="text" className="form-control" placeholder="Search drivers..." value={search} onChange={handleSearchChange} />
                  </div>
                </div>
              </div>

              <div className="table-responsive">
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>License Number</th>
                      <th>Phone</th>
                      <th>Vehicle</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr><td colSpan="5" className="text-center py-4"><span className="spinner-border spinner-border-sm me-2"></span>Loading...</td></tr>
                    )}
                    {!loading && drivers.length === 0 && (
                      <tr><td colSpan="5" className="text-center py-4 text-muted">No drivers found.</td></tr>
                    )}
                    {!loading && drivers.map((driver) => (
                      <tr key={driver.id}>
                        <td><i className="ti ti-user me-1"></i>{driver.name}</td>
                        <td>{driver.license_number}</td>
                        <td>{driver.phone_number}</td>
                        <td>{driver.current_vehicle ? getVehiclePlate(driver.current_vehicle) : '—'}</td>
                        <td>
                          <button className="btn btn-sm btn-outline-primary me-1" onClick={() => openEditModal(driver)}>
                            <i className="ti ti-edit"></i>
                          </button>
                          <button className="btn btn-sm btn-outline-danger" onClick={() => openDeleteModal(driver)}>
                            <i className="ti ti-trash"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="d-flex align-items-center justify-content-between">
                <span className="text-muted">Total: {totalCount} driver(s)</span>
                <nav>
                  <ul className="pagination mb-0">
                    <li className={`page-item ${!hasPrevious ? 'disabled' : ''}`}>
                      <button className="page-link" onClick={() => setPage(page - 1)} disabled={!hasPrevious}>
                        <i className="ti ti-chevron-left"></i>
                      </button>
                    </li>
                    <li className="page-item active"><span className="page-link">{page}</span></li>
                    <li className={`page-item ${!hasNext ? 'disabled' : ''}`}>
                      <button className="page-link" onClick={() => setPage(page + 1)} disabled={!hasNext}>
                        <i className="ti ti-chevron-right"></i>
                      </button>
                    </li>
                  </ul>
                </nav>
              </div>
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
                  <i className={`ti ${editingDriver ? 'ti-edit' : 'ti-plus'} me-2`}></i>
                  {editingDriver ? 'Edit Driver' : 'Add Driver'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Name</label>
                    <input type="text" className="form-control" placeholder="Enter name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">License Number</label>
                    <input type="text" className="form-control" placeholder="Enter license number" value={formData.license_number} onChange={(e) => setFormData({ ...formData, license_number: e.target.value })} required />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Phone Number</label>
                    <input type="text" className="form-control" placeholder="Enter phone number" value={formData.phone_number} onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })} required />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Vehicle (optional)</label>
                    <select className="form-select" value={formData.current_vehicle} onChange={(e) => setFormData({ ...formData, current_vehicle: e.target.value })}>
                      <option value="">No vehicle assigned</option>
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>{v.plate_number}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? <span className="spinner-border spinner-border-sm me-1"></span> : <i className="ti ti-check me-1"></i>}
                    {editingDriver ? 'Update' : 'Create'}
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
              <div className="modal-body">Are you sure you want to delete driver <strong>{deleteTarget?.name}</strong>?</div>
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

export default DriverList;
