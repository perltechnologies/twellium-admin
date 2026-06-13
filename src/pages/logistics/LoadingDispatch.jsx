import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Select, Badge } from '../../components/ui';
import {
    Truck,
    User as UserIcon,
    MapPin,
    Barcode,
    CheckCircle2,
    ChevronRight,
    Search,
    Plus,
    Loader2,
    Package,
    Navigation,
    Printer,
    ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { logisticsApi } from '../../api/logistics';
import { inventoryApi } from '../../api/inventory';
import { toast } from 'react-hot-toast';

const LoadingDispatch = () => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [lookups, setLookups] = useState({
        vehicles: [],
        drivers: [],
        customers: []
    });

    // Step 1: Shipment Data
    const [shipmentData, setShipmentData] = useState({
        vehicle: '',
        driver: '',
        destination: '',
        customer: ''
    });
    const [createdShipment, setCreatedShipment] = useState(null);

    // Step 2: Scanning Data
    const [scannedUnits, setScannedUnits] = useState([]);
    const [currentBarcode, setCurrentBarcode] = useState('');

    useEffect(() => {
        const fetchLookups = async () => {
            try {
                const [vRes, dRes, cRes] = await Promise.all([
                    logisticsApi.getVehicles({ page_size: 100 }),
                    logisticsApi.getDrivers({ page_size: 100 }),
                    logisticsApi.getCustomers({ page_size: 100 })
                ]);
                setLookups({
                    vehicles: vRes.data.data || [],
                    drivers: dRes.data.data || [],
                    customers: cRes.data.data || []
                });
            } catch (err) {
                console.error(err);
                toast.error("Failed to load logistics lookups");
            }
        };
        fetchLookups();
    }, []);

    const handleCreateShipment = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await logisticsApi.createShipment(shipmentData);
            setCreatedShipment(res.data.data);
            setStep(2);
            toast.success("Shipment Created! Start loading units.");
        } catch (err) {
            toast.error("Failed to create shipment");
        } finally {
            setLoading(false);
        }
    };

    const handleAddBarcode = (e) => {
        e.preventDefault();
        const b = currentBarcode.trim();
        if (!b) return;
        if (scannedUnits.includes(b)) {
            toast.error("Unit already scanned");
            setCurrentBarcode('');
            return;
        }
        setScannedUnits([...scannedUnits, b]);
        setCurrentBarcode('');
    };

    const handleConfirmLoading = async () => {
        if (scannedUnits.length === 0) return;
        setLoading(true);
        try {
            await inventoryApi.scanHandlingUnit({
                scan_values: scannedUnits,
                target_stage: "LOADING",
                shipment_id: createdShipment.id
            });
            setStep(3);
            toast.success("All units loaded onto vehicle!");
        } catch (err) {
            toast.error("Error transitioning units to LOADING");
        } finally {
            setLoading(false);
        }
    };

    const handleDispatch = async () => {
        setLoading(true);
        try {
            await logisticsApi.markDispatched(createdShipment.id);
            toast.success("Shipment Dispatched!");
            resetFlow();
        } catch (err) {
            toast.error("Failed to dispatch shipment");
        } finally {
            setLoading(false);
        }
    };

    const resetFlow = () => {
        setStep(1);
        setShipmentData({ vehicle: '', driver: '', destination: '', customer: '' });
        setCreatedShipment(null);
        setScannedUnits([]);
    };

    const StepIndicator = () => (
        <div className="flex items-center gap-4 mb-8">
            {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all ${step === i ? 'bg-blue-600 border-blue-600 text-white shadow-lg' :
                        step > i ? 'bg-emerald-500 border-emerald-500 text-white' :
                            'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400'
                        }`}>
                        {step > i ? <CheckCircle2 size={16} /> : i}
                    </div>
                    {i < 3 && <div className={`w-12 h-0.5 mx-2 ${step > i ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'}`} />}
                </div>
            ))}
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Loading & Dispatch</h1>
                    <p className="text-sm text-slate-500">Final inventory outbound flow</p>
                </div>
                {step > 1 && (
                    <Button variant="ghost" onClick={resetFlow} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                        Cancel Flow
                    </Button>
                )}
            </div>

            <StepIndicator />

            <AnimatePresence mode="wait">
                {step === 1 && (
                    <motion.div
                        key="step1"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                    >
                        <Card className="p-8">
                            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                                <Truck className="text-blue-500" />
                                1. Shipment Details
                            </h3>
                            <form onSubmit={handleCreateShipment} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Vehicle</label>
                                    <Select
                                        value={shipmentData.vehicle}
                                        onChange={(e) => setShipmentData({ ...shipmentData, vehicle: e.target.value })}
                                        required
                                    >
                                        <option value="">Select vehicle...</option>
                                        {lookups.vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number} (Cap: {v.capacity})</option>)}
                                    </Select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Driver</label>
                                    <Select
                                        value={shipmentData.driver}
                                        onChange={(e) => setShipmentData({ ...shipmentData, driver: e.target.value })}
                                        required
                                    >
                                        <option value="">Select driver...</option>
                                        {lookups.drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </Select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Customer / Destination</label>
                                    <Select
                                        value={shipmentData.customer}
                                        onChange={(e) => setShipmentData({ ...shipmentData, customer: e.target.value })}
                                        required
                                    >
                                        <option value="">Select customer...</option>
                                        {lookups.customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </Select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Detailed Destination</label>
                                    <Input
                                        placeholder="Specific address or site..."
                                        value={shipmentData.destination}
                                        onChange={(e) => setShipmentData({ ...shipmentData, destination: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="md:col-span-2 pt-4">
                                    <Button type="submit" className="w-full h-12 text-lg gap-2" disabled={loading}>
                                        {loading ? <Loader2 className="animate-spin" /> : <Plus size={20} />}
                                        Initialize Shipment
                                    </Button>
                                </div>
                            </form>
                        </Card>
                    </motion.div>
                )}

                {step === 2 && (
                    <motion.div
                        key="step2"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-6"
                    >
                        <Card className="p-6 bg-blue-600 text-white border-none relative overflow-hidden">
                            <Truck className="absolute -right-4 -bottom-4 opacity-10" size={120} />
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <p className="text-sm opacity-80 uppercase tracking-widest font-bold">Now Loading</p>
                                    <h4 className="text-2xl font-black">{createdShipment?.shipment_code}</h4>
                                    <p className="text-sm opacity-80 font-medium mt-1">{shipmentData.destination}</p>
                                </div>
                                <Badge color="white" className="w-fit">{scannedUnits.length} Units Loaded</Badge>
                            </div>
                        </Card>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card className="p-6">
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <Barcode className="text-blue-500" />
                                    Scan Loading Units
                                </h3>
                                <form onSubmit={handleAddBarcode} className="space-y-4">
                                    <Input
                                        placeholder="Scan unit barcode..."
                                        className="h-14 text-lg font-mono"
                                        value={currentBarcode}
                                        onChange={(e) => setCurrentBarcode(e.target.value)}
                                        autoFocus
                                    />
                                    <Button type="submit" variant="outline" className="w-full">Add To List</Button>
                                </form>
                            </Card>

                            <Card className="p-6 flex flex-col h-[300px]">
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Queued for Loading</h3>
                                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                                    {scannedUnits.map((b, i) => (
                                        <div key={b} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border animate-in slide-in-from-right-2" style={{ animationDelay: `${i * 50}ms` }}>
                                            <span className="font-mono text-sm font-bold">{b}</span>
                                            <button onClick={() => setScannedUnits(scannedUnits.filter(u => u !== b))} className="text-red-400 hover:text-red-500">
                                                <Plus size={18} className="rotate-45" />
                                            </button>
                                        </div>
                                    ))}
                                    {scannedUnits.length === 0 && (
                                        <div className="h-full flex flex-col items-center justify-center opacity-40 italic">
                                            <Package size={32} />
                                            <p className="text-sm mt-2">No units scanned</p>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        </div>
                        <Button
                            className="w-full h-14 text-lg bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20 shadow-xl"
                            onClick={handleConfirmLoading}
                            disabled={scannedUnits.length === 0 || loading}
                        >
                            {loading ? <Loader2 className="animate-spin" /> : <Package className="mr-2" />}
                            Finish Loading & Seal Vehicle
                        </Button>
                    </motion.div>
                )}

                {step === 3 && (
                    <motion.div
                        key="step3"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="space-y-6"
                    >
                        <Card className="p-12 text-center space-y-8 bg-emerald-500/5 border-emerald-500/20">
                            <div className="relative w-24 h-24 mx-auto">
                                <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping" />
                                <div className="relative w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center text-white">
                                    <CheckCircle2 size={48} />
                                </div>
                            </div>

                            <div>
                                <h3 className="text-3xl font-black text-slate-900 dark:text-slate-100">Ready for Dispatch</h3>
                                <p className="text-slate-500 mt-2">Shipment <span className="font-mono font-bold text-blue-500">{createdShipment?.shipment_code}</span> is fully loaded and sealed.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl mx-auto">
                                <Card className="p-4 bg-white dark:bg-slate-900 flex flex-col items-center gap-2">
                                    <Truck size={20} className="text-slate-400" />
                                    <div className="text-xs text-slate-400 uppercase font-bold">Vehicle</div>
                                    <div className="font-bold">{lookups.vehicles.find(v => v.id == shipmentData.vehicle)?.plate_number || 'N/A'}</div>
                                </Card>
                                <Card className="p-4 bg-white dark:bg-slate-900 flex flex-col items-center gap-2">
                                    <Package size={20} className="text-slate-400" />
                                    <div className="text-xs text-slate-400 uppercase font-bold">Total Load</div>
                                    <div className="font-bold">{scannedUnits.length} Pallets</div>
                                </Card>
                            </div>

                            <div className="flex flex-col gap-3 pt-4">
                                <Button
                                    className="h-16 text-xl bg-blue-600 hover:bg-blue-700 w-full shadow-blue-500/20 shadow-2xl"
                                    onClick={handleDispatch}
                                    disabled={loading}
                                >
                                    {loading ? <Loader2 className="animate-spin" /> : <Navigation className="mr-2" />}
                                    Dispatch Vehicle
                                </Button>
                                <Button variant="ghost" className="h-12 border border-slate-200 dark:border-slate-800 gap-2">
                                    <Printer size={18} />
                                    Print Waybill
                                </Button>
                            </div>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default LoadingDispatch;
