import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    ArrowLeft, 
    Clock, 
    User, 
    Box, 
    ArrowRight, 
    Activity, 
    Info, 
    ExternalLink,
    Barcode as BarcodeIcon,
    Tag,
    MapPin,
    Terminal,
    AlertCircle,
    Loader2,
    History,
    Package
} from 'lucide-react';
import { Card, Button, Badge } from '../../components/ui';
import { inventoryApi } from '../../api/inventory';
import { format } from 'date-fns';

const ActivityLogDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [log, setLog] = useState(null);
    const [unitDetails, setUnitDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchLog = async () => {
            setLoading(true);
            try {
                const res = await inventoryApi.getActivityLog(id);
                if (res.data.status_code === 200) {
                    const logData = res.data.data;
                    setLog(logData);
                    
                    // Fetch extended unit details for the Intelligence section
                    const unitId = logData.unit_internal_id || logData.metadata?.barcode;
                    if (unitId) {
                        try {
                            const unitRes = await inventoryApi.getUnitStatus(unitId);
                            if (unitRes.data.status_code === 200) {
                                setUnitDetails(unitRes.data.data);
                            }
                        } catch (uErr) {
                            console.warn("Could not fetch extended unit intel", uErr);
                        }
                    }
                } else {
                    setError(res.data.message || "Log not found");
                }
            } catch (err) {
                console.error(err);
                setError("Failed to load activity log details");
            } finally {
                setLoading(false);
            }
        };
        fetchLog();
    }, [id]);

    if (loading) {
        return (
            <div className="h-[60vh] flex flex-col items-center justify-center gap-4 text-slate-500">
                <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                <p className="animate-pulse font-medium">Fetching activity details...</p>
            </div>
        );
    }

    if (error || !log) {
        return (
            <div className="h-[60vh] flex flex-col items-center justify-center gap-6 text-center px-4">
                <div className="p-4 bg-red-50 dark:bg-red-500/10 rounded-full text-red-500">
                    <AlertCircle size={48} />
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 italic">Access Denied or Not Found</h2>
                    <p className="text-slate-500 max-w-md mx-auto">
                        {error || "We couldn't retrieve the details for this specific activity log."}
                    </p>
                </div>
                <Button variant="secondary" onClick={() => navigate('/post-production/activity-logs')}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Logs
                </Button>
            </div>
        );
    }

    const { 
        activity_type, 
        unit_internal_id, 
        description, 
        performed_by_name, 
        timestamp, 
        metadata = {} 
    } = log;

    // Helper to determine if it's a transition
    const isTransition = (activity_type || '').includes('TRANSITION') || (activity_type || '').includes('MOVE');

    return (
        <div className="space-y-8 max-w-5xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Navigation & Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl" onClick={() => navigate('/post-production/activity-logs')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <Badge className="bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-black px-3 py-1 uppercase tracking-widest text-[10px]">
                                {activity_type?.replace(/_/g, ' ')}
                            </Badge>
                            <span className="text-slate-400 text-sm font-medium">#{id.substring(0, 8)}</span>
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Log Details</h1>
                    </div>
                </div>

                <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="p-2.5 bg-blue-50 dark:bg-blue-500/10 rounded-xl">
                        <Clock className="text-blue-500 h-5 w-5" />
                    </div>
                    <div className="pr-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Performed At</p>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                            {format(new Date(timestamp), 'HH:mm:ss • dd MMM yyyy')}
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content Area */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Visual Transition Card */}
                    {isTransition && (
                        <Card className="p-8 bg-gradient-to-br from-blue-600 to-indigo-700 border-none shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-125 transition-transform duration-1000" />
                            
                            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12 py-6">
                                <div className="text-center md:text-left space-y-4">
                                    <p className="text-blue-200 text-xs font-black uppercase tracking-[0.2em]">Source Stage</p>
                                    <div className="p-6 bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 min-w-[200px] shadow-lg">
                                        <h3 className="text-2xl font-black text-white uppercase tracking-tight">{metadata.from_stage || 'PRODUCTION'}</h3>
                                        <p className="text-blue-200 text-sm font-medium mt-1">Initial Location</p>
                                    </div>
                                </div>

                                <div className="flex flex-col items-center">
                                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-2xl animate-pulse">
                                        <ArrowRight className="text-blue-600 h-8 w-8" />
                                    </div>
                                    <div className="h-8 w-1 bg-white/20 rounded-full mt-4 md:hidden" />
                                </div>

                                <div className="text-center md:text-right space-y-4">
                                    <p className="text-blue-200 text-xs font-black uppercase tracking-[0.2em]">Destination Stage</p>
                                    <div className="p-6 bg-white rounded-3xl shadow-2xl min-w-[200px]">
                                        <h3 className="text-2xl font-black text-blue-800 uppercase tracking-tight">{metadata.to_stage || 'WAREHOUSE'}</h3>
                                        <p className="text-slate-400 text-sm font-medium mt-1">Target Location</p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 pt-8 border-t border-white/10 flex items-center gap-4 text-white/60">
                                <Info size={16} />
                                <p className="text-xs font-medium italic opacity-80 leading-relaxed max-w-lg">
                                    This movement was triggered by a {metadata.trigger_method || 'Manual Scan'} operation. {metadata.batch_mode ? 'Processed as part of a batch.' : 'Single unit processing.'}
                                </p>
                            </div>
                        </Card>
                    )}

                    {/* Transaction Insight (Improved Summary) */}
                    <Card className="p-8 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                            <Activity size={120} />
                        </div>
                        
                        <div className="relative z-10 space-y-8">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
                                    <Activity className="text-slate-500 h-5 w-5" />
                                </div>
                                <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Transaction Insight</h2>
                            </div>
                            
                            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border border-slate-100 dark:border-slate-800/50 ring-4 ring-slate-50 dark:ring-slate-900/50">
                                <p className="text-xl font-bold text-slate-700 dark:text-slate-200 leading-relaxed italic">
                                    "{description || "No detailed description available."}"
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100/50 dark:border-blue-500/10">
                                        <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                            <Terminal className="text-blue-600" size={18} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase mb-0.5">Execution Method</p>
                                            <p className="font-bold text-slate-900 dark:text-slate-100 uppercase">{metadata.trigger_method || 'System Process'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-4 bg-amber-50/50 dark:bg-amber-900/10 rounded-2xl border border-amber-100/50 dark:border-amber-500/10">
                                        <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                            <MapPin className="text-amber-600" size={18} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase mb-0.5">Physical Hub</p>
                                            <p className="font-bold text-slate-900 dark:text-slate-100">{metadata.location || 'Central Processing'}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 p-4 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100/50 dark:border-emerald-500/10">
                                        <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                            <Badge className="p-0 border-none bg-transparent">
                                                <Box className="text-emerald-600" size={18} />
                                            </Badge>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase mb-0.5">Units Impacted</p>
                                            <p className="font-bold text-slate-900 dark:text-slate-100">{metadata.quantity || '1 Pallet'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                                        <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                            <Activity className="text-slate-600" size={18} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase mb-0.5">Lifecycle Stage</p>
                                            <p className="font-bold text-slate-900 dark:text-slate-100 uppercase italic tracking-tighter">{metadata.to_stage || activity_type}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Unit Intelligence (Replaces System Metadata) */}
                    {unitDetails && (
                        <Card className="p-8 border-none bg-slate-900 text-white rounded-[2.5rem] shadow-2xl overflow-hidden relative group">
                            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -mr-32 -mt-32 group-hover:bg-blue-500/20 transition-colors duration-1000" />
                            
                            <div className="relative z-10 space-y-8">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-white/10 rounded-[1.2rem] backdrop-blur-md">
                                            <Info className="text-blue-400" size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black uppercase tracking-tight">Unit Intelligence</h3>
                                            <p className="text-blue-400/80 text-[10px] font-black uppercase tracking-widest mt-0.5">Extended Product Context</p>
                                        </div>
                                    </div>
                                    <Badge color="blue" className="px-3 py-1 font-black bg-blue-500/20 border-blue-500/30 text-blue-400">
                                        {unitDetails.current_warehouse_name || 'IN STORAGE'}
                                    </Badge>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div className="md:col-span-2 space-y-6">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Product SKU</p>
                                                <p className="text-sm font-bold truncate">TL-8923-AQ-908</p>
                                            </div>
                                            <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Brand Identity</p>
                                                <p className="text-sm font-bold truncate">{unitDetails.product_name || 'Premium Product Line'}</p>
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-4">
                                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                <History size={12} className="text-blue-500" />
                                                Recent Unit Trace (Last 3 Events)
                                            </h4>
                                            <div className="space-y-3">
                                                {unitDetails.history?.slice(0, 3).map((h, i) => (
                                                    <div key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 hover:border-white/20 transition-colors">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                                                        <div className="flex-1">
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-xs font-black uppercase tracking-tight">{h.stage}</span>
                                                                <span className="text-[10px] text-slate-500 font-mono">{format(new Date(h.timestamp), 'HH:mm • dd MMM')}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col justify-center items-center text-center p-8 bg-blue-600/20 rounded-[2rem] border border-blue-500/20">
                                        <div className="w-24 h-24 bg-blue-500/20 rounded-full flex items-center justify-center mb-4">
                                            <Package size={48} className="text-blue-400" />
                                        </div>
                                        <p className="text-3xl font-black leading-none">{unitDetails.quantity || '---'}</p>
                                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mt-2">Pallet Quantity</p>
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="mt-6 text-blue-400 hover:bg-blue-500/10 font-black text-[10px] uppercase tracking-widest gap-2"
                                            onClick={() => navigate(`/post-production/pallets/details/${unitDetails.barcode || unitDetails.rfid_number}`)}
                                        >
                                            Full Report
                                            <ArrowRight size={14} />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )}
                </div>

                {/* Right Sidebar - Actors & Related Objects */}
                <div className="space-y-6">
                    {/* Unit Involvement */}
                    <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 group overflow-hidden">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-xl text-blue-500">
                                    <Box size={20} />
                                </div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Affected Unit</h3>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Unit Internal ID</p>
                                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800/50 font-mono text-sm font-bold text-blue-500">
                                    {unit_internal_id || "NOT_ASSIGNED"}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div className="flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors">
                                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-400">
                                        <BarcodeIcon size={16} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase">Barcode</p>
                                        <p className="text-xs font-bold font-mono">{metadata.barcode || "---"}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors">
                                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-400">
                                        <Tag size={16} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase">RFID Tag</p>
                                        <p className="text-xs font-bold font-mono">{metadata.rfid_number || "---"}</p>
                                    </div>
                                </div>
                            </div>

                            <Button 
                                className="w-full h-11 bg-slate-900 dark:bg-slate-800 hover:bg-black text-white group-hover:translate-y-[-2px] transition-all rounded-xl shadow-lg"
                                onClick={() => navigate('/post-production/lookup', { state: { searchValue: unit_internal_id || metadata.barcode } })}
                            >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Inspect in Unit Lookup
                            </Button>
                        </div>
                    </Card>

                    {/* Operator Info */}
                    <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl text-emerald-500">
                                <User size={20} />
                            </div>
                            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Operator</h3>
                        </div>
                        
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center text-xl font-black text-white shadow-lg">
                                {performed_by_name?.[0].toUpperCase()}
                            </div>
                            <div>
                                <h4 className="text-lg font-black">{performed_by_name}</h4>
                                <p className="text-xs text-slate-500 font-medium">Digital Signature Verified</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between text-xs py-2 border-b border-slate-100 dark:border-slate-800 cursor-help" title="Digital identifier for the operator">
                                <span className="text-slate-400 font-medium uppercase tracking-widest">Employee Ref</span>
                                <span className="font-bold text-slate-700 dark:text-slate-300">#E-00129</span>
                            </div>
                            <div className="flex items-center justify-between text-xs py-2">
                                <span className="text-slate-400 font-medium uppercase tracking-widest">Authority Level</span>
                                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-500 border-none text-[8px] font-black">PRIVILEGED</Badge>
                            </div>
                        </div>
                    </Card>

                    {/* Audit Info */}
                    <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/30 border-2 border-dashed border-slate-200 dark:border-slate-800/50">
                        <div className="flex items-center gap-3 mb-4">
                            <MapPin className="text-slate-400 h-4 w-4" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Transaction Trace</p>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="w-1 h-1 bg-slate-300 rounded-full" />
                                <span className="text-[10px] font-mono text-slate-500">IP: 192.168.10.144</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-1 h-1 bg-slate-300 rounded-full" />
                                <span className="text-[10px] font-mono text-slate-500">Session: {metadata.session_id || '9823-X12-00'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-1 h-1 bg-slate-300 rounded-full" />
                                <span className="text-[10px] font-mono text-slate-500">Node: PRODUCTION-01</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ActivityLogDetails;
