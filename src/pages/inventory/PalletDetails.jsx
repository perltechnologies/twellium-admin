import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Badge, Button } from '../../components/ui';
import {
    ArrowLeft,
    Barcode,
    Smartphone,
    History,
    Clock,
    User,
    Warehouse,
    Truck,
    Package,
    MapPin,
    AlertCircle,
    CheckCircle2,
    Tag,
    Share2,
    Calendar,
    Layers
} from 'lucide-react';
import { inventoryApi } from '../../api/inventory';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

const PalletDetails = () => {
    const { identifier } = useParams();
    const navigate = useNavigate();
    const [unit, setUnit] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchDetails = async () => {
        setLoading(true);
        try {
            const res = await inventoryApi.getUnitStatus(identifier);
            if (res.data.status_code === 200 && res.data.data) {
                setUnit(res.data.data);
            } else {
                toast.error(res.data.message || "Unit details not found");
                navigate(-1);
            }
        } catch (error) {
            console.error('Error fetching unit details:', error);
            toast.error("Error retrieving pallet information");
            navigate(-1);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (identifier) fetchDetails();
    }, [identifier]);

    const getStageIcon = (stage) => {
        switch (stage?.toUpperCase()) {
            case 'PRODUCTION': return <Package className="text-indigo-500" />;
            case 'WAREHOUSE': return <Warehouse className="text-emerald-500" />;
            case 'LOADING': return <Truck className="text-blue-500" />;
            case 'DAMAGED': return <AlertCircle className="text-red-500" />;
            default: return <MapPin className="text-slate-500" />;
        }
    };

    if (loading) {
        return (
            <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-500 font-medium animate-pulse">Retrieving pallet intelligence...</p>
            </div>
        );
    }

    if (!unit) return null;

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-20">
            {/* Action Bar */}
            <div className="flex items-center justify-between">
                <Button 
                    variant="secondary" 
                    className="gap-2 rounded-2xl h-11 px-5 shadow-sm"
                    onClick={() => navigate(-1)}
                >
                    <ArrowLeft size={20} />
                    Back to List
                </Button>
                
                <div className="flex gap-2">
                    <Button variant="secondary" className="gap-2 rounded-2xl h-11 w-11 p-0">
                        <Share2 size={18} />
                    </Button>
                </div>
            </div>

            {/* Header / Hero Section */}
            <div className="relative">
                <div className="absolute inset-0 bg-blue-600 rounded-[2.5rem] rotate-1 opacity-10" />
                <div className="relative bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-2xl shadow-blue-500/5">
                    <div className="flex flex-col lg:flex-row gap-10 items-center">
                        {/* Status Avatar */}
                        <div className="relative group">
                            <div className="w-40 h-40 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800 rounded-[2rem] flex items-center justify-center border-2 border-dashed border-blue-200 dark:border-slate-700 transition-all group-hover:rotate-3">
                                <Package size={80} className="text-blue-500 group-hover:scale-110 transition-transform" />
                            </div>
                            <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-3 rounded-2xl shadow-xl ring-4 ring-white dark:ring-slate-900 animate-bounce cursor-default">
                                <CheckCircle2 size={24} />
                            </div>
                        </div>

                        {/* Core Info */}
                        <div className="flex-1 text-center lg:text-left space-y-4">
                            <div>
                                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 mb-3">
                                    <Badge color="blue" size="lg" className="rounded-full px-4 py-1 text-xs font-black tracking-widest uppercase">
                                        {unit.current_status || 'ACTIVE'}
                                    </Badge>
                                    <Badge color="emerald" size="lg" className="rounded-full px-4 py-1 text-xs font-black tracking-widest uppercase flex items-center gap-2">
                                        <Warehouse size={14} />
                                        {unit.current_warehouse_name || 'Main Stock'}
                                    </Badge>
                                </div>
                                <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight leading-tight">
                                    {unit.product_name}
                                </h1>
                                <p className="text-lg text-slate-500 font-medium">
                                    {unit.pet_name || 'Standard Production Line'} • {unit.quantity} Units per Pallet
                                </p>
                            </div>

                            <div className="flex flex-wrap justify-center lg:justify-start gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Main Barcode</p>
                                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-100 dark:border-slate-700">
                                        <Barcode size={18} className="text-blue-500" />
                                        <span className="font-mono font-black text-lg text-slate-900 dark:text-slate-100 tracking-wider">
                                            {unit.current_barcode || unit.barcode}
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Digital RFID Tag</p>
                                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-100 dark:border-slate-700">
                                        <Smartphone size={18} className="text-emerald-500" />
                                        <span className="font-mono font-black text-lg text-slate-900 dark:text-slate-100 tracking-wider">
                                            {unit.rfid_number || 'UNLINKED'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Grid Layout for Details */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Intelligence & Sidebar */}
                <div className="lg:col-span-1 space-y-8">
                    {/* Manufacturing Context */}
                    <Card className="p-8 border-none shadow-xl shadow-slate-200/50 dark:bg-slate-900 rounded-[2rem]">
                        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <Layers size={18} className="text-indigo-500" />
                            Production Context
                        </h3>
                        <div className="space-y-6">
                            <div className="flex items-start gap-4 p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100/50 dark:border-indigo-500/10">
                                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                    <Tag className="text-indigo-600" size={20} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-0.5">Internal System ID</p>
                                    <p className="font-bold text-slate-900 dark:text-slate-100">{unit.internal_id}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4 p-4 bg-amber-50/50 dark:bg-amber-900/10 rounded-2xl border border-amber-100/50 dark:border-amber-500/10">
                                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                    <Calendar className="text-amber-600" size={20} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-0.5">Creation Timestamp</p>
                                    <p className="font-bold text-slate-900 dark:text-slate-100">
                                        {unit.created_at ? format(new Date(unit.created_at), 'dd MMM yyyy, HH:mm') : 'N/A'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4 p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100/50 dark:border-blue-500/10">
                                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                    <User className="text-blue-600" size={20} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-0.5">Authorizing User</p>
                                    <p className="font-bold text-slate-900 dark:text-slate-100">{unit.created_by_name || 'System Auto-Gen'}</p>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Quick Stats Overlay */}
                    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2rem] p-8 text-white shadow-2xl overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-12 opacity-10 blur-xl bg-blue-500 rounded-full -mr-16 -mt-16" />
                        <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-4">Real-time Location</h4>
                        <div className="flex items-center gap-4 mb-8">
                            <div className="p-4 bg-white/10 rounded-3xl backdrop-blur-md">
                                <Warehouse size={32} />
                            </div>
                            <div>
                                <p className="text-2xl font-black leading-none mb-1">{unit.current_warehouse_name || 'In Warehouse'}</p>
                                <p className="text-blue-400/80 text-xs font-bold uppercase tracking-widest">Main Storage Area</p>
                            </div>
                        </div>
                        <div className="space-y-4 pt-6 border-t border-white/10">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-medium opacity-60">Status Latency</span>
                                <span className="text-xs font-black text-emerald-400 tracking-widest">MINIMAL</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-medium opacity-60">Last Sync</span>
                                <span className="text-xs font-black opacity-80 uppercase font-mono">NOW</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: History Timeline */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between px-4">
                        <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight flex items-center gap-3">
                            <History size={24} className="text-blue-500" />
                            Movement Architecture
                        </h3>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Total Points: {unit.history?.length || 0}
                        </div>
                    </div>

                    <div className="relative pl-8 space-y-6">
                        {/* The Spine */}
                        <div className="absolute left-[13px] top-4 bottom-4 w-1 bg-slate-100 dark:bg-slate-800 rounded-full" />

                        {unit.history?.slice().reverse().map((log, index) => {
                            const isLatest = index === 0;
                            return (
                                <motion.div 
                                    key={log.id || index}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    className="relative"
                                >
                                    {/* Indicator */}
                                    <div className={`absolute -left-[31px] top-6 w-9 h-9 rounded-2xl border-4 border-white dark:border-slate-950 flex items-center justify-center shadow-lg transition-all duration-500 z-10 ${
                                        isLatest ? 'bg-blue-600 scale-125 shadow-blue-500/20' : 'bg-slate-200 dark:bg-slate-800'
                                    }`}>
                                        {React.cloneElement(getStageIcon(log.stage), { 
                                            size: 16, 
                                            className: isLatest ? 'text-white' : 'text-slate-500' 
                                        })}
                                    </div>

                                    {/* Content Card */}
                                    <div className={`p-6 rounded-[2rem] border transition-all duration-500 shadow-sm hover:shadow-xl ${
                                        isLatest 
                                        ? 'bg-white dark:bg-slate-900 border-blue-500/30 ring-1 ring-blue-500/5' 
                                        : 'bg-white/50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800 opacity-60 grayscale hover:grayscale-0 hover:opacity-100'
                                    }`}>
                                        <div className="flex flex-col md:flex-row justify-between gap-4">
                                            <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <h4 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                                                        {log.stage}
                                                    </h4>
                                                    {isLatest && <Badge color="blue" size="sm" className="hidden md:flex animate-pulse">CURRENT</Badge>}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-4 text-slate-400 font-bold text-[10px] tracking-widest uppercase">
                                                    <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                                        <Clock size={12} className="text-blue-500" />
                                                        {format(new Date(log.timestamp), 'HH:mm • dd MMM yyyy')}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                                        <User size={12} className="text-indigo-500" />
                                                        {log.scanned_by_name}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="flex flex-col md:items-end justify-center">
                                                <div className="flex items-center gap-2 text-slate-500 font-medium">
                                                    <MapPin size={14} className="text-emerald-500" />
                                                    {log.warehouse || 'Processing Unit'}
                                                </div>
                                                {log.status && (
                                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                                                        Condition: <span className="text-slate-900 dark:text-slate-100">{log.status}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Labels Ecosystem */}
            {unit.labels?.length > 0 && (
                <div className="space-y-6">
                    <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight flex items-center gap-3 px-4">
                        <Tag size={24} className="text-emerald-500" />
                        Label Ecosystem
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {unit.labels.map((label) => (
                            <Card key={label.id} className={`p-6 rounded-3xl border-2 transition-all group hover:scale-[1.02] ${label.is_active ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-slate-100 dark:border-slate-800 opacity-60'}`}>
                                <div className="flex items-center justify-between mb-4">
                                    <Badge color={label.is_active ? 'emerald' : 'slate'}>{label.stage}</Badge>
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${label.is_active ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                        <Barcode size={24} />
                                    </div>
                                </div>
                                <div className="space-y-1 mb-4">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Scannable ID</p>
                                    <p className="text-xl font-mono font-black text-slate-900 dark:text-slate-100 tracking-tight">{label.barcode}</p>
                                </div>
                                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800/50">
                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                                        Gen: {format(new Date(label.created_at), 'dd MMM, HH:mm')}
                                    </div>
                                    {label.is_active && (
                                        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-black tracking-widest uppercase">
                                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                            Active
                                        </div>
                                    )}
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PalletDetails;
