import React from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Activity, Clock } from 'lucide-react';
import GenericCrudPage from '../GenericCrudPage';
import { productionApi } from '../../../api/production';
import { StoppageStatsCards, StoppageGraphs } from '../../../components/production';

const StoppageLogList = () => {
    const navigate = useNavigate();
    const [pets, setPets] = React.useState([]);
    const [allStoppages, setAllStoppages] = React.useState([]);

    React.useEffect(() => {
        // Fetch Pets for filter
        const loadPets = async () => {
            try {
                const res = await productionApi.getPets({ page_size: 100 });
                const results = res.data.data || res.data.results || [];
                setPets(results.map(p => ({ label: p.pet_name || p.name, value: p.id })));
            } catch (err) {
                console.error("Failed to load filter options", err);
            }
        };
        
        // Fetch all stoppages for stats
        const loadAllStoppages = async () => {
            try {
                const res = await productionApi.getStoppages({ page_size: 1000 });
                const results = res.data.data || res.data.results || [];
                setAllStoppages(results);
            } catch (err) {
                console.error("Failed to load stoppages", err);
            }
        };
        
        loadPets();
        loadAllStoppages();
    }, []);

    const columns = [
        {
            header: 'Date',
            accessor: 'log_date',
            render: (row) => (
                <div className="flex flex-col">
                    <span className="font-medium text-slate-900 dark:text-slate-200">{format(new Date(row.log_date), 'MMM dd, yyyy')}</span>
                    <span className="text-xs text-slate-500">{format(new Date(`2000-01-01T${row.log_time}`), 'hh:mm a')}</span>
                </div>
            )
        },
        {
            header: 'Report',
            accessor: 'report_code',
            render: (row) => <span className="font-mono text-blue-600 dark:text-blue-400">{row.report_code}</span>
        },
        {
            header: 'PET',
            accessor: 'pet_name'
        },
        {
            header: 'Hour',
            accessor: 'hour_index',
            render: (row) => `Hour ${row.hour_index}`
        },
        {
            header: 'Efficiency',
            accessor: 'efficiency',
            render: (row) => (
                <div className="flex items-center gap-1.5">
                    <Activity className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                    <span>{row.efficiency}%</span>
                </div>
            )
        },
        {
            header: 'Downtime',
            accessor: 'downtime_minutes',
            render: (row) => (
                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                    <Clock className="h-3 w-3" />
                    <span>{row.downtime_minutes} min</span>
                </div>
            )
        },
        {
            header: 'Output',
            accessor: 'bottles_produced',
            render: (row) => row.bottles_produced?.toLocaleString()
        }
    ];

    const filters = [
        { name: 'log_date', label: 'Date', type: 'date' },
        { name: 'pet', label: 'PET', type: 'select', options: pets }
    ];

    return (
        <>
            <div className="mb-6">
                <StoppageStatsCards stoppages={allStoppages} />
            </div>
            <div className="mb-6">
                <StoppageGraphs stoppages={allStoppages} />
            </div>
            <GenericCrudPage
                title="Stoppage Logs"
                columns={columns}
                filters={filters}
                onAdd={() => navigate('/dashboard/production/stoppages/new')}
                onEdit={(item) => navigate(`/dashboard/production/stoppages/${item.id}/edit`)}
                onView={(item) => navigate(`/dashboard/production/stoppages/${item.id}`)}
                api={{
                    list: productionApi.getStoppages,
                    delete: productionApi.deleteStoppage
                }}
                searchPlaceholder="Search Stoppage Logs..."
            />
        </>
    );
};

export default StoppageLogList;
