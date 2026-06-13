import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, Button, Input, DataTable, Badge } from '../../components/ui';
import {
    Barcode,
    ScanLine,
    Printer,
    CheckCircle2,
    XCircle,
    Loader2,
    ArrowLeft,
    Layers,
    History,
    RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { inventoryApi } from '../../api/inventory';
import { toast } from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import BarcodeLabel from '../../components/inventory/BarcodeLabel';

const BatchScan = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { targetStage, title } = location.state || { targetStage: 'WAREHOUSE', title: 'Unit Processing' };

    const [scannedUnits, setScannedUnits] = useState([]);
    const [currentInput, setCurrentInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [latestResult, setLatestResult] = useState(null);

    const inputRef = useRef(null);
    const labelRef = useRef(null);

    // Keep focus on input for scanning
    useEffect(() => {
        if (inputRef.current) inputRef.current.focus();
    }, []);

    const handlePrint = useReactToPrint({
        contentRef: labelRef,
        documentTitle: `Label_${latestResult?.barcode || 'unit'}`,
    });

    const handleScan = async (e) => {
        e.preventDefault();
        const scanValue = currentInput.trim();
        if (!scanValue) return;

        setLoading(true);
        setLatestResult(null);

        try {
            const res = await inventoryApi.scanHandlingUnit({
                scan_values: [scanValue],
                target_stage: targetStage
            });

            if (res.data.status_code === 200 && res.data.data) {
                const responseData = res.data.data;
                const isOverallSuccess = responseData.success !== false; // handle case where success might be undefined or true

                if (!isOverallSuccess) {
                    // Look for the specific scan value error in results
                    const unitResult = responseData.results?.find(r => r.scan_value === scanValue);
                    const errorMsg = unitResult?.error || responseData.message || "Unit processing failed";

                    toast.error(errorMsg);
                    setScannedUnits(prev => [{
                        id: Date.now(),
                        original_scan: scanValue,
                        status: 'ERROR',
                        message: errorMsg
                    }, ...prev]);
                    return;
                }

                const resultData = responseData[scanValue] || responseData.results?.[0] || responseData;

                const newUnit = {
                    id: Date.now(),
                    original_scan: scanValue,
                    barcode: resultData.new_barcode || resultData.barcode || scanValue,
                    product_name: resultData.product_name,
                    pet_name: resultData.pet_name,
                    quantity: resultData.quantity,
                    timestamp: new Date().toISOString(),
                    status: 'SUCCESS'
                };

                setLatestResult(newUnit);
                setScannedUnits(prev => [newUnit, ...prev]);
                toast.success("Unit moved successfully!");
            } else {
                const errorMsg = res.data.message || "Failed to move unit";
                toast.error(errorMsg);
                setScannedUnits(prev => [{
                    id: Date.now(),
                    original_scan: scanValue,
                    status: 'ERROR',
                    message: errorMsg
                }, ...prev]);
            }
        } catch (err) {
            console.error(err);
            const errorMsg = err.response?.data?.message || "Scan failed";
            toast.error(errorMsg);
            setScannedUnits(prev => [{
                id: Date.now(),
                original_scan: scanValue,
                status: 'ERROR',
                message: errorMsg
            }, ...prev]);
        } finally {
            setLoading(false);
            setCurrentInput('');
            if (inputRef.current) inputRef.current.focus();
        }
    };

    const columns = [
        {
            header: 'Result Barcode', accessor: 'barcode', render: (r) => (
                <div className="flex flex-col">
                    <span className="font-mono font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                        {r.barcode || r.original_scan}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                        Scan: {r.original_scan}
                    </span>
                </div>
            )
        },
        {
            header: 'Product Info', accessor: 'product_name', render: (r) => (
                r.status === 'SUCCESS' ? (
                    <div className="flex flex-col">
                        <span className="text-xs font-bold truncate max-w-[150px]">{r.product_name}</span>
                        <span className="text-[10px] text-slate-500">{r.pet_name} • {r.quantity} Units</span>
                    </div>
                ) : (
                    <span className="text-red-500 text-xs italic">{r.message || 'Processing Error'}</span>
                )
            )
        },
        {
            header: 'Status', accessor: 'status', render: (r) => (
                <Badge color={r.status === 'SUCCESS' ? 'emerald' : 'red'}>
                    {r.status}
                </Badge>
            )
        }
    ];

    return (
        <div className="max-w-[1400px] mx-auto space-y-8">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b dark:border-slate-800">
                <div className="flex items-center gap-5">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">{title}</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-slate-500 font-medium">Target Destination:</span>
                            <Badge color="blue" className="font-black tracking-widest">{targetStage}</Badge>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="secondary"
                        size="lg"
                        className="gap-2 h-14 px-8 rounded-2xl"
                        onClick={() => window.location.reload()}
                    >
                        <RefreshCw size={20} />
                        Reset Session
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                {/* Left Panel: Scanner & History */}
                <div className="xl:col-span-4 space-y-6">
                    {/* Scanner Card */}
                    <Card className="p-8 h-fit bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-none shadow-2xl shadow-blue-500/20 overflow-hidden relative">
                        <ScanLine className="absolute -right-8 -bottom-8 opacity-10" size={180} />

                        <div className="relative z-10 space-y-8">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-bold flex items-center gap-3">
                                    <div className="p-2 bg-white/20 rounded-xl">
                                        <ScanLine size={24} />
                                    </div>
                                    Inbound Scanner
                                </h3>
                                <div className="px-3 py-1 bg-white/10 rounded-full text-xs font-black tracking-widest animate-pulse border border-white/20">
                                    FOCUS ACTIVE
                                </div>
                            </div>

                            <form onSubmit={handleScan} className="space-y-4">
                                <div className="relative group">
                                    <Input
                                        ref={inputRef}
                                        value={currentInput}
                                        onChange={(e) => setCurrentInput(e.target.value)}
                                        placeholder="Awaiting input..."
                                        className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-20 pl-6 pr-14 text-2xl font-mono focus:ring-4 focus:ring-white/10 transition-all rounded-2xl border-2"
                                        autoComplete="off"
                                        disabled={loading}
                                    />
                                    <div className="absolute right-6 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-white transition-colors">
                                        {loading ? <Loader2 className="animate-spin" size={28} /> : <Barcode size={28} />}
                                    </div>
                                </div>
                                <p className="text-xs text-white/60 font-medium text-center italic">
                                    Scan a production barcode or RFID to move to {targetStage}
                                </p>
                            </form>

                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                                <div className="text-center p-3 bg-white/5 rounded-2xl">
                                    <p className="text-[10px] uppercase font-black opacity-50 mb-1">Session Moves</p>
                                    <p className="text-3xl font-black">{scannedUnits.filter(u => u.status === 'SUCCESS').length}</p>
                                </div>
                                <div className="text-center p-3 bg-white/5 rounded-2xl">
                                    <p className="text-[10px] uppercase font-black opacity-50 mb-1">Errors</p>
                                    <p className="text-3xl font-black">{scannedUnits.filter(u => u.status === 'ERROR').length}</p>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* History Card */}
                    <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-800 h-[calc(100vh-650px)] min-h-[300px]">
                        <div className="p-4 border-b bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
                            <h4 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                <History size={16} />
                                Recent Moves
                            </h4>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Live Log</span>
                        </div>
                        <div className="overflow-y-auto h-full">
                            <DataTable
                                columns={columns}
                                data={scannedUnits}
                                className="border-none"
                                isCompact
                            />
                        </div>
                    </Card>
                </div>

                {/* Right Panel: Label Preview & Print */}
                <div className="xl:col-span-8 flex flex-col gap-6">
                    <Card className="flex-1 p-10 flex flex-col items-center justify-center min-h-[600px] border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/30 relative overflow-hidden">
                        <AnimatePresence mode="wait">
                            {latestResult ? (
                                <motion.div
                                    key={latestResult.id}
                                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: -20 }}
                                    className="w-full flex flex-col items-center gap-8"
                                >
                                    <div className="flex items-center gap-3 text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-6 py-3 rounded-2xl border border-emerald-100 dark:border-emerald-500/20 shadow-lg shadow-emerald-500/10">
                                        <CheckCircle2 size={24} />
                                        <span className="text-lg font-black uppercase tracking-widest">Move Confirmed & Label Generated</span>
                                    </div>

                                    {/* Component used for Preview */}
                                    <div className="shadow-2xl shadow-slate-200 dark:shadow-none hover:rotate-1 transition-transform duration-500">
                                        <BarcodeLabel
                                            data={latestResult}
                                        />
                                    </div>

                                    <div className="flex flex-col items-center gap-4 w-full max-w-sm">
                                        <Button
                                            onClick={handlePrint}
                                            className="w-full h-16 text-xl gap-3 shadow-indigo-500/30 shadow-2xl bg-indigo-600 hover:bg-indigo-700 rounded-2xl"
                                        >
                                            <Printer size={24} />
                                            Print New Label
                                        </Button>
                                        <p className="text-xs text-slate-500 text-center">
                                            Click print to output barcode to the thermal printer. <br />
                                            The unit is now available in the <b>{targetStage}</b> stage.
                                        </p>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex flex-col items-center gap-6 text-center"
                                >
                                    <div className="p-8 bg-slate-100 dark:bg-slate-900 rounded-full text-slate-300 animate-pulse">
                                        <Printer size={80} />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-2xl font-black text-slate-400">Awaiting Unit Scan</h3>
                                        <p className="text-slate-500 max-w-xs mx-auto">
                                            Scan a unit to move its stage and generate a new printable barcode label.
                                        </p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Off-screen print container for high res */}
                        <div style={{ position: 'absolute', top: -9999, left: -9999 }}>
                            <div ref={labelRef}>
                                <BarcodeLabel data={latestResult} />
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default BatchScan;
