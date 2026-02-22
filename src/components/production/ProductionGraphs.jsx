import React, { useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import { Card } from '../ui';

const ProductionGraphs = ({ reports }) => {
    const graphData = useMemo(() => {
        // Status distribution
        const statusCounts = reports.reduce((acc, r) => {
            acc[r.status] = (acc[r.status] || 0) + 1;
            return acc;
        }, {});

        const statusData = Object.entries(statusCounts).map(([status, count]) => ({
            name: status,
            value: count
        }));

        // Daily production trend (last 7 days)
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (6 - i));
            return date.toISOString().split('T')[0];
        });

        const dailyData = last7Days.map(date => {
            const dayReports = reports.filter(r => r.production_date === date);
            const totalOutput = dayReports.reduce((sum, r) => sum + (r.total_bottles_produced || 0), 0);
            return {
                date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                output: totalOutput,
                reports: dayReports.length,
                completed: dayReports.filter(r => r.status === 'COMPLETED').length
            };
        });

        // Output per PET per day - Group by PET and show last 7 days
        const petOutputByDay = {};
        reports.forEach(r => {
            if (last7Days.includes(r.production_date)) {
                const pet = r.pet_name || 'Unknown';
                if (!petOutputByDay[pet]) {
                    petOutputByDay[pet] = {};
                    last7Days.forEach(d => petOutputByDay[pet][d] = 0);
                }
                petOutputByDay[pet][r.production_date] += r.total_bottles_produced || 0;
            }
        });

        const outputByPetDay = last7Days.map(date => {
            const dataPoint = {
                date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            };
            Object.keys(petOutputByDay).forEach(pet => {
                dataPoint[pet] = petOutputByDay[pet][date];
            });
            return dataPoint;
        });

        const petNames = Object.keys(petOutputByDay);
        const petColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'];

        return { statusData, dailyData, outputByPetDay, petNames, petColors };
    }, [reports]);

    const COLORS = {
        COMPLETED: '#10b981',
        STARTED: '#3b82f6',
        APPROVED: '#8b5cf6',
        DECLINED: '#ef4444',
        INCOMPLETE: '#f97316',
        IDLE: '#6b7280'
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Daily Production Trend</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={graphData.dailyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" stroke="#64748b" />
                        <YAxis 
                            yAxisId="left"
                            stroke="#64748b" 
                            tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value}
                        />
                        <YAxis 
                            yAxisId="right"
                            orientation="right"
                            stroke="#64748b"
                        />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f1f5f9' }}
                            formatter={(value, name) => {
                                if (name === 'Total Output') return [value.toLocaleString(), name];
                                return [value, name];
                            }}
                        />
                        <Legend />
                        <Line yAxisId="left" type="monotone" dataKey="output" stroke="#10b981" strokeWidth={3} name="Total Output" dot={{ r: 5 }} />
                        <Line yAxisId="right" type="monotone" dataKey="reports" stroke="#3b82f6" strokeWidth={2} name="Reports" dot={{ r: 4 }} />
                        <Line yAxisId="right" type="monotone" dataKey="completed" stroke="#8b5cf6" strokeWidth={2} name="Completed" dot={{ r: 4 }} />
                    </LineChart>
                </ResponsiveContainer>
            </Card>

            <Card className="p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Status Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                        <Pie
                            data={graphData.statusData}
                            cx="50%"
                            cy="50%"
                            labelLine={true}
                            label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                            outerRadius={85}
                            fill="#8884d8"
                            dataKey="value"
                        >
                            {graphData.statusData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[entry.name] || '#6b7280'} />
                            ))}
                        </Pie>
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#99b1d8', border: 'none', borderRadius: '8px', color: '#f1f5f9' }}
                            formatter={(value, name) => [`${value} reports`, name]}
                        />
                        <Legend 
                            verticalAlign="bottom" 
                            height={36}
                            formatter={(value, entry) => `${value}: ${entry.payload.value}`}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </Card>

            <Card className="p-6 lg:col-span-2">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Total Output per PET per Day</h3>
                <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={graphData.outputByPetDay} margin={{ left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" stroke="#64748b" />
                        <YAxis 
                            stroke="#64748b" 
                            width={60} 
                            tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value}
                            label={{ value: 'Bottles Produced', angle: -90, position: 'insideLeft', offset: -5, style: { fill: '#3b4e73', color: '#ffffff' } }}
                        />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#21385c', border: 'none', borderRadius: '8px', color: '#f1f5f9' }}
                            formatter={(value) => value.toLocaleString()}
                        />
                        <Legend />
                        {graphData.petNames.map((pet, index) => (
                            <Bar 
                                key={pet} 
                                dataKey={pet} 
                                stackId="output" 
                                fill={graphData.petColors[index % graphData.petColors.length]}
                            />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </Card>
        </div>
    );
};

export default ProductionGraphs;
