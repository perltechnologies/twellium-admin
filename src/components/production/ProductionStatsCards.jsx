import React, { useState } from 'react';
import { Package, CheckCircle, Clock, XCircle, AlertCircle, Pause } from 'lucide-react';
import { Card } from '../ui';

const ProductionStatsCards = ({ reports }) => {
    const today = new Date().toISOString().split('T')[0];
    const [selectedDate, setSelectedDate] = useState(today);
    const todayReports = reports.filter(r => r.production_date === selectedDate);
    
    const totalPets = todayReports.length;
    const statusCounts = todayReports.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
    }, {});

    const stats = [
        { label: 'Total PETs Today', value: totalPets, icon: Package, color: 'blue' },
        { label: 'Completed', value: statusCounts.COMPLETED || 0, icon: CheckCircle, color: 'emerald' },
        { label: 'Started', value: statusCounts.STARTED || 0, icon: Clock, color: 'blue' },
        { label: 'Approved', value: statusCounts.APPROVED || 0, icon: CheckCircle, color: 'purple' },
        { label: 'Declined', value: statusCounts.DECLINED || 0, icon: XCircle, color: 'red' },
        { label: 'Incomplete', value: statusCounts.INCOMPLETE || 0, icon: AlertCircle, color: 'orange' },
        { label: 'Idle', value: statusCounts.IDLE || 0, icon: Pause, color: 'gray' }
    ];

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Filter by Date:</label>
                <input 
                    type="date" 
                    value={selectedDate}
                    max={today}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                {stats.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <Card key={stat.label} className="p-4">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg bg-${stat.color}-100 dark:bg-${stat.color}-500/10`}>
                                    <Icon className={`h-5 w-5 text-${stat.color}-600 dark:text-${stat.color}-400`} />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{stat.label}</p>
                                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stat.value}</p>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
};

export default ProductionStatsCards;
