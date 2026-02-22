import React, { useState } from 'react';
import { Clock, Activity, AlertTriangle, TrendingDown, Pause, Zap } from 'lucide-react';
import { Card } from '../ui';

const StoppageStatsCards = ({ stoppages }) => {
    const today = new Date().toISOString().split('T')[0];
    const [selectedDate, setSelectedDate] = useState(today);
    const filteredStoppages = stoppages.filter(s => s.log_date === selectedDate);
    
    const totalDowntime = filteredStoppages.reduce((sum, s) => sum + (s.downtime_minutes || 0), 0);
    const avgEfficiency = filteredStoppages.length > 0 
        ? (filteredStoppages.reduce((sum, s) => sum + (s.efficiency || 0), 0) / filteredStoppages.length).toFixed(1)
        : 0;
    const totalOutput = filteredStoppages.reduce((sum, s) => sum + (s.bottles_produced || 0), 0);
    const stoppageCount = filteredStoppages.length;
    const avgDowntime = stoppageCount > 0 ? (totalDowntime / stoppageCount).toFixed(1) : 0;
    const plannedDowntime = filteredStoppages.reduce((sum, s) => sum + (s.planned_downtime_minutes || 0), 0);

    const stats = [
        { label: 'Total Stoppages', value: stoppageCount, icon: Pause, color: 'slate' },
        { label: 'Total Downtime', value: `${totalDowntime} min`, icon: Clock, color: 'red' },
        { label: 'Avg Downtime', value: `${avgDowntime} min`, icon: TrendingDown, color: 'orange' },
        { label: 'Avg Efficiency', value: `${avgEfficiency}%`, icon: Activity, color: 'blue' },
        { label: 'Total Output', value: totalOutput.toLocaleString(), icon: Zap, color: 'emerald' },
        { label: 'Planned Downtime', value: `${plannedDowntime} min`, icon: AlertTriangle, color: 'amber' }
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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

export default StoppageStatsCards;
