import React, { useState } from 'react';
import { Package, CheckCircle, Clock, XCircle, AlertCircle, Pause } from 'lucide-react';
import { Card } from '../ui';

const colorMap = {
    blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-600 dark:text-blue-400', decorImg: '/img/icons/elemnt-01.svg' },
    red: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', text: 'text-red-600 dark:text-red-400', decorImg: '/img/icons/elemnt-04.svg' },
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-600 dark:text-emerald-400', decorImg: '/img/icons/elemnt-02.svg' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-200 dark:border-purple-800', text: 'text-purple-600 dark:text-purple-400', decorImg: '/img/icons/elemnt-01.svg' },
    orange: { bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800', text: 'text-orange-600 dark:text-orange-400', decorImg: '/img/icons/elemnt-03.svg' },
    gray: { bg: 'bg-gray-50 dark:bg-gray-900/20', border: 'border-gray-200 dark:border-gray-800', text: 'text-gray-600 dark:text-gray-400', decorImg: '/img/icons/elemnt-01.svg' },
};

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
                <label className="text-sm font-medium text-[#707070] dark:text-[#828997]">Filter by Date:</label>
                <input 
                    type="date" 
                    value={selectedDate}
                    max={today}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="px-3 py-2 border border-[#e2e8f0] dark:border-[#161641] rounded-lg bg-white dark:bg-[#030318] text-[#1f2020] dark:text-[#d9dcff]"
                />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                {stats.map((stat) => {
                    const Icon = stat.icon;
                    const c = colorMap[stat.color] || colorMap.blue;
                    return (
                        <Card key={stat.label} className="relative overflow-hidden mb-0">
                            <div className="p-4 relative z-[1]">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-xs text-[#707070] dark:text-[#828997] mb-1">{stat.label}</p>
                                        <p className="text-base font-semibold text-[#1f2020] dark:text-[#d9dcff]">{stat.value}</p>
                                    </div>
                                    <span className={`inline-flex items-center justify-center h-8 w-8 rounded-full ${c.bg} border ${c.border}`}>
                                        <Icon className={`h-3.5 w-3.5 ${c.text}`} />
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

export default ProductionStatsCards;
