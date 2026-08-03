import React, { useState, useEffect } from 'react';
import { logisticsApi } from '../../api/logistics';
import { inventoryApi } from '../../api/inventory';
import toast from 'react-hot-toast';

const LoadingDispatch = () => {
  const [step, setStep] = useState(1);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);

  const [vehicle, setVehicle] = useState('');
  const [driver, setDriver] = useState('');
  const [customer, setCustomer] = useState('');
  const [destination, setDestination] = useState('');

  const [shipment, setShipment] = useState(null);
  const [barcode, setBarcode] = useState('');
  const [scannedUnits, setScannedUnits] = useState([]);

  useEffect(() => {
    fetchDropdownData();
  }, []);

  const fetchDropdownData = async () => {
    try {
      const [vehicleRes, driverRes, customerRes] = await Promise.all([
        logisticsApi.getVehicles({ page_size: 100 }),
        logisticsApi.getDrivers({ page_size: 100 }),
        logisticsApi.getCustomers({ page_size: 100 }),
      ]);
      setVehicles(vehicleRes.data.data || []);
      setDrivers(driverRes.data.data || []);
      setCustomers(customerRes.data.data || []);
    } catch (error) {
      toast.error('Failed to load dropdown data');
    }
  };

  const handleCreateShipment = async (e) => {
    e.preventDefault();
    if (!vehicle || !driver || !customer || !destination) {
      toast.error('Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      const res = await logisticsApi.createShipment({ vehicle, driver, destination, customer });
      setShipment(res.data.data);
      toast.success('Shipment created successfully');
      setStep(2);
    } catch (error) {
      toast.error('Failed to create shipment');
    } finally {
      setLoading(false);
    }
  };

  const handleScanBarcode = async (e) => {
    e.preventDefault();
    if (!barcode.trim()) return;
    setLoading(true);
    try {
      await inventoryApi.scanHandlingUnit({
        scan_values: [barcode.trim()],
        target_stage: 'LOADING',
        shipment_id: shipment.id,
      });
      setScannedUnits([...scannedUnits, barcode.trim()]);
      setBarcode('');
      toast.success('Unit scanned successfully');
    } catch (error) {
      toast.error('Failed to scan unit');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmLoading = () => {
    if (scannedUnits.length === 0) {
      toast.error('Please scan at least one unit');
      return;
    }
    toast.success('Loading confirmed');
    setStep(3);
  };

  const handleDispatch = async () => {
    setLoading(true);
    try {
      await logisticsApi.markDispatched(shipment.id);
      toast.success('Shipment dispatched successfully');
    } catch (error) {
      toast.error('Failed to dispatch shipment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid">
      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">
                <i className="ti ti-truck me-2"></i>Loading &amp; Dispatch
              </h5>
            </div>
            <div className="card-body">
              <div className="row mb-4">
                <div className="col-12">
                  <div className="d-flex align-items-center justify-content-center gap-3">
                    <span className={`badge ${step >= 1 ? 'bg-primary' : 'bg-secondary'} rounded-pill px-3 py-2`}>
                      <i className="ti ti-file-text me-1"></i>1. Shipment Details
                    </span>
                    <i className="ti ti-arrow-right text-muted"></i>
                    <span className={`badge ${step >= 2 ? 'bg-primary' : 'bg-secondary'} rounded-pill px-3 py-2`}>
                      <i className="ti ti-barcode me-1"></i>2. Load Units
                    </span>
                    <i className="ti ti-arrow-right text-muted"></i>
                    <span className={`badge ${step >= 3 ? 'bg-primary' : 'bg-secondary'} rounded-pill px-3 py-2`}>
                      <i className="ti ti-send me-1"></i>3. Dispatch
                    </span>
                  </div>
                </div>
              </div>

              {step === 1 && (
                <form onSubmit={handleCreateShipment}>
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Vehicle</label>
                      <select className="form-select" value={vehicle} onChange={(e) => setVehicle(e.target.value)} required>
                        <option value="">Select Vehicle</option>
                        {vehicles.map((v) => (
                          <option key={v.id} value={v.id}>{v.plate_number} (Capacity: {v.capacity} tons)</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Driver</label>
                      <select className="form-select" value={driver} onChange={(e) => setDriver(e.target.value)} required>
                        <option value="">Select Driver</option>
                        {drivers.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Customer</label>
                      <select className="form-select" value={customer} onChange={(e) => setCustomer(e.target.value)} required>
                        <option value="">Select Customer</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Destination</label>
                      <input type="text" className="form-control" placeholder="Enter destination" value={destination} onChange={(e) => setDestination(e.target.value)} required />
                    </div>
                  </div>
                  <div className="text-end">
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                      {loading ? <span className="spinner-border spinner-border-sm me-1"></span> : <i className="ti ti-plus me-1"></i>}
                      Create Shipment
                    </button>
                  </div>
                </form>
              )}

              {step === 2 && (
                <div>
                  <div className="alert alert-info d-flex align-items-center mb-3">
                    <i className="ti ti-info-circle me-2"></i>
                    Shipment <strong className="ms-1">{shipment?.shipment_code}</strong> created. Scan handling units to load.
                  </div>
                  <form onSubmit={handleScanBarcode} className="mb-3">
                    <div className="row g-2">
                      <div className="col">
                        <input type="text" className="form-control" placeholder="Scan barcode..." value={barcode} onChange={(e) => setBarcode(e.target.value)} autoFocus />
                      </div>
                      <div className="col-auto">
                        <button type="submit" className="btn btn-outline-primary" disabled={loading}>
                          <i className="ti ti-scan me-1"></i>Scan
                        </button>
                      </div>
                    </div>
                  </form>
                  {scannedUnits.length > 0 && (
                    <div className="table-responsive mb-3">
                      <table className="table table-striped">
                        <thead>
                          <tr><th>#</th><th>Barcode</th></tr>
                        </thead>
                        <tbody>
                          {scannedUnits.map((unit, index) => (
                            <tr key={index}><td>{index + 1}</td><td><i className="ti ti-barcode me-1"></i>{unit}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="badge bg-soft-info text-info">
                      <i className="ti ti-package me-1"></i>{scannedUnits.length} unit(s) scanned
                    </span>
                    <button className="btn btn-primary" onClick={handleConfirmLoading} disabled={scannedUnits.length === 0}>
                      <i className="ti ti-check me-1"></i>Confirm Loading
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="text-center py-4">
                  <div className="mb-3">
                    <i className="ti ti-circle-check text-success" style={{ fontSize: '4rem' }}></i>
                  </div>
                  <h4 className="text-success">Loading Complete!</h4>
                  <p className="text-muted mb-1">Shipment <strong>{shipment?.shipment_code}</strong> is ready for dispatch.</p>
                  <p className="text-muted mb-4">{scannedUnits.length} unit(s) loaded successfully.</p>
                  <button className="btn btn-primary btn-lg" onClick={handleDispatch} disabled={loading}>
                    {loading ? <span className="spinner-border spinner-border-sm me-1"></span> : <i className="ti ti-send me-1"></i>}
                    Dispatch Shipment
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingDispatch;
