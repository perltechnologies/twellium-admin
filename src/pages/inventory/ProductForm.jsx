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
                    // Fetch list and find. Assuming standard pagination/wrapping
                    // Fetch single product directly
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
            // Ensure numeric types
            if (payload.target_speed_bph) payload.target_speed_bph = parseInt(payload.target_speed_bph);
            if (payload.standard_density) payload.standard_density = parseFloat(payload.standard_density);
            if (payload.gv) {
                // Ensure it's in the string format we expect, or just pass it as is?
                // Backend expects "1+6".
                // Logic: "when user does not enters anything after the plus sign and submits, automatically assign a 0 after the plus sign"
                if (typeof payload.gv === 'string' && payload.gv.endsWith('+')) {
                    payload.gv = payload.gv + '0';
                }
            } else {
                // If empty, backend might complain if required. Sending null or empty string?
                // existing logic didn't seem to enforce non-empty gv strictly in UI (html `required` wasn't on it in original too).
                // But let's leave it as is if empty.
            }

            // payload.gv is already a string, no need to parseFloat.
            // if (payload.gv) payload.gv = parseFloat(payload.gv); // REMOVED THIS LINE

            if (payload.dilution_ratio) payload.dilution_ratio = parseFloat(payload.dilution_ratio);

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
                                label="Gas Volume (GV)"
                                type="text"
                                inputMode="numeric"
                                name="gv"
                                value={formData.gv || ''}
                                onChange={(e) => {
                                    let val = e.target.value;
                                    // Logic:
                                    // 1. If length is 1 and it's a digit, append '+' -> "N+"
                                    // 2. If user deleted '+' (e.g. was "1+", becomes "1"), clear the whole thing.
                                    // 3. If user deleted the number before '+' (e.g., was "1+2", becomes "+2"), this is tricky with standard input.
                                    //    Better logic based on diff:

                                    // Let's rely on simple state checks and allowed regex.
                                    // Allowed format during typing: "", "N", "N+", "N+M"

                                    const prevVal = formData.gv || '';

                                    // Case: User is backspacing the '+'
                                    // Previous was 'N+', new is 'N'. User wants to delete the '+'.
                                    // Requirement: "delete the number and plus sign not the plus sign only"
                                    // So if we go from "1+" to "1", we should actually go to "".
                                    if (prevVal.match(/^\d\+$/) && val.match(/^\d$/)) {
                                        setFormData(prev => ({ ...prev, gv: '' }));
                                        return;
                                    }

                                    // Case: User types the first number
                                    // Previous was "", new is "N".
                                    // Requirement: "automatically insert the plus sign (+) after that"
                                    if (prevVal === "" && val.match(/^\d$/)) {
                                        setFormData(prev => ({ ...prev, gv: val + '+' }));
                                        return;
                                    }

                                    // Case: Standard validation for what can be typed
                                    // We only allow: empty, single digit, digit+plus, digit+plus+digit(s)
                                    // Actually the second number can be anything? "user enter the second number". 
                                    // Assuming second part is number, possibly multi-digit.
                                    // Regex for valid content: ^$ | ^\d$ | ^\d\+$ | ^\d\+\d*$
                                    // But wait, if we auto-add +, we never see just "N" except for a split second before update.

                                    // Let's enforce strict "N+M..." format.
                                    // If user types a digit when empty -> becomes "N+".
                                    // If user types anything else invalid, ignore.

                                    if (val === '') {
                                        setFormData(prev => ({ ...prev, gv: '' }));
                                        return;
                                    }

                                    // If text structure is valid, update. 
                                    // Allow strictly: ^d\+$ (digit plus) OR ^\d\+\d+$ (digit plus digits)
                                    // Actually we need to allow intermediate 'digit' if we didn't catch it above? No, we caught it.

                                    if (/^\d\+\d*$/.test(val)) {
                                        setFormData(prev => ({ ...prev, gv: val }));
                                    }
                                }}
                                placeholder="1+6"
                            />
                            <Input
                                label="Dilution Ratio"
                                type="number"
                                step="0.01"
                                name="dilution_ratio"
                                value={formData.dilution_ratio || ''}
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
