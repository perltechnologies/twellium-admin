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
        target_speed_bph: '',
        standard_density: '',
        gv: '',
        dilution_ratio: ''
    });

    const [submitting, setSubmitting] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isEditMode) {
            setLoading(true);
            const fetchProduct = async () => {
                try {

                    const res = await inventoryApi.getProduct(id);
                    const item = res.data.data || res.data; // Handle potential wrapper

                    if (item) {
                        setFormData({
                            sku_code: item.sku_code,
                            name: item.name,
                            size: item.size,
                            target_speed_bph: item.target_speed_bph,
                            standard_density: item.standard_density,
                            gv: item.gv,
                            dilution_ratio: item.dilution_ratio
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

            if (payload.target_speed_bph) payload.target_speed_bph = parseInt(payload.target_speed_bph);
            if (payload.standard_density) payload.standard_density = parseFloat(payload.standard_density);
            if (payload.dilution_ratio) {

                if (typeof payload.dilution_ratio === 'string' && payload.dilution_ratio.endsWith('+')) {
                    payload.dilution_ratio = payload.dilution_ratio + '0';
                }
            }

            if (payload.gv) payload.gv = parseFloat(payload.gv);

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
                                type="number"
                                name="size"
                                value={formData.size}
                                onChange={handleChange}
                                placeholder="500"
                                required
                            />
                            <Input
                                label="Target Speed (BPH)"
                                type="number"
                                name="target_speed_bph"
                                value={formData.target_speed_bph}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <Input
                                label="Standard Density"
                                type="number"
                                step="0.001"
                                name="standard_density"
                                value={formData.standard_density || ''}
                                onChange={handleChange}
                                placeholder="0.4"
                            />
                            <Input
                                label="Dilution Ratio"
                                type="text"
                                inputMode="numeric"
                                name="dilution_ratio"
                                value={formData.dilution_ratio || ''}
                                onChange={(e) => {
                                    let val = e.target.value;


                                    const prevVal = formData.dilution_ratio || '';

                                    if (prevVal.match(/^\d\+$/) && val.match(/^\d$/)) {
                                        setFormData(prev => ({ ...prev, dilution_ratio: '' }));
                                        return;
                                    }


                                    if (prevVal === "" && val.match(/^\d$/)) {
                                        setFormData(prev => ({ ...prev, dilution_ratio: val + '+' }));
                                        return;
                                    }


                                    if (val === '') {
                                        setFormData(prev => ({ ...prev, dilution_ratio: '' }));
                                        return;
                                    }

                                    if (/^\d\+\d*$/.test(val)) {
                                        setFormData(prev => ({ ...prev, dilution_ratio: val }));
                                    }
                                }}
                                placeholder="1+6"
                            />
                            <Input
                                label="GV"
                                type="number"
                                step="0.01"
                                name="gv"
                                value={formData.gv || ''}
                                onChange={handleChange}
                                placeholder="1.2"
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
