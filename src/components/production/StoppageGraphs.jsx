import React, { useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import { ChartWrapper } from '../ui';

const StoppageGraphs = ({ stoppages }) => {
    const graphData = useMemo(() => {
        // Downtime by PET
        const petDowntime = stoppages.reduce((acc, s) => {
            const pet = s.pet_name || 'Unknown';
            if (!acc[pet]) acc[pet] = 0;
            acc[pet] += s.downtime_minutes || 0;
            return acc;
        }, {});

        const downtimeByPet = Object.entries(petDowntime)
            .map(([pet, minutes]) => ({ name: pet, downtime: minutes }))
            .sort((a, b) => b.downtime - a.downtime)
            .slice(0, 10);

        // Daily downtime trend (last 7 days)
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (6 - i));
            return date.toISOString().split('T')[0];
        });

        const dailyData = last7Days.map(date => {
            const dayStoppages = stoppages.filter(s => s.log_date === date);
            return {
                date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                downtime: dayStoppages.reduce((sum, s) => sum + (s.downtime_minutes || 0), 0),
                stoppages: dayStoppages.length,
                avgEfficiency: dayStoppages.length > 0 
                    ? (dayStoppages.reduce((sum, s) => sum + (s.efficiency || 0), 0) / dayStoppages.length).toFixed(1)
                    : 0
            };
        });

        // Efficiency distribution
        const efficiencyRanges = { '0-50%': 0, '51-70%': 0, '71-85%': 0, '86-100%': 0 };
        stoppages.forEach(s => {
            const eff = s.efficiency || 0;
            if (eff <= 50) efficiencyRanges['0-50%']++;
            else if (eff <= 70) efficiencyRanges['51-70%']++;
            else if (eff <= 85) efficiencyRanges['71-85%']++;
            else efficiencyRanges['86-100%']++;
        });

        const efficiencyData = Object.entries(efficiencyRanges).map(([range, count]) => ({
            name: range,
            value: count
        }));

        return { downtimeByPet, dailyData, efficiencyData };
    }, [stoppages]);

    const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#10b981'];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartWrapper title="Daily Downtime Trend" chartId="daily-downtime-trend">
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={graphData.dailyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" stroke="#64748b" />
                        <YAxis stroke="#64748b" />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', color: '#ffffff', border: 'none', borderRadius: '8px' }} />
                        <Legend />
                        <Line type="monotone" dataKey="downtime" stroke="#ef4444" strokeWidth={2} name="Downtime (min)" />
                        <Line type="monotone" dataKey="stoppages" stroke="#f59e0b" strokeWidth={2} name="Stoppages" />
                    </LineChart>
                </ResponsiveContainer>
            </ChartWrapper>

            <ChartWrapper title="Efficiency Distribution" chartId="efficiency-distribution">
                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                        <Pie
                            data={graphData.efficiencyData}
                            cx="50%"
                            cy="50%"
                            labelLine={true}
                            label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                            outerRadius={90}
                            fill="#8884d8"
                            dataKey="value"
                        >
                            {graphData.efficiencyData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip 
                            contentStyle={{ 
                                backgroundColor: '#1e293b',
                                border: 'none',
                                borderRadius: '8px',
                                color: '#f1f5f9'
                            }}
                            formatter={(value) => [`${value} stoppages`, 'Count']}
                        />
                        <Legend 
                            verticalAlign="bottom" 
                            height={36}
                            formatter={(value, entry) => `${value}: ${entry.payload.value}`}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </ChartWrapper>

            <ChartWrapper title="Downtime by PET" chartId="downtime-by-pet" className="lg:col-span-2">
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={graphData.downtimeByPet}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" stroke="#64748b" angle={-45} textAnchor="end" height={100} />
                        <YAxis stroke="#64748b" />
                        <Tooltip contentStyle={{
                            backgroundColor: '#1e293b',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '8px'
                        }} />
                        <Bar dataKey="downtime" fill="#ef4444" name="Downtime (minutes)">
                            <LabelList dataKey="downtime" position="top" fill="#ef4444" />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </ChartWrapper>
        </div>
    );
};

export default StoppageGraphs;
