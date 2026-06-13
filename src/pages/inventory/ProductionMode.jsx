import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Select, Badge } from '../../components/ui';
import {
    Barcode,
    Layers,
    Smartphone,
    Printer,
    Link as LinkIcon,
    AlertCircle,
    CheckCircle2,
    RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReactToPrint } from 'react-to-print';
import { inventoryApi } from '../../api/inventory';
import { productionApi } from '../../api/production';
import BarcodeLabel from '../../components/inventory/BarcodeLabel';
import { toast } from 'react-hot-toast';
import { useRef } from 'react';

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
                setProducts(productsRes.data.data || []);
                setPets(petsRes.data.data || []);
            } catch (err) {
                console.error("Failed to load lookups", err);
                toast.error("Failed to load products or production lines");
            }
        };
        loadLookups();
    }, []);

    const handleGenerateOutput = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await inventoryApi.createHandlingUnit(outputData);
            const unitData = res.data.data;
            setGeneratedBarcode({
                ...unitData,
                barcode: unitData.label?.barcode || unitData.barcode || unitData.internal_id
            });
            toast.success("Handling Unit Generated!");
            // Trigger print logic here if needed
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || "Failed to generate output");
        } finally {
            setLoading(false);
        }
    };

    const handleLinkRfid = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await inventoryApi.linkRfid(rfidData);
            setRfidSuccess(res.data.data);
            toast.success("RFID linked successfully!");
            setRfidData({ barcode: '', rfid_number: '' });
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || "Failed to link RFID");
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setGeneratedBarcode(null);
        setOutputData(prev => ({ ...prev, quantity: 1 }));
    };

    const handleResetRfid = () => {
        setRfidSuccess(null);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Production Mode</h1>
                    <p className="text-slate-500 dark:text-slate-400">Generate output units and manage tracking tags</p>
                </div>

                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
                    <button
                        onClick={() => setActiveTab('output')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'output'
                            ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                    >
                        <Barcode size={16} />
                        Generate Output
                    </button>
                    <button
                        onClick={() => setActiveTab('rfid')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'rfid'
                            ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                    >
                        <Smartphone size={16} />
                        Link RFID
                    </button>
                </div>
            </div>

            <AnimatePresence mode="wait">
                {activeTab === 'output' ? (
                    <motion.div
                        key="output"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                    >
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <Card className="p-8">
                                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                                    <Layers className="text-blue-500" />
                                    New Handling Unit
                                </h3>

                                <form onSubmit={handleGenerateOutput} className="space-y-6">
                                    <div>
                                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">
                                            Select Product
                                        </label>
                                        <Select
                                            value={outputData.product_id}
                                            onChange={(e) => setOutputData({ ...outputData, product_id: e.target.value })}
                                            required
                                        >
                                            <option value="">Choose a product...</option>
                                            {products.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </Select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">
                                                Production Line (PET)
                                            </label>
                                            <Select
                                                value={outputData.pet_id}
                                                onChange={(e) => {
                                                    const petId = e.target.value;
                                                    setOutputData({ ...outputData, pet_id: petId, line_speed_id: '' });
                                                }}
                                                required
                                            >
                                                <option value="">Select line...</option>
                                                {pets.map(p => (
                                                    <option key={p.id} value={p.id}>{p.pet_name}</option>
                                                ))}
                                            </Select>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">
                                                Line Speed
                                            </label>
                                            <Select
                                                value={outputData.line_speed_id}
                                                onChange={(e) => setOutputData({ ...outputData, line_speed_id: e.target.value })}
                                                required
                                                disabled={!outputData.pet_id}
                                            >
                                                <option value="">{outputData.pet_id ? 'Select speed...' : 'Select PET first'}</option>
                                                {pets.find(p => p.id == outputData.pet_id)?.line_speeds?.map(ls => (
                                                    <option key={ls.id} value={ls.id}>
                                                        {ls.name} ({ls.speed} bpm)
                                                    </option>
                                                ))}
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4">
                                        <div>
                                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">
                                                Quantity
                                            </label>
                                            <Input
                                                type="number"
                                                min="1"
                                                value={outputData.quantity}
                                                onChange={(e) => setOutputData({ ...outputData, quantity: parseInt(e.target.value) || 0 })}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <Button
                                        type="submit"
                                        className="w-full h-12 text-lg"
                                        disabled={loading}
                                    >
                                        {loading ? <RefreshCw className="animate-spin mr-2" /> : <Barcode className="mr-2" />}
                                        Generate Label
                                    </Button>
                                </form>
                            </Card>

                            <Card className={`p-8 flex flex-col items-center justify-center relative transition-all duration-500 border-2 border-dashed ${generatedBarcode ? 'bg-slate-900 border-none shadow-2xl overflow-hidden' : 'bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800'}`}>
                                <AnimatePresence mode="wait">
                                    {generatedBarcode ? (
                                        <motion.div
                                            key="result"
                                            initial={{ scale: 0.9, opacity: 0, y: 30 }}
                                            animate={{ scale: 1, opacity: 1, y: 0 }}
                                            exit={{ scale: 0.9, opacity: 0, y: -30 }}
                                            className="w-full flex flex-col items-center gap-10"
                                        >
                                            <div className="space-y-2 text-center">
                                                <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/30 ring-4 ring-emerald-500/20">
                                                    <CheckCircle2 className="w-8 h-8" strokeWidth={3} />
                                                </div>
                                                <h3 className="text-xl font-black text-white uppercase tracking-tight">Generation Successful</h3>
                                            </div>

                                            <div className="scale-110 shadow-2xl shadow-black rounded-lg overflow-hidden border border-white/10">
                                                <BarcodeLabel
                                                    data={{
                                                        ...generatedBarcode,
                                                        product_name: products.find(p => p.id == outputData.product_id)?.name,
                                                        pet_name: pets.find(p => p.id == outputData.pet_id)?.pet_name,
                                                        line_speed_name: pets.find(p => p.id == outputData.pet_id)?.line_speeds?.find(ls => ls.id == outputData.line_speed_id)?.name,
                                                        quantity: outputData.quantity
                                                    }}
                                                />
                                            </div>

                                            <div className="flex flex-col gap-4 w-full max-w-xs">
                                                <Button
                                                    onClick={handlePrint}
                                                    className="h-16 bg-white text-slate-900 hover:bg-slate-100 text-xl font-black rounded-2xl gap-3 shadow-2xl"
                                                >
                                                    <Printer size={24} /> Print Now
                                                </Button>
                                                <Button
                                                    onClick={handleReset}
                                                    variant="ghost"
                                                    className="text-white hover:bg-white/10 h-12"
                                                >
                                                    Create New Unit
                                                </Button>
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="placeholder"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="flex flex-col items-center gap-8 text-center"
                                        >
                                            <div className="relative">
                                                <div className="w-40 h-40 bg-white dark:bg-slate-800 rounded-3xl flex items-center justify-center shadow-2xl border border-slate-100 dark:border-slate-700">
                                                    <Printer className="w-20 h-20 text-slate-200 dark:text-slate-700" />
                                                </div>
                                                <div className="absolute -bottom-4 -right-4 p-4 bg-blue-600 rounded-2xl text-white shadow-xl rotate-12">
                                                    <Barcode size={32} />
                                                </div>
                                            </div>
                                            <div className="space-y-3">
                                                <h3 className="text-2xl font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">No Label Generated Yet</h3>
                                                <p className="max-w-xs mx-auto text-slate-500 font-medium leading-relaxed">
                                                    Fill the form on the left to create a new production handling unit.
                                                </p>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </Card>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="rfid"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                    >
                        <Card className={`p-8 max-w-2xl mx-auto shadow-lg border-2 transition-all duration-500 ${rfidSuccess ? 'bg-slate-900 border-none ring-1 ring-white/10' : 'hover:border-blue-500/20'}`}>
                            <AnimatePresence mode="wait">
                                {rfidSuccess ? (
                                    <motion.div
                                        key="rfid-success"
                                        initial={{ scale: 0.9, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        className="flex flex-col items-center text-center py-6 gap-8"
                                    >
                                        <div className="w-20 h-20 bg-blue-500 text-white rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/40 ring-4 ring-blue-500/20 rotate-12">
                                            <LinkIcon size={40} strokeWidth={3} />
                                        </div>

                                        <div className="space-y-2">
                                            <h3 className="text-2xl font-black text-white uppercase tracking-tight">Link Successful</h3>
                                            <p className="text-slate-400 font-medium italic">Handing unit uniquely identified</p>
                                        </div>

                                        <div className="w-full grid grid-cols-1 gap-4">
                                            <div className="p-6 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between group hover:bg-white/10 transition-colors">
                                                <div className="text-left">
                                                    <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest mb-1">Barcode</p>
                                                    <p className="text-xl font-mono text-white font-bold">{rfidSuccess.barcode}</p>
                                                </div>
                                                <Barcode className="text-white/20 group-hover:text-blue-400 transition-colors" size={32} />
                                            </div>

                                            <div className="p-6 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between group hover:bg-white/10 transition-colors">
                                                <div className="text-left">
                                                    <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest mb-1">RFID Target</p>
                                                    <p className="text-xl font-mono text-white font-bold">{rfidSuccess.rfid_number}</p>
                                                </div>
                                                <Smartphone className="text-white/20 group-hover:text-blue-400 transition-colors" size={32} />
                                            </div>
                                        </div>

                                        <Button
                                            onClick={handleResetRfid}
                                            className="w-full h-14 bg-white text-slate-900 hover:bg-slate-100 text-lg font-black rounded-2xl mt-4"
                                        >
                                            Link Another Tag
                                        </Button>
                                    </motion.div>
                                ) : (
                                    <motion.div key="rfid-form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                        <div className="flex items-center gap-4 mb-8">
                                            <div className="p-3 bg-blue-100 dark:bg-blue-500/10 rounded-xl">
                                                <LinkIcon className="text-blue-600 dark:text-blue-400" />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-bold">Link RFID Tag</h3>
                                                <p className="text-sm text-slate-500 dark:text-slate-400">Attach an electronic tag to an existing barcode</p>
                                            </div>
                                        </div>

                                        <form onSubmit={handleLinkRfid} className="space-y-6">
                                            <div className="p-6 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-6">
                                                <div className="relative group">
                                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest absolute -top-2 left-3 bg-white dark:bg-slate-950 px-2 group-focus-within:text-blue-500 transition-colors">
                                                        Scanning Barcode
                                                    </label>
                                                    <div className="flex items-center">
                                                        <div className="pl-4 pr-2 text-slate-400">
                                                            <Barcode size={20} />
                                                        </div>
                                                        <Input
                                                            placeholder="Scan or enter barcode..."
                                                            className="border-none focus:ring-0 text-lg font-mono placeholder:font-sans py-6 bg-transparent"
                                                            value={rfidData.barcode}
                                                            onChange={(e) => setRfidData({ ...rfidData, barcode: e.target.value })}
                                                            required
                                                            autoFocus
                                                        />
                                                    </div>
                                                </div>

                                                <div className="relative group">
                                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest absolute -top-2 left-3 bg-white dark:bg-slate-950 px-2 group-focus-within:text-blue-500 transition-colors">
                                                        RFID Number
                                                    </label>
                                                    <div className="flex items-center">
                                                        <div className="pl-4 pr-2 text-slate-400">
                                                            <Smartphone size={20} />
                                                        </div>
                                                        <Input
                                                            placeholder="Bring card near reader..."
                                                            className="border-none focus:ring-0 text-lg font-mono placeholder:font-sans py-6 bg-transparent"
                                                            value={rfidData.rfid_number}
                                                            onChange={(e) => setRfidData({ ...rfidData, rfid_number: e.target.value })}
                                                            required
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-4">
                                                <Button
                                                    type="submit"
                                                    className="h-14 text-lg bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20"
                                                    disabled={loading}
                                                >
                                                    {loading ? <RefreshCw className="animate-spin mr-2" /> : <LinkIcon className="mr-2" />}
                                                    Initialize Link
                                                </Button>

                                                <div className="flex items-center justify-center p-4 rounded-xl bg-amber-50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/20">
                                                    <AlertCircle className="h-4 w-4 text-amber-500 mr-2 flex-shrink-0" />
                                                    <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                                                        Ensure the scanner focus is in the barcode field before starting.
                                                    </p>
                                                </div>
                                            </div>
                                        </form>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Off-screen Print Area */}
            <div style={{ position: 'absolute', top: -9999, left: -9999 }}>
                <div ref={labelRef}>
                    {generatedBarcode && (
                        <BarcodeLabel
                            data={{
                                ...generatedBarcode,
                                product_name: products.find(p => p.id == outputData.product_id)?.name,
                                pet_name: pets.find(p => p.id == outputData.pet_id)?.pet_name,
                                line_speed_name: pets.find(p => p.id == outputData.pet_id)?.line_speeds?.find(ls => ls.id == outputData.line_speed_id)?.name,
                                quantity: outputData.quantity
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProductionMode;
