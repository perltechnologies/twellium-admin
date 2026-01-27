import React from 'react';
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';
import { Card } from '../../components/ui';
import { Calculator, Info } from 'lucide-react';

const FormulaCard = ({ title, description, formula, variables }) => {
    return (
        <Card className="p-6 h-full flex flex-col hover:border-blue-500/30 transition-colors">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                    <Calculator className="h-5 w-5" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
                </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl mb-6 flex items-center justify-center min-h-[120px] overflow-x-auto">
                <div className="text-lg text-slate-800 dark:text-slate-200">
                    <Latex>{`$$${formula}$$`}</Latex>
                </div>
            </div>

            <div className="mt-auto space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-2">
                    <Info className="h-4 w-4 text-blue-500" />
                    <span>Variable Mapping</span>
                </div>
                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                    {variables.map((v, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                            <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300 mt-0.5">
                                {v.name}
                            </span>
                            <span>= {v.desc}</span>
                        </div>
                    ))}
                </div>
            </div>
        </Card>
    );
};

const Formulas = () => {
    const formulas = [
        {
            title: "Availability (%)",
            description: "Measure of uptime and reliability.",
            formula: "\\frac{\\text{Planned Time} - \\text{Ext. Downtime}}{\\text{Planned Time}} \\times 100",
            variables: [
                { name: "Planned Time", desc: "Total Production Time (Hours)" },
                { name: "Ext. Downtime", desc: "External Downtime (converted to Hours)" }
            ]
        },
        {
            title: "Quality (%)",
            description: "Percentage of good units produced.",
            formula: "\\frac{\\text{Total Potential} - \\text{Waste}}{\\text{Total Potential}} \\times 100",
            variables: [
                { name: "Total Potential", desc: "Total Bottles Produced (or Total Packs × Bottles/Pack)" },
                { name: "Waste", desc: "Filler Rejects (from Meter Readings)" }
            ]
        },
        {
            title: "Performance (%)",
            description: "Speed relative to designed capacity.",
            formula: "\\frac{\\text{Filler Reading}}{\\text{Line Speed} \\times \\text{Total Hours}} \\times 100",
            variables: [
                { name: "Filler Reading", desc: "Meter Reading (Filler)" },
                { name: "Line Speed", desc: "Target Speed (BPH)" },
                { name: "Total Hours", desc: "Total Production Time (Hours)" }
            ]
        },
        {
            title: "OEE (%)",
            description: "Overall Equipment Effectiveness.",
            formula: "\\text{Availability} \\times \\text{Quality} \\times \\text{Performance}",
            variables: [
                { name: "Note", desc: "Calculated as the product of the three factors." }
            ]
        }
    ];

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Production Formulas</h1>
                    <p className="text-slate-500 dark:text-slate-400">Mathematical models used for OEE calculations</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {formulas.map((f, idx) => (
                    <FormulaCard key={idx} {...f} />
                ))}
            </div>
        </div>
    );
};

export default Formulas;
