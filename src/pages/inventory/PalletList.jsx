import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, DataTable, Badge, Button, Input } from '../../components/ui';
import {
    ArrowLeft,
    Package,
    Search,
    Filter,
    ArrowRight,
    Barcode,
    Smartphone,
    Warehouse,
    Truck,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Factory,
    Boxes,
    ArrowUpRight
} from 'lucide-react';
import { inventoryApi } from '../../api/inventory';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';

const STAGE_CONFIG = {
    PRODUCTION: { label: 'Production', color: 'blue', icon: Factory },
    WAREHOUSE: { label: 'Warehouse (Inbound)', color: 'indigo', icon: Warehouse },
    FAULTY: { label: 'Warehouse (Reject)', color: 'red', icon: AlertTriangle },
    QUALIFIED: { label: 'Warehouse (Restore)', color: 'emerald', icon: Boxes },
    EXTERNAL_WAREHOUSE: { label: 'Ex-Warehouse', color: 'amber', icon: ArrowUpRight },
    DAMAGED: { label: 'Damaged', color: 'slate', icon: AlertTriangle },
    LOADING: { label: 'Loading', color: 'sky', icon: Truck },
    LOADED: { label: 'Dispatched', color: 'blue', icon: Truck },
};

const PalletList = () => {
    const { stage } = useParams();
    const navigate = useNavigate();
    const [pallets, setPallets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [stats, setStats] = useState({ total_units: 0, total_quantity: 0 });

    const config = STAGE_CONFIG[stage?.toUpperCase()] || { label: stage, color: 'slate', icon: Package };

    const fetchPallets = async () => {
        setLoading(true);
        try {
            const res = await inventoryApi.getStageDetails({ 
                stage: stage?.toUpperCase(), 
                search: searchTerm 
            });
            // The API expectedly returns lists of units for that stage
            const data = res.data.data || [];
            setPallets(data);
            
            // Calculate simple stats
            const totalQty = data.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
            setStats({ total_units: data.length, total_quantity: totalQty });
        } catch (error) {
            console.error('Error fetching pallets:', error);
            toast.error("Failed to load pallets for this stage");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPallets();
    }, [stage]);

    const handleSearch = (e) => {
        e.preventDefault();
        fetchPallets();
    };

    const columns = [
        {
            header: 'Handling Unit',
            accessor: 'barcode',
            render: (r) => (
                <div className="flex flex-col">
                    <div className="flex items-center gap-2 group cursor-pointer" onClick={() => navigate(`/post-production/pallets/details/${r.current_barcode || r.rfid_number}`)}>
                        <Barcode size={14} className="text-slate-400" />
                        <span className="font-mono font-black text-slate-900 dark:text-slate-100 group-hover:text-blue-500 transition-colors">
                            {r.current_barcode || 'NO BARCODE'}
                        </span>
                    </div>
                    {r.rfid_number && (
                        <div className="flex items-center gap-2 mt-1">
                            <Smartphone size={12} className="text-slate-400" />
                            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-tight">
                                RFID: {r.rfid_number}
                            </span>
                        </div>
                    )}
                </div>
            )
        },
        {
            header: 'Product Details',
            accessor: 'product_name',
            render: (r) => (
                <div className="max-w-[200px]">
                    <p className="font-bold text-slate-900 dark:text-slate-100 truncate">{r.product_name || 'Unknown Product'}</p>
                    <p className="text-xs text-slate-500">{r.pet_name || 'Standard Line'}</p>
                </div>
            )
        },
        {
            header: 'Quantity',
            accessor: 'quantity',
            render: (r) => (
                <div className="flex items-baseline gap-1">
                    <span className="text-lg font-black text-slate-900 dark:text-slate-100">{r.quantity}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Pcs</span>
                </div>
            )
        },
        {
            header: 'Status',
            accessor: 'current_status',
            render: (r) => (
                <Badge color={config.color}>{r.current_status || stage}</Badge>
            )
        },
        {
            header: 'Last Scanned',
            accessor: 'updated_at',
            render: (r) => (
                <div className="flex items-center gap-2 text-slate-500">
                    <Clock size={14} />
                    <span className="text-xs font-medium">
                        {r.updated_at ? format(new Date(r.updated_at), 'MMM dd, HH:mm') : 'N/A'}
                    </span>
                </div>
            )
        },
        {
            header: '',
            accessor: 'id',
            render: (r) => (
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500"
                    onClick={() => navigate(`/post-production/pallets/details/${r.current_barcode || r.rfid_number}`)}
                >
                    <ArrowRight size={18} />
                </Button>
            )
        }
    ];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-4">
                    <Button 
                        variant="secondary" 
                        size="sm" 
                        className="rounded-xl p-2"
                        onClick={() => navigate(-1)}
                    >
                        <ArrowLeft size={20} />
                    </Button>
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl bg-${config.color}-100 dark:bg-${config.color}-500/10 text-${config.color}-600 dark:text-${config.color}-500`}>
                            <config.icon size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight leading-none mb-1">
                                {config.label}
                            </h1>
                            <p className="text-sm text-slate-500 font-medium">Browse and manage pallets currently in this stage</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Pallets</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-slate-100 leading-none">{stats.total_units}</p>
                    </div>
                    <div className="h-10 w-px bg-slate-100 dark:bg-slate-800" />
                    <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Pieces</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-slate-100 leading-none">{stats.total_quantity.toLocaleString()}</p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <Card className="p-4 border-none shadow-sm dark:bg-slate-900/50">
                <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-4">
                    <div className="relative flex-1 min-w-[300px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                        <Input
                            placeholder="Search by Barcode, RFID or Product..."
                            className="h-11 pl-10 bg-slate-50 dark:bg-slate-800 border-none rounded-xl"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button type="submit" className="h-11 px-6 rounded-xl gap-2">
                        <Filter size={18} />
                        Apply Filters
                    </Button>
                </form>
            </Card>

            {/* Table */}
            <Card className="p-0 overflow-hidden border-none shadow-xl dark:bg-slate-900">
                <DataTable
                    columns={columns}
                    data={pallets}
                    isLoading={loading}
                    emptyMessage={`No pallets found in ${config.label}.`}
                />
            </Card>
        </div>
    );
};

export default PalletList;
