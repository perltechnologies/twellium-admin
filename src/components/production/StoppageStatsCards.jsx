import React, { useState } from 'react';
import { Clock, Activity, AlertTriangle, TrendingDown, Pause, Zap } from 'lucide-react';
import { Card } from '../ui';

const colorMap = {
    slate: { bg: 'bg-gray-50 dark:bg-gray-900/20', border: 'border-gray-200 dark:border-gray-800', text: 'text-gray-600 dark:text-gray-400', decorImg: '/img/icons/elemnt-01.svg' },
    red: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', text: 'text-red-600 dark:text-red-400', decorImg: '/img/icons/elemnt-04.svg' },
    orange: { bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800', text: 'text-orange-600 dark:text-orange-400', decorImg: '/img/icons/elemnt-03.svg' },
    blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-600 dark:text-blue-400', decorImg: '/img/icons/elemnt-01.svg' },
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-600 dark:text-emerald-400', decorImg: '/img/icons/elemnt-02.svg' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-600 dark:text-amber-400', decorImg: '/img/icons/elemnt-03.svg' }
};

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
                    const c = colorMap[stat.color] || colorMap.blue;
                    return (
                        <Card key={stat.label} className="relative overflow-hidden mb-0">
                            <div className="p-5 relative z-[1]">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-sm text-[#707070] dark:text-[#828997] mb-1">{stat.label}</p>
                                        <h2 className="text-base font-semibold text-[#1f2020] dark:text-[#d9dcff] mb-0">{stat.value}</h2>
                                    </div>
                                    <span className={`inline-flex items-center justify-center h-10 w-10 rounded-full ${c.bg} border ${c.border}`}>
                                        <Icon className={`h-4 w-4 ${c.text}`} />
                                    </span>
                                </div>
                            </div>
                            <img src={c.decorImg} alt="" className="absolute top-0 left-0 w-auto h-auto" />
                        </Card>
                    );
                })}
            </div>
        </div>
    );
};

export default StoppageStatsCards;
