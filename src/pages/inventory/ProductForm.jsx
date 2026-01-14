import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { Button, Input, Card } from '../../components/ui';
import { inventoryApi } from '../../api/inventory';

const ProductForm = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = !!id;

    const [formData, setFormData] = useState({
        sku_code: '',
        name: '',
        size: '',
        target_speed_bph: ''
    });

    const [submitting, setSubmitting] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isEditMode) {
            setLoading(true);
            const fetchProduct = async () => {
                try {
                    // Fetch list and find. Assuming standard pagination/wrapping
                    const res = await inventoryApi.getProducts();
                    let items = [];
                    if (res.data.results) items = res.data.results;
                    else if (res.data.data && res.data.data.results) items = res.data.data.results;
                    else if (res.data.data) items = res.data.data;
                    else if (Array.isArray(res.data)) items = res.data;

                    const item = items.find(i => i.id === parseInt(id));
                    if (item) {
                        setFormData({
                            sku_code: item.sku_code,
                            name: item.name,
                            size: item.size,
                            name: item.name,
                            size: item.size,
                            target_speed_bph: item.target_speed_bph,
                            standard_density: item.standard_density
                        });
                    }
                } catch (err) {
                    console.error("Failed to load product", err);
                } finally {
                    setLoading(false);
                }
            };
            fetchProduct();
        }
    }, [id, isEditMode]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload = { ...formData };
            // Ensure target speed is integer
            if (payload.target_speed_bph) payload.target_speed_bph = parseInt(payload.target_speed_bph);

            if (isEditMode) {
                await inventoryApi.updateProduct(id, payload);
            } else {
                await inventoryApi.createProduct(payload);
            }
            navigate('/dashboard/inventory/products');
        } catch (err) {
            console.error("Failed to save product", err);
            alert("Failed to save product. Check console for details.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Loading product details...</div>;

    return (
        <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => navigate('/dashboard/inventory/products')}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                </Button>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {isEditMode ? 'Edit Product' : 'Create New Product'}
                </h1>
            </div>

            <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 gap-6">

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Input
                                label="SKU Code"
                                name="sku_code"
                                value={formData.sku_code}
                                onChange={handleChange}
                                placeholder="e.g. VERNA_500"
                                required
                            />
                            <Input
                                label="Product Name"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="e.g. Verna 500ml"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Input
                                label="Size"
                                name="size"
                                value={formData.size}
                                onChange={handleChange}
                                placeholder="e.g. 500ml"
                                required
                            />
                            <Input
                                label="Target Speed (BPH)"
                                type="number"
                                name="target_speed_bph"
                                value={formData.target_speed_bph}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Input
                                label="Standard Density"
                                type="number"
                                step="0.01"
                                name="standard_density"
                                value={formData.standard_density || ''}
                                onChange={handleChange}
                                placeholder="10.0"
                            />
                        </div>

                    </div>

                    <div className="flex justify-end gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => navigate('/dashboard/inventory/products')}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-500 text-white min-w-[120px]"
                            disabled={submitting}
                        >
                            {submitting ? <span className="animate-spin mr-2">⟳</span> : <Save className="h-4 w-4 mr-2" />}
                            {isEditMode ? 'Update Product' : 'Create Product'}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};

export default ProductForm;
