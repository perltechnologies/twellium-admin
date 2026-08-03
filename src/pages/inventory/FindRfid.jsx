import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { inventoryApi } from '../../api/inventory';
import { toast } from 'react-hot-toast';

const FindRfid = () => {
  const navigate = useNavigate();
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!barcode.trim()) {
      toast.error('Please enter a barcode');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const response = await inventoryApi.getRfidByBarcode(barcode.trim());
      setResult(response.data.data);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'No RFID found for this barcode');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid">
      <div className="row">
        <div className="col-lg-8 col-xl-6">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">
                <i className="ti ti-nfc me-2"></i>
                Find RFID by Barcode
              </h5>
            </div>
            <div className="card-body">
              <form onSubmit={handleSearch}>
                <div className="row g-3 align-items-end">
                  <div className="col">
                    <label className="form-label">Barcode</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Enter barcode..."
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                    />
                  </div>
                  <div className="col-auto">
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={loading}
                    >
                      <i className="ti ti-search me-1"></i>
                      {loading ? 'Searching...' : 'Search'}
                    </button>
                  </div>
                </div>
              </form>

              {result && (
                <div className="mt-4">
                  <div className="table-responsive">
                    <table className="table table-striped">
                      <tbody>
                        <tr>
                          <th style={{ width: '40%' }}>RFID Number</th>
                          <td>{result.rfid_number || '—'}</td>
                        </tr>
                        <tr>
                          <th>Product</th>
                          <td>{result.product_name || '—'}</td>
                        </tr>
                        <tr>
                          <th>Status</th>
                          <td>
                            <span className="badge bg-soft-info">
                              {result.current_status || '—'}
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <th>Internal ID</th>
                          <td>{result.internal_id || '—'}</td>
                        </tr>
                        <tr>
                          <th>Quantity</th>
                          <td>{result.quantity ?? '—'}</td>
                        </tr>
                        <tr>
                          <th>Current Barcode</th>
                          <td>{result.current_barcode || '—'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {result.current_barcode && (
                    <button
                      className="btn btn-outline-primary mt-2"
                      onClick={() =>
                        navigate(`/post-production/lookup?value=${result.current_barcode}`)
                      }
                    >
                      <i className="ti ti-external-link me-1"></i>
                      View Full Lookup
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FindRfid;
