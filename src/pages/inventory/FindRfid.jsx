import React, { useState } from 'react';
import { Card, Input, Button, Badge } from '../../components/ui';
import {
    Smartphone,
    Barcode,
    Search,
    Loader2,
    Copy,
    ArrowRight,
    SearchCode
} from 'lucide-react';
import { inventoryApi } from '../../api/inventory';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

const FindRfid = () => {
    const [barcode, setBarcode] = useState('');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!barcode.trim()) return;
        setResult(null); // Clear previous results
        setLoading(true);
        try {
            const res = await inventoryApi.getRfidByBarcode(barcode.trim());
            if (res.data.status_code === 200 && res.data.data) {
                setResult(res.data.data);
            } else {
                toast.error(res.data.message || "No unit found for this barcode");
            }
        } catch (err) {
            console.error(err);
            const message = err.response?.data?.message || "Search failed";
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        toast.success("RFID copied!");
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-100 dark:bg-emerald-500/10 rounded-2xl">
                    <Smartphone className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">Find RFID</h1>
                    <p className="text-sm text-slate-500">Search for the active RFID tag assigned to a barcode</p>
                </div>
            </div>

            <Card className="p-8">
                <form onSubmit={handleSearch} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Barcode Number</label>
                        <div className="relative">
                            <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={24} />
                            <Input
                                placeholder="e.g., L165911853142602"
                                value={barcode}
                                onChange={(e) => setBarcode(e.target.value)}
                                className="pl-12 h-16 text-2xl font-mono border-2 focus:border-emerald-500 transition-all"
                                autoFocus
                            />
                        </div>
                    </div>
                    <Button type="submit" disabled={loading} className="w-full h-14 text-xl gap-3 shadow-emerald-500/20 shadow-2xl bg-emerald-600 hover:bg-emerald-700">
                        {loading ? <Loader2 className="animate-spin" /> : <Search size={24} />}
                        Find Corresponding RFID
                    </Button>
                </form>
            </Card>

            <AnimatePresence>
                {result && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="space-y-6"
                    >
                        <Card className="p-10 text-center border-2 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-500/5 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Smartphone size={150} />
                            </div>

                            <p className="text-sm font-black text-emerald-500 uppercase tracking-widest mb-4">Search Result Found</p>

                            <div className="space-y-2 mb-8">
                                <h3 className="text-sm text-slate-500 font-medium">Linked RFID Tag Number:</h3>
                                <div className="inline-flex items-center gap-4 bg-white dark:bg-slate-900 px-8 py-6 rounded-2xl border-2 border-emerald-500 shadow-xl group cursor-pointer"
                                    onClick={() => copyToClipboard(result.rfid_number)}>
                                    <span className="text-5xl font-black font-mono tracking-tighter text-slate-900 dark:text-slate-100">
                                        {result.rfid_number || 'NOT LINKED'}
                                    </span>
                                    <Copy size={28} className="text-emerald-500 group-hover:scale-110 transition-transform" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8 border-t dark:border-slate-800">
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Product</p>
                                    <p className="font-bold">{result.product_name}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Current Stage</p>
                                    <Badge color="emerald">{result.current_status}</Badge>
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Inventory ID</p>
                                    <p className="font-mono text-xs">{result.internal_id}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Quantity</p>
                                    <p className="font-bold">{result.quantity} Pallets</p>
                                </div>
                            </div>
                        </Card>

                        <div className="flex justify-center">
                            <Button variant="ghost" className="gap-2" onClick={() => window.location.href = `/post-production/lookup?value=${result.current_barcode}`}>
                                View Full Movement History
                                <ArrowRight size={18} />
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default FindRfid;
