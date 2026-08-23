import React, { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { inventoryApi } from '../../api/inventory';
import { productionApi } from '../../api/production';
import { formatAndSortPets } from '../../utils/petUtils';
import BarcodeLabel from '../../components/inventory/BarcodeLabel';
import { toast } from 'react-hot-toast';

const ProductionMode = () => {
    const [activeTab, setActiveTab] = useState('output');
    const [products, setProducts] = useState([]);
    const [pets, setPets] = useState([]);
    const [loading, setLoading] = useState(false);

    // Tab A: Output Generation State
    const [outputData, setOutputData] = useState({
        product_id: '',
        pet_id: '',
        line_speed_id: '',
        quantity: 1,
        unit_type: 'PALLET'
    });
    const [generatedBarcode, setGeneratedBarcode] = useState(null);
    const labelRef = useRef(null);

    const handlePrint = useReactToPrint({
        contentRef: labelRef,
        documentTitle: `Label_${generatedBarcode?.barcode || 'unit'}`,
    });

    // Tab B: RFID Linking State
    const [rfidData, setRfidData] = useState({
        barcode: '',
        rfid_number: ''
    });
    const [rfidSuccess, setRfidSuccess] = useState(null);

    useEffect(() => {
        const loadLookups = async () => {
            try {
                const [productsRes, petsRes] = await Promise.all([
                    inventoryApi.getProducts({ page_size: 100 }),
                    productionApi.getPets({ page_size: 100 })
                ]);
                const prodList = productsRes?.data?.data?.data ?? productsRes?.data?.data ?? productsRes?.data?.results ?? [];
                setProducts(Array.isArray(prodList) ? prodList : prodList.results || []);
                const allPets = formatAndSortPets(petsRes);
                setPets(allPets);
            } catch (err) {
                console.error("Failed to load lookups", err);
                toast.error("Failed to load form data");
            }
        };
        loadLookups();
    }, []);

    // Get available line speeds for selected PET
    const selectedPet = pets.find(p => p.id === Number(outputData.pet_id));
    const lineSpeeds = selectedPet?.line_speeds || [];

    const handleGenerateLabel = async (e) => {
        e.preventDefault();
        if (!outputData.product_id || !outputData.pet_id || !outputData.line_speed_id || !outputData.quantity) {
            toast.error("Please fill all required fields");
            return;
        }
        setLoading(true);
        setGeneratedBarcode(null);
        try {
            const res = await inventoryApi.createHandlingUnit({
                product_id: Number(outputData.product_id),
                pet_id: Number(outputData.pet_id),
                line_speed_id: Number(outputData.line_speed_id),
                quantity: Number(outputData.quantity),
                unit_type: 'PALLET'
            });
            const unit = res.data.data;
            const labelData = {
                barcode: unit.label?.barcode || unit.actual_production_code,
                product_name: products.find(p => p.id === Number(outputData.product_id))?.name || '',
                pet_name: selectedPet?.pet_name || '',
                quantity: outputData.quantity,
                stage: unit.label?.stage || 'PRODUCTION',
                timestamp: new Date()
            };
            setGeneratedBarcode(labelData);
            toast.success("Label generated successfully");
        } catch (err) {
            console.error(err);
            const message = err.response?.data?.message || "Failed to generate label";
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    const handleLinkRfid = async (e) => {
        e.preventDefault();
        if (!rfidData.barcode.trim() || !rfidData.rfid_number.trim()) {
            toast.error("Please provide both barcode and RFID number");
            return;
        }
        setLoading(true);
        setRfidSuccess(null);
        try {
            const res = await inventoryApi.linkRfid({
                barcode: rfidData.barcode.trim(),
                rfid_number: rfidData.rfid_number.trim()
            });
            setRfidSuccess(res.data.data);
            toast.success("RFID linked successfully");
            setRfidData({ barcode: '', rfid_number: '' });
        } catch (err) {
            console.error(err);
            const message = err.response?.data?.message || "Failed to link RFID";
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container-fluid">
            {/* Page Header */}
            <div className="row mb-4">
                <div className="col-12">
                    <div className="d-flex align-items-center gap-3 mb-2">
                        <div className="bg-light rounded p-2">
                            <i className="ti ti-barcode fs-4 text-primary"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Production Mode</h4>
                            <p className="text-muted mb-0 fs-7">Generate labels and link RFID tags</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="row">
                <div className="col-12">
                    <ul className="nav nav-tabs mb-3">
                        <li className="nav-item">
                            <button
                                className={`nav-link ${activeTab === 'output' ? 'active' : ''}`}
                                onClick={() => setActiveTab('output')}
                            >
                                <i className="ti ti-printer me-2"></i>
                                Generate Output
                            </button>
                        </li>
                        <li className="nav-item">
                            <button
                                className={`nav-link ${activeTab === 'rfid' ? 'active' : ''}`}
                                onClick={() => setActiveTab('rfid')}
                            >
                                <i className="ti ti-nfc me-2"></i>
                                Link RFID
                            </button>
                        </li>
                    </ul>
                </div>
            </div>

            {/* Tab A: Generate Output */}
            {activeTab === 'output' && (
                <div className="row">
                    <div className="col-md-7">
                        <div className="card">
                            <div className="card-header">
                                <h5 className="card-title mb-0">
                                    <i className="ti ti-file-barcode me-2"></i>
                                    Generate Label
                                </h5>
                            </div>
                            <div className="card-body">
                                <form onSubmit={handleGenerateLabel}>
                                    <div className="row g-3">
                                        <div className="col-md-6">
                                            <label className="form-label">Product</label>
                                            <select
                                                className="form-select"
                                                value={outputData.product_id}
                                                onChange={(e) => setOutputData({ ...outputData, product_id: e.target.value })}
                                                required
                                            >
                                                <option value="">Select Product</option>
                                                {products.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label">PET Line</label>
                                            <select
                                                className="form-select"
                                                value={outputData.pet_id}
                                                onChange={(e) => setOutputData({
                                                    ...outputData,
                                                    pet_id: e.target.value,
                                                    line_speed_id: ''
                                                })}
                                                required
                                            >
                                                <option value="">Select PET Line</option>
                                                {pets.map(p => (
                                                    <option key={p.id} value={p.id}>{p.pet_name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label">Line Speed</label>
                                            <select
                                                className="form-select"
                                                value={outputData.line_speed_id}
                                                onChange={(e) => setOutputData({ ...outputData, line_speed_id: e.target.value })}
                                                disabled={!outputData.pet_id}
                                                required
                                            >
                                                <option value="">Select Line Speed</option>
                                                {lineSpeeds.map(ls => (
                                                    <option key={ls.id} value={ls.id}>
                                                        {ls.name} ({ls.speed})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label">Quantity</label>
                                            <input
                                                type="number"
                                                className="form-control"
                                                value={outputData.quantity}
                                                onChange={(e) => setOutputData({ ...outputData, quantity: e.target.value })}
                                                min="1"
                                                required
                                            />
                                        </div>
                                        <div className="col-12">
                                            <button
                                                type="submit"
                                                className="btn btn-primary w-100"
                                                disabled={loading}
                                            >
                                                {loading ? (
                                                    <>
                                                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                                        Generating...
                                                    </>
                                                ) : (
                                                    <>
                                                        <i className="ti ti-printer me-2"></i>
                                                        Generate Label
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>

                    <div className="col-md-5">
                        {generatedBarcode ? (
                            <div className="card border-success">
                                <div className="card-header bg-soft-success">
                                    <h5 className="card-title mb-0 text-success">
                                        <i className="ti ti-circle-check me-2"></i>
                                        Label Generated
                                    </h5>
                                </div>
                                <div className="card-body text-center">
                                    <div ref={labelRef}>
                                        <BarcodeLabel data={generatedBarcode} />
                                    </div>
                                    <button
                                        className="btn btn-outline-secondary mt-3 w-100"
                                        onClick={handlePrint}
                                    >
                                        <i className="ti ti-printer me-2"></i>
                                        Print Label
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="card">
                                <div className="card-body text-center py-5">
                                    <i className="ti ti-barcode fs-1 text-muted mb-3 d-block"></i>
                                    <p className="text-muted mb-0">Generated label will appear here</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Tab B: Link RFID */}
            {activeTab === 'rfid' && (
                <div className="row">
                    <div className="col-md-7">
                        <div className="card">
                            <div className="card-header">
                                <h5 className="card-title mb-0">
                                    <i className="ti ti-nfc me-2"></i>
                                    Link RFID to Barcode
                                </h5>
                            </div>
                            <div className="card-body">
                                <form onSubmit={handleLinkRfid}>
                                    <div className="row g-3">
                                        <div className="col-12">
                                            <label className="form-label">Barcode</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="Scan or enter barcode"
                                                value={rfidData.barcode}
                                                onChange={(e) => setRfidData({ ...rfidData, barcode: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="col-12">
                                            <label className="form-label">RFID Number</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="Scan or enter RFID tag number"
                                                value={rfidData.rfid_number}
                                                onChange={(e) => setRfidData({ ...rfidData, rfid_number: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="col-12">
                                            <button
                                                type="submit"
                                                className="btn btn-primary w-100"
                                                disabled={loading}
                                            >
                                                {loading ? (
                                                    <>
                                                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                                        Linking...
                                                    </>
                                                ) : (
                                                    <>
                                                        <i className="ti ti-link me-2"></i>
                                                        Link RFID
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>

                    <div className="col-md-5">
                        {rfidSuccess ? (
                            <div className="card border-success">
                                <div className="card-header bg-soft-success">
                                    <h5 className="card-title mb-0 text-success">
                                        <i className="ti ti-circle-check me-2"></i>
                                        RFID Linked
                                    </h5>
                                </div>
                                <div className="card-body">
                                    <div className="alert alert-success">
                                        <div className="mb-2">
                                            <strong>Barcode:</strong>
                                            <span className="ms-2 font-monospace">{rfidSuccess.barcode}</span>
                                        </div>
                                        <div>
                                            <strong>RFID:</strong>
                                            <span className="ms-2 font-monospace">{rfidSuccess.rfid_number}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="card">
                                <div className="card-body text-center py-5">
                                    <i className="ti ti-nfc fs-1 text-muted mb-3 d-block"></i>
                                    <p className="text-muted mb-0">Linked pair will appear here</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductionMode;
