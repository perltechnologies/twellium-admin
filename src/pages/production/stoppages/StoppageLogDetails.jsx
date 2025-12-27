import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Activity, FileText, AlertTriangle, Layers, User } from 'lucide-react';
import { Button, Card, DataTable } from '../../../components/ui';
import { productionApi } from '../../../api/production';

const DetailRow = ({ label, value }) => (
    <div className="flex flex-col py-2 border-b border-slate-800/50 last:border-0">
        <span className="text-slate-500 text-xs uppercase tracking-wider">{label}</span>
        <span className="text-slate-200 font-medium mt-1">{value !== null && value !== undefined ? value : '-'}</span>
    </div>
);

const StoppageLogDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [log, setLog] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLog = async () => {
            try {
                const res = await productionApi.getStoppage(id);
                setLog(res.data.data);
            } catch (err) {
                console.error("Failed to load stoppage log", err);
            } finally {
                setLoading(false);
            }
        };
        fetchLog();
    }, [id]);

    if (loading) return <div className="p-8 text-center text-slate-500">Loading details...</div>;
    if (!log) return <div className="p-8 text-center text-red-400">Log not found</div>;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={() => navigate('/dashboard/production/stoppages')}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to List
                </Button>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => navigate(`/dashboard/production/stoppages/${id}/edit`)}>
                        Edit Log
                    </Button>
                </div>
            </div>

            <div className="flex items-center gap-4 mb-2">
                <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                    <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-100">
                        Stoppage Log #{log.id}
                    </h1>
                    <p className="text-slate-400 text-sm">
                        {new Date(log.log_date).toLocaleDateString()} • Hour {log.hour_index}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card className="p-5 border-slate-800 bg-slate-900/50">
                    <div className="flex items-center gap-2 mb-4 text-blue-400">
                        <FileText className="h-4 w-4" />
                        <h3 className="text-sm font-bold uppercase tracking-wider">Report Info</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                        <DetailRow label="Report Code" value={log.report_code} />
                        <DetailRow label="PET Name" value={log.pet_name} />
                        <DetailRow label="Created By" value={log.created_by?.full_name || log.created_by?.username} />
                    </div>
                </Card>

                <Card className="p-5 border-slate-800 bg-slate-900/50">
                    <div className="flex items-center gap-2 mb-4 text-indigo-400">
                        <Activity className="h-4 w-4" />
                        <h3 className="text-sm font-bold uppercase tracking-wider">Performance</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                        <DetailRow label="Efficiency" value={`${log.efficiency}%`} />
                        <DetailRow label="Bottles Produced" value={log.bottles_produced?.toLocaleString()} />
                        <DetailRow label="Downtime" value={`${log.downtime_minutes} min`} />
                    </div>
                </Card>

                <Card className="p-5 border-slate-800 bg-slate-900/50">
                    <div className="flex items-center gap-2 mb-4 text-emerald-400">
                        <User className="h-4 w-4" />
                        <h3 className="text-sm font-bold uppercase tracking-wider">Details</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                        <DetailRow label="Comments" value={log.comments || 'No comments'} />
                        <DetailRow label="Log Time" value={log.log_time} />
                    </div>
                </Card>
            </div>

            <Card className="border-slate-800 bg-slate-900/50">
                <div className="p-4 border-b border-slate-800">
                    <h3 className="font-bold text-slate-200">Incidents</h3>
                </div>
                <div className="p-4">
                    {log.incidents && log.incidents.length > 0 ? (
                        <DataTable
                            columns={[
                                { header: 'ID', accessor: 'id' },
                                { header: 'Description', accessor: 'incident_description' }
                            ]}
                            data={log.incidents}
                            isLoading={false}
                        />
                    ) : (
                        <p className="text-slate-500 text-center py-4">No incidents recorded</p>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default StoppageLogDetails;
