import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const GaugeChart = ({ value, label, color, max = 100 }) => {
    const data = [
        { name: 'Value', value: value },
        { name: 'Remaining', value: max - value },
    ];

    const startAngle = 180;
    const endAngle = 0;

    return (
        <div className="d-flex flex-column align-items-center p-3 border rounded-3 shadow-sm" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)' }}>
            <h6 className="mb-2 text-center fw-semibold">{label}</h6>
            <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                <defs>
                    <linearGradient id="gaugeGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={color} stopOpacity={0.8} />
                        <stop offset="100%" stopColor={color} stopOpacity={1} />
                    </linearGradient>
                </defs>
                <Pie
                    data={[{ value: max }]}
                    cx="50%"
                    cy="80%"
                    startAngle={startAngle}
                    endAngle={endAngle}
                    innerRadius="60%"
                    outerRadius="80%"
                    fill="#e0e0e0"
                    dataKey="value"
                    isAnimationActive={false}
                />
                <Pie
                    data={data}
                    cx="50%"
                    cy="80%"
                    startAngle={startAngle}
                    endAngle={endAngle}
                    innerRadius="60%"
                    outerRadius="80%"
                    fill="url(#gaugeGradient)"
                    paddingAngle={0}
                    dataKey="value"
                    isAnimationActive={true}
                    animationDuration={800}
                >
                    <Cell />
                    <Cell fill="none" />
                </Pie>
                <Tooltip formatter={(val) => [val.toFixed(2) + '%', label]} />
                <text x="50%" y="70%" textAnchor="middle" dominantBaseline="middle" fontSize="24px" fontWeight="bold">
                    {value.toFixed(2)}%
                </text>
            </PieChart>
        </ResponsiveContainer>
        </div>
    );
};

export default GaugeChart;
