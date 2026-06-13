import React, { useState, useEffect } from 'react';
import { inventoryApi } from '../../api/inventory';
import { productionApi } from '../../api/production';
import { Printer, Package, CheckCircle2 } from 'lucide-react';

const Production = () => {
    const [formData, setFormData] = useState({
        pet_id: '',
        product_id: '',
        quantity: '',
        unit_type: 'PALLET'
    });


    const [products, setProducts] = useState([]);
    const [pets, setPets] = useState([]);

    const [loading, setLoading] = useState(false);
    const [generatedLabel, setGeneratedLabel] = useState(null);
    const [error, setError] = useState(null);


    useEffect(() => {
        const fetchProducts = async () => {
            try {

                const response = await inventoryApi.getProducts({ page: 1, page_size: 100 });
                console.log("Fetching Products Response:", response);


                let productList = [];
                if (Array.isArray(response.data)) {
                    productList = response.data;
                } else if (response.data && Array.isArray(response.data.results)) {
                    productList = response.data.results;
                } else if (response.data && Array.isArray(response.data.data)) {

                    productList = response.data.data;
                }

                console.log("Extracted Product List:", productList);

                setProducts(productList.map(p => ({ label: p.name, value: p.id })));
            } catch (err) {
                console.error("Failed to fetch products", err);
            }
        };
        fetchProducts();
    }, []);

    // Fetch pets
    useEffect(() => {
        const fetchPets = async () => {
            try {
                const response = await productionApi.getPets({ page: 1, page_size: 100 });
                console.log("Fetching Pets Response:", response);

                let petList = [];
                if (Array.isArray(response.data)) {
                    petList = response.data;
                } else if (response.data && Array.isArray(response.data.results)) {
                    petList = response.data.results;
                } else if (response.data && Array.isArray(response.data.data)) {
                    petList = response.data.data;
                }

                console.log("Extracted Pet List:", petList);

                setPets(petList.map(p => ({ label: p.pet_name || p.name, value: p.id })));
            } catch (err) {
                console.error("Failed to fetch pets", err);
            }
        };
        fetchPets();
    }, []);


    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.product_id) {
            setError("Please select a valid product.");
            return;
        }
        if (!formData.pet_id) {
            setError("Please select a valid pet/line.");
            return;
        }

        setLoading(true);
        setError(null);
        setGeneratedLabel(null);

        try {
            const payload = {
                product_id: formData.product_id,
                quantity: formData.quantity,
                unit_type: 'PALLET',
                pet_id: formData.pet_id
            };

            const response = await inventoryApi.createHandlingUnit(payload);

            if (response.data && response.data.data && response.data.data.label) {
                setGeneratedLabel(response.data.data);
            } else {
                setGeneratedLabel(response.data);
            }

        } catch (err) {
            console.error("Creation failed", err);
            setError(err.response?.data?.message || "Failed to create unit. Please check input.");
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        alert(`Printing Label: ${generatedLabel?.label?.barcode}`);
    };

    const handleReset = () => {
        setGeneratedLabel(null);
        setFormData(prev => ({ ...prev, quantity: '' }));
    };


    const getPetName = () => pets.find(p => String(p.value) === String(formData.pet_id))?.label || '';
    const getProductName = () => products.find(p => String(p.value) === String(formData.product_id))?.label || '';

    return (
        <div className="container-fluid p-0">
            <div className="row g-4">
                <div className="col-12 col-xl-6">
                    <div className="card h-100">
                        <div className="card-header bg-soft-primary">
                            <h5 className="mb-1 text-primary d-flex align-items-center gap-2">
                                <Package size={18} /> Create Unit
                            </h5>
                            <small className="text-muted">Enter production details to generate a tracking label.</small>
                        </div>
                        <form onSubmit={handleSubmit} className="card-body d-flex flex-column gap-3">
                            <div>
                                <label className="form-label">Pet / Line <span className="text-danger">*</span></label>
                                <select
                                    name="pet_id"
                                    value={formData.pet_id}
                                    onChange={handleChange}
                                    className="form-select"
                                    required
                                >
                                    <option value="">Select PET / Line</option>
                                    {pets.map((pet) => (
                                        <option key={pet.value} value={pet.value}>{pet.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="form-label">Product <span className="text-danger">*</span></label>
                                <select
                                    name="product_id"
                                    value={formData.product_id}
                                    onChange={handleChange}
                                    className="form-select"
                                    required
                                >
                                    <option value="">Select Product</option>
                                    {products.map((product) => (
                                        <option key={product.value} value={product.value}>{product.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="form-label">Quantity <span className="text-danger">*</span></label>
                                <input
                                    name="quantity"
                                    type="number"
                                    value={formData.quantity}
                                    onChange={handleChange}
                                    className="form-control"
                                    placeholder="Enter quantity..."
                                    required
                                />
                            </div>

                            {error && (
                                <div className="alert alert-danger mb-0" role="alert">
                                    {error}
                                </div>
                            )}

                            <div className="mt-auto pt-2">
                                <button
                                    type="submit"
                                    className="btn btn-primary w-100"
                                    disabled={loading || !formData.product_id || !formData.pet_id}
                                >
                                    {loading && <span className="spinner-border spinner-border-sm me-2"></span>}
                                    Generate Label
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                <div className="col-12 col-xl-6">
                    <div className="card h-100">
                        <div className="card-header bg-soft-success">
                            <h5 className="mb-1 text-success d-flex align-items-center gap-2">
                                <Printer size={18} /> Generated Label
                            </h5>
                            <small className="text-muted">Review label details before printing.</small>
                        </div>
                        <div className="card-body d-flex flex-column justify-content-center">
                            {generatedLabel ? (
                                <div className="text-center">
                                    <div className="d-flex justify-content-center mb-3">
                                        <div className="rounded-circle bg-soft-success text-success d-flex align-items-center justify-content-center" style={{ width: 64, height: 64 }}>
                                            <CheckCircle2 size={30} />
                                        </div>
                                    </div>
                                    <h3 className="mb-1">{generatedLabel.label?.barcode || 'N/A'}</h3>
                                    <p className="text-muted text-uppercase small mb-4">{generatedLabel.label?.stage || 'PRODUCTION'}</p>

                                    <div className="card bg-light border-0 mb-4">
                                        <div className="card-body py-3">
                                            <div className="d-flex justify-content-between py-1">
                                                <span className="text-muted">Production Code</span>
                                                <span className="fw-semibold">{generatedLabel.actual_production_code || 'N/A'}</span>
                                            </div>
                                            <div className="d-flex justify-content-between py-1">
                                                <span className="text-muted">Date</span>
                                                <span className="fw-semibold">{new Date().toLocaleDateString()}</span>
                                            </div>
                                            <div className="d-flex justify-content-between py-1">
                                                <span className="text-muted">Line</span>
                                                <span className="fw-semibold">{getPetName() || 'N/A'}</span>
                                            </div>
                                            <div className="d-flex justify-content-between py-1">
                                                <span className="text-muted">Product</span>
                                                <span className="fw-semibold">{getProductName() || 'N/A'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="d-grid d-sm-flex gap-2 justify-content-center">
                                        <button type="button" onClick={handleReset} className="btn btn-outline-secondary">
                                            New Unit
                                        </button>
                                        <button type="button" onClick={handlePrint} className="btn btn-success">
                                            <Printer size={16} className="me-2" />
                                            Print Label
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center text-muted py-5">
                                    <Printer size={42} className="mb-3 opacity-50" />
                                    <h6 className="mb-2">No Label Generated</h6>
                                    <p className="mb-0">Fill out the production details to generate a new unit barcode.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Production;
