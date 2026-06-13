import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
    LayoutDashboard, 
    Activity, 
    Package, 
    ArrowRight, 
    Truck, 
    Warehouse, 
    Factory, 
    AlertTriangle,
    Boxes,
    BarChart3,
    ArrowUpRight,
    Search,
    Filter
} from 'lucide-react';
import { Card, Button, Badge } from '../../components/ui';
import { inventoryApi } from '../../api/inventory';

const STAGE_CONFIG = [
    { id: 'PRODUCTION', title: 'Production', icon: Factory, color: 'blue', description: 'Newly tagged pallets' },
    { id: 'WAREHOUSE', title: 'Warehouse (Inbound)', icon: Warehouse, color: 'indigo', description: 'Transferred and stored' },
    { id: 'FAULTY', title: 'Warehouse (Reject)', icon: AlertTriangle, color: 'red', description: 'Units requiring inspection' },
    { id: 'QUALIFIED', title: 'Warehouse (Restore)', icon: Boxes, color: 'emerald', description: 'Inspected and approved' },
    { id: 'EXTERNAL_WAREHOUSE', title: 'Ex-Warehouse', icon: ArrowUpRight, color: 'amber', description: 'External transfers' },
    { id: 'DAMAGED', title: 'Damaged', icon: AlertTriangle, color: 'slate', description: 'Non-conformant units' },
    { id: 'LOADING', title: 'Loading', icon: Truck, color: 'sky', description: 'On staging area' },
    { id: 'LOADED', title: 'Dispatched', icon: Truck, color: 'blue', description: 'Sent to customers' }
];

const InventoryOverview = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        stage_counts: {},
        total_units: 0
    });
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await inventoryApi.getStageCounts();
                if (res.data.status_code === 200) {
                    setStats({
                        stage_counts: res.data.data.stage_counts,
                        total_units: res.data.data.total_units
                    });
                    setProducts(res.data.data.product_breakdown || []);
                }
            } catch (error) {
                console.error("Failed to fetch stage counts", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-12 pb-20">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-blue-600 font-black uppercase tracking-widest text-[10px]">
                        <Activity size={14} />
                        Live Intelligence
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Inventory Distribution</h1>
                    <p className="text-slate-500 dark:text-slate-400 max-w-2xl font-medium">
                        Real-time visualization of pallet movement across all operational stages and product categories.
                    </p>
                </div>
                
                <div className="p-1 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center gap-6 shadow-sm">
                    <div className="text-center py-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Global Units</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{stats.total_units}</p>
                    </div>
                    <div className="w-px h-8 bg-slate-200 dark:bg-slate-800" />
                    <div className="text-center py-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Active SKUs</p>
                        <p className="text-2xl font-black text-blue-600">{products.length}</p>
                    </div>
                </div>
            </div>

            {/* Stage Distribution Grid */}
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-500/20 text-blue-600 rounded-xl">
                        <LayoutDashboard size={20} />
                    </div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Stage Architecture</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {STAGE_CONFIG.map((stage, idx) => (
                        <motion.div
                            key={stage.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                        >
                            <Card 
                                className="group relative overflow-hidden p-6 hover:shadow-2xl hover:border-blue-500/50 cursor-pointer transition-all duration-300"
                                onClick={() => navigate(`/post-production/pallets/${stage.id}`)}
                            >
                                <div className={`absolute top-0 right-0 w-32 h-32 bg-${stage.color}-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform`} />
                                
                                <div className="relative z-10 flex justify-between items-start">
                                    <div className={`p-4 bg-${stage.color}-50 dark:bg-${stage.color}-500/10 text-${stage.color}-600 dark:text-${stage.color}-400 rounded-2xl group-hover:bg-blue-500 group-hover:text-white transition-colors`}>
                                        <stage.icon size={24} />
                                    </div>
                                    <div className="text-right">
                                        <p className="text-3xl font-black text-slate-900 dark:text-slate-100">{stats.stage_counts[stage.id] || 0}</p>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Pallets</p>
                                    </div>
                                </div>
                                
                                <div className="mt-6 relative z-10">
                                    <h3 className="font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight group-hover:text-blue-600 transition-colors flex items-center gap-2">
                                        {stage.title}
                                        <ArrowRight size={14} className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-blue-500" />
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">{stage.description}</p>
                                </div>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Product Distribution Matrix */}
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 rounded-xl">
                            <Package size={20} />
                        </div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Product Matrix</h2>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
                            <input 
                                type="text"
                                placeholder="Search SKUs..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all w-64 shadow-sm"
                            />
                        </div>
                        <Button variant="outline" size="sm" className="rounded-xl border-slate-200 dark:border-slate-800 gap-2">
                            <Filter size={16} />
                            Filter
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredProducts.map((product, idx) => (
                        <motion.div
                            key={product.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.03 }}
                        >
                            <Card className="h-full flex flex-col p-6 border-slate-200 dark:border-slate-800/50 hover:border-emerald-500/30 transition-all group overflow-hidden relative">
                                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Package size={80} />
                                </div>

                                <div className="flex justify-between items-start mb-6">
                                    <div className="space-y-1">
                                        <Badge variant="outline" className="text-[9px] font-black border-slate-200 dark:border-slate-800 tracking-tighter uppercase px-2 py-0.5">
                                            SKU: {String(product.id).padStart(4, '0')}
                                        </Badge>
                                        <h3 className="font-black text-slate-900 dark:text-slate-100 text-lg leading-tight line-clamp-2 pr-4 uppercase italic tracking-tighter">
                                            {product.name}
                                        </h3>
                                    </div>
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl group-hover:bg-emerald-500 group-hover:text-white transition-all transform group-hover:rotate-6">
                                        <p className="text-xl font-black leading-none">{product.total_count}</p>
                                        <p className="text-[7px] font-black uppercase tracking-widest mt-1 text-center opacity-70">Total</p>
                                    </div>
                                </div>

                                <div className="flex-1 space-y-3 mt-auto">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2 mb-4">Stage Distribution</p>
                                    {STAGE_CONFIG.map(stage => {
                                        const count = product.stages[stage.id] || 0;
                                        return (
                                            <div key={stage.id} className={`flex items-center justify-between p-2 rounded-xl border border-transparent transition-all ${count > 0 ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800' : 'opacity-40'}`}>
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-1.5 h-1.5 rounded-full bg-${stage.color}-500 shadow-[0_0_8px_rgba(59,130,246,0.3)]`} />
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight">{stage.title}</span>
                                                </div>
                                                <span className={`text-[10px] font-black ${count > 0 ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400'}`}>
                                                    {count}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>

                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="w-full mt-6 text-[10px] font-black uppercase tracking-widest gap-2 bg-slate-50 dark:bg-slate-800 hover:bg-emerald-500 hover:text-white border-none rounded-xl py-5 transition-all"
                                >
                                    Detailed Analytics
                                    <ArrowUpRight size={14} />
                                </Button>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default InventoryOverview;
