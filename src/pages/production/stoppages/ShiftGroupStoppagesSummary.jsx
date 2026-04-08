import React, { useState, useEffect } from 'react';
import { productionApi } from '../../../api/production';

const ShiftGroupStoppagesSummary = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await productionApi.getShiftGroupStoppagesSummary({
                    start_datetime: '2026-03-07T06:00:00Z',
                    end_datetime: '2026-04-08T06:00:59Z'
                });
                setData(res.data);
            } catch (error) {
                console.error('Failed to fetch shift group stoppages summary', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) return <div>Loading...</div>;
    if (!data) return <div>No data available</div>;

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">Shift Group Stoppages Summary</h2>
            <pre className="bg-gray-100 p-4 rounded overflow-auto">
                {JSON.stringify(data, null, 2)}
            </pre>
        </div>
    );
};

export default ShiftGroupStoppagesSummary;
