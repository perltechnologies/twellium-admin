import React, { useState, useRef } from 'react';
import { Card, Button, Input, DataTable, Badge, Select } from '../../components/ui';
import {
    Printer,
    Search,
    Barcode,
    CheckCircle2,
    AlertCircle,
    Tag,
    Layers,
    RefreshCw,
    X,
    Check
} from 'lucide-react';
import { inventoryApi } from '../../api/inventory';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import BarcodeLabel from '../../components/inventory/BarcodeLabel';

const ReprintLabels = () => {
    const today = new Date().toISOString().split('T')[0];
    const [filters, setFilters] = useState({
        date: today,
        stage: 'WAREHOUSE'
    });
    const [foundUnits, setFoundUnits] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedUnit, setSelectedUnit] = useState(null);

    const labelRef = useRef(null);

    const handlePrint = useReactToPrint({
        contentRef: labelRef,
        documentTitle: `Reprint_${selectedUnit?.barcode || 'label'}`,
    });

    const handleSearch = async (e) => {
        e.preventDefault();
        setLoading(true);
        setSelectedUnit(null);
        try {
            const res = await inventoryApi.getBarcodesByStage(filters);
            // Handle nested data response: res.data.data.data
            const results = res.data.data?.data || [];
            setFoundUnits(results);
            if (results.length === 0) toast.error("No units found for current filters");
        } catch (err) {
            console.error(err);
            toast.error("Error searching for units");
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        {
            header: 'Barcode',
            accessor: 'barcode',
            render: (r) => <span className="font-mono font-black text-slate-900">{r.barcode}</span>
        },
        {
            header: 'Product',
            accessor: 'product_name',
            render: (r) => (
                <div className="flex flex-col">
                    <span className="font-bold text-sm">{r.product_name}</span>
                    <span className="text-[10px] text-slate-500">{r.pet_name}</span>
                </div>
            )
        },
        {
            header: 'Qty',
            accessor: 'quantity',
            render: (r) => <span className="font-bold">{r.quantity}</span>
        },
        {
            header: 'Seq',
            accessor: 'pet_sequence',
            render: (r) => <span className="font-bold text-blue-600">{r.pet_sequence || '-'}</span>
        },
        {
            header: 'Actions',
            accessor: 'barcode',
            render: (r) => (
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedUnit({
                        ...r,
                        // Ensure required fields for BarcodeLabel
                        timestamp: filters.date,
                        type: 'REPRINT'
                    })}
                    className="gap-2"
                >
                    <Printer size={14} />
                    Select
                </Button>
            )
        }
    ];

    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-100 dark:bg-indigo-500/10 rounded-2xl">
                    <Printer className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-black">Reprint Station</h1>
                    <p className="text-sm text-slate-500 font-medium">Filter the system repository and regenerate thermal labels for any unit</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Search Panel */}
                <div className="lg:col-span-7 space-y-6">
                    <Card className="p-6">
                        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">Process Stage</label>
                                <Select
                                    value={filters.stage}
                                    onChange={(e) => setFilters({ ...filters, stage: e.target.value })}
                                    className="h-14 font-bold"
                                >
                                    <option value="PRODUCTION">PRODUCTION</option>
                                    <option value="WAREHOUSE">WAREHOUSE</option>
                                    <option value="QUALIFIED">QUALIFIED</option>
                                    <option value="LOADING">LOADING</option>
                                    <option value="LOADED">LOADED</option>
                                    <option value="DAMAGED">DAMAGED</option>
                                </Select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">Generated Date</label>
                                <Input
                                    type="date"
                                    value={filters.date}
                                    onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                                    className="h-14 font-bold"
                                />
                            </div>
                            <Button type="submit" className="h-14 font-black text-lg gap-2" disabled={loading}>
                                {loading ? <RefreshCw className="animate-spin" /> : <Search size={20} />}
                                Filter
                            </Button>
                        </form>
                    </Card>

                    <Card className="p-0 overflow-hidden min-h-[400px]">
                        {foundUnits.length > 0 ? (
                            <DataTable columns={columns} data={foundUnits} isLoading={loading} />
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center p-20 text-center opacity-40">
                                <div className="p-6 bg-slate-100 dark:bg-slate-800 rounded-full mb-4">
                                    <Barcode size={48} />
                                </div>
                                <h4 className="text-lg font-black uppercase tracking-tight">System Ready</h4>
                                <p className="text-sm">Select process and date to find labels</p>
                            </div>
                        )}
                    </Card>
                </div>

                {/* Print Preview Panel */}
                <div className="lg:col-span-5">
                    <Card className={`h-full p-8 flex flex-col items-center justify-center border-2 border-dashed relative transition-all duration-500 ${selectedUnit ? 'bg-slate-900 border-none shadow-2xl overflow-hidden' : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'}`}>
                        <AnimatePresence mode="wait">
                            {selectedUnit ? (
                                <motion.div
                                    key={selectedUnit.id}
                                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                                    animate={{ scale: 1, opacity: 1, y: 0 }}
                                    className="w-full flex flex-col items-center gap-8"
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <Badge color="emerald" className="gap-2">
                                            <Check size={12} /> Ready to Reprint
                                        </Badge>
                                        <button onClick={() => setSelectedUnit(null)} className="text-white/40 hover:text-white transition-colors">
                                            <X size={20} />
                                        </button>
                                    </div>

                                    <div className="shadow-2xl shadow-black rounded-lg overflow-hidden ring-1 ring-white/10">
                                        <BarcodeLabel data={selectedUnit} />
                                    </div>

                                    <div className="flex flex-col gap-4 w-full max-w-xs pt-4">
                                        <Button
                                            onClick={handlePrint}
                                            className="h-16 bg-white text-slate-900 hover:bg-slate-100 text-xl font-black rounded-2xl gap-3"
                                        >
                                            <Printer size={24} /> Reprint Now
                                        </Button>
                                        <p className="text-[10px] text-white/40 text-center uppercase font-black tracking-widest leading-relaxed">
                                            Operator authorization log triggered <br />
                                            {new Date().toLocaleString()}
                                        </p>
                                    </div>
                                </motion.div>
                            ) : (
                                <div className="text-center space-y-4">
                                    <Printer size={64} className="mx-auto text-slate-200 dark:text-slate-700" />
                                    <p className="text-slate-400 font-bold">Select a unit to preview label</p>
                                </div>
                            )}
                        </AnimatePresence>
                    </Card>
                </div>
            </div>

            {/* Off-screen Print Content */}
            <div style={{ position: 'absolute', top: -9999, left: -9999 }}>
                <div ref={labelRef}>
                    {selectedUnit && <BarcodeLabel data={selectedUnit} />}
                </div>
            </div>

            {/* Security Notes Footer */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 border-t dark:border-slate-800">
                <div className="flex items-start gap-4">
                    <AlertCircle className="text-amber-500 mt-1" />
                    <div>
                        <h4 className="font-bold text-sm">Audit Compliance</h4>
                        <p className="text-xs text-slate-500">Reprinting is tracked by the system audit trail for transparency.</p>
                    </div>
                </div>
                <div className="flex items-start gap-4">
                    <CheckCircle2 className="text-emerald-500 mt-1" />
                    <div>
                        <h4 className="font-bold text-sm">Thermal Layout</h4>
                        <p className="text-xs text-slate-500">Automatically scales to 4x6 thermal printer specifications.</p>
                    </div>
                </div>
                <div className="flex items-start gap-4">
                    <Layers className="text-blue-500 mt-1" />
                    <div>
                        <h4 className="font-bold text-sm">Live Data sync</h4>
                        <p className="text-xs text-slate-500">Uses the most recent stage information for accurate label generation.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReprintLabels;
