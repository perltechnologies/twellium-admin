import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui';
import {
    ArrowDownLeft,
    XCircle,
    CheckCircle2,
    ArrowUpRight,
    AlertTriangle,
    Warehouse as WarehouseIcon,
    ChevronRight
} from 'lucide-react';
import { motion } from 'framer-motion';

const WorkflowCard = ({ title, description, icon: Icon, color, targetStage, delay }) => {
    const navigate = useNavigate();
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: delay * 0.1 }}
        >
            <Card
                className="p-6 cursor-pointer hover:border-blue-500/50 shadow-sm hover:shadow-md transition-all group flex items-center justify-between"
                onClick={() => navigate('/post-production/batch-scan', { state: { targetStage, title } })}
            >
                <div className="flex items-center gap-6">
                    <div className={`p-4 rounded-2xl bg-${color}-100 dark:bg-${color}-500/10 text-${color}-600 dark:text-${color}-500 group-hover:scale-110 transition-transform`}>
                        <Icon size={32} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
                    </div>
                </div>
                <div className="p-2 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-400 group-hover:translate-x-1 group-hover:bg-blue-50 group-hover:text-blue-500 transition-all">
                    <ChevronRight size={20} />
                </div>
            </Card>
        </motion.div>
    );
};

const WarehouseWorkflows = () => {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-100 dark:bg-emerald-500/10 rounded-2xl">
                    <WarehouseIcon className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Warehouse Workflows</h1>
                    <p className="text-slate-500 dark:text-slate-400">Select a workflow to start batch processing units</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <WorkflowCard
                    title="Inbound Processing"
                    description="Receive finished pallets from production into the main warehouse."
                    icon={ArrowDownLeft}
                    color="blue"
                    targetStage="WAREHOUSE"
                    delay={1}
                />
                <WorkflowCard
                    title="Reject (Faulty)"
                    description="Mark units as faulty and move them to the inspection area."
                    icon={XCircle}
                    color="red"
                    targetStage="FAULTY"
                    delay={2}
                />
                <WorkflowCard
                    title="Restore (Qualified)"
                    description="Move inspected units back to available warehouse stock."
                    icon={CheckCircle2}
                    color="emerald"
                    targetStage="QUALIFIED"
                    delay={3}
                />
                <WorkflowCard
                    title="Ex-Warehouse"
                    description="Manage pallets and products transferred from other warehouses to this location."
                    icon={ArrowUpRight}
                    color="amber"
                    targetStage="EXTERNAL_WAREHOUSE"
                    delay={4}
                />
                <WorkflowCard
                    title="Damaged / Scrap"
                    description="Mark units as irreparably damaged for disposal or write-off."
                    icon={AlertTriangle}
                    color="slate"
                    targetStage="DAMAGED"
                    delay={5}
                />
            </div>
        </div>
    );
};

export default WarehouseWorkflows;
