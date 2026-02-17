import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Select } from '../../components/ui';
import { inventoryApi } from '../../api/inventory';
import { productionApi } from '../../api/production';
import { Printer, Package, ChevronRight, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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


    const getPetName = () => pets.find(p => p.value == formData.pet_id)?.label || '';
    const getProductName = () => products.find(p => p.value == formData.product_id)?.label || '';

    return (
        <div className="h-[calc(100vh-140px)] w-full max-w-6xl mx-auto flex flex-col md:flex-row gap-6">

            {/* LEFT COLUMN - INPUT */}
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex-1"
            >
                <Card className="h-full p-6 flex flex-col relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-bl-full -mr-8 -mt-8" />

                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <span className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                                <Package className="w-6 h-6" />
                            </span>
                            Create Unit
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-2">
                            Enter production details to generate a tracking label.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8 flex-1 relative">

                        {}
                        <Select
                            label="Pet / Line"
                            name="pet_id"
                            value={formData.pet_id}
                            onChange={handleChange}
                            options={pets}
                            required
                            className="text-lg py-3"
                        />

                        {}
                        <Select
                            label="Product"
                            name="product_id"
                            value={formData.product_id}
                            onChange={handleChange}
                            options={products}
                            required
                            className="text-lg py-3"
                        />

                        {}
                        <Input
                            label="Quantity"
                            name="quantity"
                            type="number"
                            value={formData.quantity}
                            onChange={handleChange}
                            placeholder="Enter quantity..."
                            required
                            className="text-lg py-3"
                        />

                        {error && (
                            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        <div className="pt-4 mt-auto">
                            <Button
                                type="submit"
                                isLoading={loading}
                                disabled={!formData.product_id || !formData.pet_id}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-lg h-14"
                            >
                                Generate Label <ChevronRight className="w-5 h-5" />
                            </Button>
                        </div>
                    </form>
                </Card>
            </motion.div>

            {}
            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="flex-1"
            >
                <Card className={`h-full p-6 flex flex-col items-center justify-center text-center relative transition-colors duration-500 ${generatedLabel ? 'bg-slate-900 text-white border-slate-800' : 'bg-slate-50 dark:bg-slate-900/50 border-dashed'}`}>

                    <AnimatePresence mode="wait">
                        {generatedLabel ? (
                            <motion.div
                                key="result"
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                className="w-full max-w-md space-y-8"
                            >
                                <div className="w-20 h-20 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-green-500/30">
                                    <Check className="w-10 h-10" />
                                </div>

                                <div>
                                    <h3 className="text-3xl font-bold text-white mb-2">
                                        {generatedLabel.label?.barcode}
                                    </h3>
                                    <p className="text-slate-400 uppercase tracking-widest text-sm">
                                        {generatedLabel.label?.stage || 'PRODUCTION'}
                                    </p>
                                </div>

                                <div className="bg-white/10 p-6 rounded-2xl backdrop-blur-sm border border-white/10 space-y-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">Production Code</span>
                                        <span className="font-mono text-white">{generatedLabel.actual_production_code}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">Date</span>
                                        <span className="text-white">{new Date().toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">Line</span>
                                        <span className="text-white">{getPetName()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">Product</span>
                                        <span className="text-white">{getProductName()}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-4">
                                    <Button
                                        onClick={handleReset}
                                        variant="secondary"
                                        className="w-full border-slate-700 bg-transparent text-white hover:bg-white/10"
                                    >
                                        New Unit
                                    </Button>
                                    <Button
                                        onClick={handlePrint}
                                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                                    >
                                        <Printer className="w-5 h-5" /> Print Label
                                    </Button>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="placeholder"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="text-slate-400 dark:text-slate-600"
                            >
                                <div className="w-32 h-32 mx-auto mb-6 rounded-2xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                                    <Printer className="w-12 h-12 opacity-50" />
                                </div>
                                <h3 className="text-xl font-semibold mb-2">No Label Generated</h3>
                                <p className="max-w-xs mx-auto">
                                    Fill out the production details on the left to generate new unit barcodes.
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Card>
            </motion.div>
        </div>
    );
};

export default Production;
