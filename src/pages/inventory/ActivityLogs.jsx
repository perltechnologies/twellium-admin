import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, DataTable, Input, Select } from '../../components/ui';
import {
    History,
    Search,
    ArrowDownCircle,
    Settings,
    Clock,
    Barcode,
    Tag
} from 'lucide-react';
import { inventoryApi } from '../../api/inventory';
import { format } from 'date-fns';

const ActivityLogs = () => {
    const navigate = useNavigate();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [params, setParams] = useState({
        page: 1,
        page_size: 20,
        search: '',
        action_type: ''
    });

    useEffect(() => {
        const fetchLogs = async () => {
            setLoading(true);
            try {
                const res = await inventoryApi.getActivityLogs(params);
                setLogs(res.data.data || []);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, [params]);

    const columns = [
        {
            header: 'Action', accessor: 'activity_type', render: (r) => {
                const getIcon = () => {
                    const type = (r.activity_type || '').toLowerCase();
                    if (type.includes('barcode')) return <Barcode size={14} className="text-indigo-500" />;
                    if (type.includes('rfid')) return <Tag size={14} className="text-emerald-500" />;
                    if (type.includes('transition') || type.includes('move')) return <ArrowDownCircle size={14} className="text-blue-500" />;
                    return <Settings size={14} className="text-slate-400" />;
                };
                return (
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800">
                            {getIcon()}
                        </div>
                        <span className="font-bold text-slate-900 dark:text-slate-100 uppercase text-[11px] tracking-wider">
                            {(r.activity_type || 'UNKNOWN').replace(/_/g, ' ')}
                        </span>
                    </div>
                );
            }
        },
        {
            header: 'Unit ID',
            accessor: 'unit_internal_id',
            render: (r) => <span className="font-mono text-xs text-blue-500 font-bold">{r.unit_internal_id || r.unit_internal_id}</span>
        },
        {
            header: 'Description',
            accessor: 'description',
            wrap: true,
            render: (r) => <p className="text-slate-500 text-sm leading-relaxed">{r.description}</p>
        },
        {
            header: 'Operator', accessor: 'performed_by_name', render: (r) => (
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold">
                        {r.performed_by_name?.[0]}
                    </div>
                    <span className="text-sm font-medium">{r.performed_by_name}</span>
                </div>
            )
        },
        {
            header: 'Timestamp', accessor: 'timestamp', render: (r) => (
                <div className="flex flex-col items-end">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{format(new Date(r.timestamp), 'MMM dd, yyyy')}</span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock size={10} />
                        {format(new Date(r.timestamp), 'HH:mm:ss')}
                    </span>
                </div>
            )
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                        <History className="text-slate-600 dark:text-slate-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">Activity Logs</h1>
                        <p className="text-sm text-slate-500">Track every movement and transaction in the system</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                        <Input
                            placeholder="Search descriptions..."
                            className="pl-10 w-64"
                            value={params.search}
                            onChange={(e) => setParams({ ...params, search: e.target.value })}
                        />
                    </div>
                    <Select
                        className="w-48"
                        value={params.action_type}
                        onChange={(e) => setParams({ ...params, action_type: e.target.value })}
                    >
                        <option value="">All Actions</option>
                        <option value="PRODUCTION_GENERATE">Production</option>
                        <option value="WAREHOUSE_INBOUND">Warehouse In</option>
                        <option value="WAREHOUSE_OUTBOUND">Warehouse Out</option>
                        <option value="SHIPMENT_CREATE">Shipment</option>
                        <option value="UNIT_SCAN">Unit Scan</option>
                    </Select>
                </div>
            </div>

            <Card className="p-0 overflow-hidden">
                <DataTable
                    columns={columns}
                    data={logs}
                    isLoading={loading}
                    onView={(row) => navigate(`/post-production/activity-logs/${row.id}`)}
                />
            </Card>
        </div>
    );
};

export default ActivityLogs;
