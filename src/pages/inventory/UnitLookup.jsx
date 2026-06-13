import React, { useState } from 'react';
import { Card, Input, Button, Badge } from '../../components/ui';
import {
    Search,
    History as HistoryIcon,
    Barcode,
    Smartphone,
    Clock,
    Loader2,
    Package,
    Warehouse as WarehouseIcon,
    Truck,
    MapPin,
    User as UserIcon,
    AlertCircle,
    CheckCircle2,
    Tag
} from 'lucide-react';
import { inventoryApi } from '../../api/inventory';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

const UnitLookup = () => {
    const [searchValue, setSearchValue] = useState('');
    const [unit, setUnit] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchValue.trim()) return;
        setUnit(null); // Clear previous results immediately
        setLoading(true);
        try {
            const res = await inventoryApi.getUnitStatus(searchValue.trim());
            // Check status_code in the data wrapper as per migration docs
            if (res.data.status_code === 200 && res.data.data) {
                setUnit(res.data.data);
            } else {
                toast.error(res.data.message || "Unit not found");
            }
        } catch (err) {
            console.error(err);
            const message = err.response?.data?.message || "Error searching for unit status";
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    const getStageIcon = (stage) => {
        switch (stage?.toUpperCase()) {
            case 'PRODUCTION': return <Package className="text-indigo-500" />;
            case 'WAREHOUSE': return <WarehouseIcon className="text-emerald-500" />;
            case 'LOADING': return <Truck className="text-blue-500" />;
            case 'DAMAGED': return <AlertCircle className="text-red-500" />;
            default: return <MapPin className="text-slate-500" />;
        }
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-500/10 rounded-2xl">
                    <Search className="text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Unit Status & History</h1>
                    <p className="text-sm text-slate-500">Track current status and movement history of any pallet or unit</p>
                </div>
            </div>

            <Card className="p-6">
                <form onSubmit={handleSearch} className="flex gap-4">
                    <div className="relative flex-1">
                        <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
                        <Input
                            placeholder="Scan or Enter Barcode / RFID Number..."
                            className="pl-10 h-12 text-lg font-mono"
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <Button type="submit" disabled={loading} className="px-8 h-12 gap-2 text-lg">
                        {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Search size={20} />}
                        Search
                    </Button>
                </form>
            </Card>

            <AnimatePresence mode="wait">
                {unit && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-6"
                    >
                        {/* Summary Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                            <Card className="p-6 lg:col-span-3 border-l-4 border-blue-500">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Product Details</p>
                                            <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">{unit.product_name}</h3>
                                            <p className="text-sm text-slate-500">{unit.pet_name}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Quantity</p>
                                            <p className="text-2xl font-bold">{unit.quantity} <span className="text-sm font-medium text-slate-500">Units</span></p>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Barcode</p>
                                            <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-500/20">
                                                <Barcode size={16} className="text-blue-500" />
                                                <span className="font-mono font-black text-blue-600 dark:text-blue-400">{unit.current_barcode}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">RFID Tag</p>
                                            <div className="inline-flex items-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-500/20">
                                                <Smartphone size={16} className="text-emerald-500" />
                                                <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">{unit.rfid_number || 'UNLINKED'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unit ID (Internal)</p>
                                            <p className="font-mono text-sm">{unit.internal_id}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pet Sequence</p>
                                            <p className="text-xl font-bold text-blue-600">{unit.pet_sequence || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Production Run</p>
                                            <p className="font-bold text-slate-700 dark:text-slate-300">{unit.actual_production_code || 'N/A'}</p>
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            <Card className="p-6 lg:col-span-1 bg-gradient-to-br from-blue-600 to-blue-800 text-white border-none">
                                <p className="text-xs font-bold opacity-80 uppercase tracking-widest mb-2">Current Location</p>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-3 bg-white/20 rounded-2xl">
                                        <WarehouseIcon size={24} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-lg leading-tight">{unit.current_warehouse_name || 'In Transit'}</h4>
                                        <Badge color="white" className="mt-1">{unit.current_status}</Badge>
                                    </div>
                                </div>
                                <div className="pt-4 border-t border-white/20">
                                    <p className="text-[10px] font-bold opacity-60 uppercase mb-1">Last Action By</p>
                                    <div className="flex items-center gap-2">
                                        <UserIcon size={14} className="opacity-80" />
                                        <span className="text-sm font-medium">{unit.history?.[0]?.scanned_by_name || 'System'}</span>
                                    </div>
                                </div>
                            </Card>
                        </div>

                        {/* Visual History Timeline */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold flex items-center gap-2 px-2">
                                <HistoryIcon size={20} className="text-blue-500" />
                                Movement Timeline
                            </h3>

                            <div className="relative pl-8 pt-4 pb-8 space-y-12">
                                {/* Vertical Spine */}
                                <div className="absolute left-[15px] top-0 bottom-0 w-1 bg-slate-200 dark:bg-slate-800 rounded-full" />

                                {unit.history?.slice().reverse().map((log, index, arr) => {
                                    const isActive = index === 0;
                                    return (
                                        <motion.div
                                            key={log.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.1 }}
                                            className="relative flex items-start"
                                        >
                                            {/* Node Container */}
                                            <div className="absolute -left-[17px] mt-1.5 flex flex-col items-center">
                                                <div className={`w-9 h-9 rounded-full flex items-center justify-center z-10 shadow-2xl transition-all duration-500 ring-4 ${isActive
                                                    ? 'bg-blue-600 border-4 border-white dark:border-slate-900 ring-blue-500/30 scale-110'
                                                    : 'bg-white dark:bg-slate-900 border-4 border-slate-200 dark:border-slate-800 ring-transparent'
                                                    }`}>
                                                    {React.cloneElement(getStageIcon(log.stage), {
                                                        size: 16,
                                                        className: isActive ? 'text-white' : 'text-slate-400'
                                                    })}
                                                </div>
                                            </div>

                                            <div className="flex-1 ml-10 group">
                                                <div className={`bg-white dark:bg-slate-900 p-6 rounded-3xl border-2 transition-all duration-500 shadow-sm hover:shadow-xl ${isActive
                                                    ? 'border-blue-500/50 shadow-blue-500/10 bg-gradient-to-br from-white to-blue-50/30 dark:from-slate-900 dark:to-blue-900/10'
                                                    : 'border-slate-100 dark:border-slate-800'
                                                    }`}>
                                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                                                        <div className="flex items-center gap-3">
                                                            <div className="space-y-1">
                                                                <h4 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight flex items-center gap-2">
                                                                    {log.stage}
                                                                    {isActive && <Badge color="blue" size="sm" className="ml-2 animate-pulse">LATEST</Badge>}
                                                                </h4>
                                                                <div className="flex items-center gap-2 text-slate-400 font-mono text-xs font-bold uppercase tracking-widest">
                                                                    <Clock size={12} />
                                                                    {format(new Date(log.timestamp), 'HH:mm • dd MMM yyyy')}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col items-end">
                                                            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
                                                                <UserIcon size={12} className="text-slate-400" />
                                                                <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                                                                    {log.scanned_by_name}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-6 border-t border-slate-100 dark:border-slate-800/50">
                                                        <div className="flex items-start gap-3">
                                                            <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-xl text-blue-500">
                                                                <MapPin size={18} />
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Process Area</p>
                                                                <p className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">
                                                                    {log.warehouse || 'Central Processing'}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {log.status && (
                                                            <div className="flex items-start gap-3">
                                                                <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl text-emerald-500">
                                                                    <CheckCircle2 size={18} />
                                                                </div>
                                                                <div>
                                                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Condition</p>
                                                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight uppercase tracking-wide">
                                                                        {log.status}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="flex items-start gap-3">
                                                            <div className="p-2 bg-amber-50 dark:bg-amber-500/10 rounded-xl text-amber-500">
                                                                <Tag size={18} />
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Reference</p>
                                                                <p className="text-sm font-mono font-bold text-slate-700 dark:text-slate-200 leading-tight">
                                                                    #{String(log.id || '').substring(0, 8).toUpperCase() || 'SYS-LOG'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Labels Section */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold flex items-center gap-2 px-2">
                                <Tag size={20} className="text-emerald-500" />
                                Associated Labels
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {unit.labels?.map((label) => (
                                    <Card key={label.id} className={`p-4 ${label.is_active ? 'border-emerald-500/30 bg-emerald-500/5' : 'opacity-60 border-slate-200'}`}>
                                        <div className="flex items-center justify-between mb-3">
                                            <Badge color={label.is_active ? 'emerald' : 'slate'}>{label.stage}</Badge>
                                            {label.is_active && <Badge color="emerald" className="ring-2 ring-emerald-500/20 ring-offset-1 ring-offset-white dark:ring-offset-slate-900">Active</Badge>}
                                        </div>
                                        <p className="font-mono font-black text-lg mb-1 leading-none">{label.barcode}</p>
                                        <p className="text-[10px] text-slate-400 uppercase font-black">Generated {format(new Date(label.created_at), 'HH:mm dd MMM yyyy')}</p>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}

                {!unit && !loading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="py-20 text-center space-y-4"
                    >
                        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Barcode size={40} className="text-slate-300" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-400">Ready to Scan</h3>
                        <p className="text-sm text-slate-500 max-w-sm mx-auto">Enter a valid barcode or RFID number to see its full status and tracking history.</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default UnitLookup;
