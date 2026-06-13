import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, DataTable, Badge } from '../../components/ui';
import {
    Smartphone,
    Warehouse,
    Truck,
    History,
    Printer,
    PackageCheck,
    BarChart3,
    ArrowRight,
    Search,
    Barcode,
    CheckCircle2,
    AlertCircle,
    Package,
    Tag,
    Layers,
    RefreshCw,
    ClipboardList,
    AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { inventoryApi } from '../../api/inventory';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';

const StatCard = ({ title, value, subtext, icon: Icon, color, delay }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: delay * 0.1, duration: 0.5 }}
    >
        <Card className="p-6 h-full flex items-start justify-between hover:border-emerald-500/30 transition-colors group">
            <div>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">{title}</p>
                <h3 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">{value}</h3>
                {subtext && <p className="text-xs text-slate-500 dark:text-slate-400">{subtext}</p>}
            </div>
            <div className={`p-3 rounded-xl bg-${color}-100 dark:bg-${color}-500/10 text-${color}-600 dark:text-${color}-500 group-hover:bg-${color}-200 dark:group-hover:bg-${color}-500/20 transition-colors`}>
                <Icon className="h-6 w-6" />
            </div>
        </Card>
    </motion.div>
);


const NavCard = ({ title, description, icon: Icon, path, color }) => {
    const navigate = useNavigate();
    return (
        <Card
            className="p-6 hover:border-blue-500/50 cursor-pointer transition-all group relative overflow-hidden"
            onClick={() => navigate(path)}
        >
            <div className={`absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity`}>
                <Icon size={80} />
            </div>
            <div className={`p-3 w-fit rounded-lg bg-${color}-100 dark:bg-${color}-500/10 text-${color}-600 dark:text-${color}-500 mb-4`}>
                <Icon className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                {title}
                <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-blue-500" />
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
                {description}
            </p>
        </Card>
    );
};

const PostProductionDashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        new_pallets_produced: 0,
        total_units_active: 0,
        total_shipments_today: 0,
        stage_counts: {
            PRODUCTION: 0,
            WAREHOUSE: 0,
            FAULTY: 0,
            QUALIFIED: 0,
            EXTERNAL_WAREHOUSE: 0,
            DAMAGED: 0,
            LOADED: 0
        }
    });
    const [products, setProducts] = useState([]);
    const [recentActivities, setRecentActivities] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [overviewRes, countsRes] = await Promise.all([
                    inventoryApi.getTodayOverview(),
                    inventoryApi.getStageCounts()
                ]);
                
                const overviewData = overviewRes.data.data || {};
                const countsData = countsRes.data.data || {};

                setStats({
                    new_pallets_produced: overviewData.new_pallets_produced || 0,
                    total_units_active: countsData.total_units || overviewData.total_units_active || 0,
                    total_shipments_today: overviewData.total_shipments_today || 0,
                    stage_counts: countsData.stage_counts || {
                        PRODUCTION: 0,
                        WAREHOUSE: 0,
                        FAULTY: 0,
                        QUALIFIED: 0,
                        EXTERNAL_WAREHOUSE: 0,
                        DAMAGED: 0,
                        LOADED: 0
                    }
                });

                setProducts(countsData.product_breakdown || []);

                const logsRes = await inventoryApi.getActivityLogs({ page_size: 10 });
                setRecentActivities(logsRes.data.data || []);
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const activityColumns = [
        {
            header: 'Action', accessor: 'activity_type', render: (r) => (
                <span className="font-bold text-slate-900 dark:text-slate-100 uppercase text-[10px] tracking-widest bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                    {(r.activity_type || 'UNKNOWN').replace(/_/g, ' ')}
                </span>
            )
        },
        { header: 'Details', accessor: 'description', wrap: true },
        { header: 'User', accessor: 'performed_by_name' },
        { header: 'Time', accessor: 'timestamp', render: (r) => format(new Date(r.timestamp), 'HH:mm') },
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Post-Production Dashboard</h1>
                <p className="text-slate-500 dark:text-slate-400">Inventory flow and tracking overview</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    title="Pallets Produced Today"
                    value={stats.new_pallets_produced}
                    subtext="Successfully tagged and stored"
                    icon={PackageCheck}
                    color="emerald"
                    delay={1}
                />
                <StatCard
                    title="Active Units in System"
                    value={stats.total_units_active}
                    subtext="Total across all stages"
                    icon={BarChart3}
                    color="blue"
                    delay={2}
                />
                <StatCard
                    title="Recent Activities"
                    value={recentActivities.length}
                    subtext="Transactions in last 24h"
                    icon={History}
                    color="amber"
                    delay={3}
                />
            </div>

            {/* Deep Dive Call to Action */}
            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
            >
                <Card 
                    className="p-8 border-none bg-gradient-to-br from-blue-600 to-indigo-700 text-white relative overflow-hidden group cursor-pointer shadow-2xl rounded-[2.5rem]"
                    onClick={() => navigate('/post-production/overview')}
                >
                    <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:opacity-20 transition-opacity">
                        <BarChart3 size={160} />
                    </div>
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                        <div className="space-y-4 text-center md:text-left">
                            <h2 className="text-3xl font-black uppercase tracking-tight italic">Intelligence Overview</h2>
                            <p className="text-blue-100 max-w-md font-medium leading-relaxed">
                                Access the complete inventory matrix, product-level distribution, and detailed stage analytics in a unified high-resolution view.
                            </p>
                            <div className="flex items-center justify-center md:justify-start pt-2">
                                <button
                                    className="bg-white text-blue-600 hover:bg-blue-50 font-black px-8 py-4 rounded-2xl shadow-lg border-none flex items-center gap-3 transition-all transform hover:translate-x-2"
                                >
                                    Open Full Overview
                                    <ArrowRight size={20} />
                                </button>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="p-6 bg-white/10 backdrop-blur-md rounded-[2rem] border border-white/10 text-center min-w-[120px]">
                                <p className="text-2xl font-black">{products.length}</p>
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Active SKUs</p>
                            </div>
                            <div className="p-6 bg-white/10 backdrop-blur-md rounded-[2rem] border border-white/10 text-center min-w-[120px]">
                                <p className="text-2xl font-black">{stats.total_units_active}</p>
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Total Pallets</p>
                            </div>
                        </div>
                    </div>
                </Card>
            </motion.div>

            {/* Dashboard Actions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <NavCard
                    title="Lookup Units"
                    description="Detailed status and movement history timeline for any barcode or RFID."
                    icon={Search}
                    path="/post-production/lookup"
                    color="indigo"
                />
                <NavCard
                    title="Manage Stages"
                    description="Administrative control to see, add, update, and delete production stages."
                    icon={Layers}
                    path="/post-production/manage-stages"
                    color="amber"
                />
                <NavCard
                    title="Find Barcode"
                    description="Cross-reference a known RFID tag number to retrieve its active barcode."
                    icon={Barcode}
                    path="/post-production/find-barcode"
                    color="blue"
                />
                <NavCard
                    title="Find RFID"
                    description="Cross-reference a known barcode to retrieve its currently linked RFID tag."
                    icon={Smartphone}
                    path="/post-production/find-rfid"
                    color="emerald"
                />
            </div>

            {/* Recent Activity Table */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Recent Activities</h2>
                    <button
                        onClick={() => navigate('/post-production/activity-logs')}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
                    >
                        View All Logs
                        <ArrowRight className="h-4 w-4" />
                    </button>
                </div>
                <DataTable
                    columns={activityColumns}
                    data={recentActivities}
                    isLoading={loading}
                    pagination={null}
                />
            </div>
        </div>
    );
};

export default PostProductionDashboard;
