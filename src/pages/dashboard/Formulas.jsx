import React from 'react';
import { Link } from 'react-router-dom';
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';
import { Card, CardBody } from '../../components/ui';
import { Calculator, Info, TrendingUp, Target, Award, AlertCircle } from 'lucide-react';

const FormulaCard = ({title, description, formula, variables, icon: Icon, color}) => {
    return (
        <Card className="h-100 border-0 shadow-sm" style={{ transition: 'all 0.3s ease', borderRadius: '16px' }}>
            <CardBody className="p-4">
                <div className="d-flex align-items-center gap-3 mb-4">
                    <div className={`p-2.5 rounded-xl bg-${color}-100 dark:bg-${color}-900/20`}>
                        <Icon className={`h-5 w-5 text-${color}-600 dark:text-${color}-400`} />
                    </div>
                    <div>
                        <h5 className="mb-1 fw-semibold text-slate-900 dark:text-white">{title}</h5>
                        <p className="text-slate-500 dark:text-slate-400 small mb-0">{description}</p>
                    </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl mb-4 d-flex align-items-center justify-content-center overflow-auto" style={{minHeight: '100px'}}>
                    <div className="fs-6 text-slate-800 dark:text-slate-200">
                        <Latex>{`$$${formula}$$`}</Latex>
                    </div>
                </div>

                <div className="mt-auto">
                    <div className="d-flex align-items-center gap-2 small fw-semibold border-bottom border-slate-200 dark:border-slate-700 pb-2 mb-3 text-slate-700 dark:text-slate-300">
                        <Info className="h-4 w-4 text-primary" />
                        <span>Variable Mapping</span>
                    </div>
                    <div className="small text-slate-600 dark:text-slate-400">
                        {variables.map((v, idx) => (
                            <div key={idx} className="d-flex align-items-start gap-2 mb-2">
                                <span className="font-monospace badge bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 fw-normal">{v.name}</span>
                                <span>= {v.desc}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </CardBody>
        </Card>
    );
};

const Formulas = () => {
    const formulas = [
        {
            title: "Availability (%)",
            description: "Measure of uptime relative to unplanned loss time.",
            formula: "\\frac{\\text{Planned Time} - \\text{Total Downtime}}{\\text{Planned Time} - \\text{Mechanical Downtime}} \\times 100",
            variables: [
                {name: "Planned Time", desc: "Shift duration derived from report start_time → end_time (hours)"},
                {name: "Total Downtime", desc: "Sum of stoppage_logs[].downtime_minutes across all stoppages (converted to hours)"},
                {name: "Mechanical Downtime", desc: "Sum of incident_duration where downtime_category_name contains 'mechanical' (converted to hours)"}
            ],
            icon: TrendingUp,
            color: "blue"
        },
        {
            title: "Performance (%)",
            description: "Measure of speed loss during production.",
            formula: "\\frac{\\text{Planned Time} - \\text{Total Downtime}}{\\text{Planned Time} - \\text{Planned Downtime}} \\times 100",
            variables: [
                {name: "Planned Time", desc: "Shift duration derived from report start_time → end_time (hours)"},
                {name: "Total Downtime", desc: "Sum of stoppage_logs[].downtime_minutes across all stoppages (converted to hours)"},
                {name: "Planned Downtime", desc: "Sum of incident_duration where downtime_category_name contains 'planned' (converted to hours)"}
            ],
            icon: Target,
            color: "purple"
        },
        {
            title: "Quality (%)",
            description: "Percentage of good units out of total production.",
            formula: "\\frac{\\text{Total Production} - \\text{Filler Reject}}{\\text{Total Production}} \\times 100",
            variables: [
                {name: "Total Production", desc: "Sum of meter_readings[].filler_reading across all meter readings"},
                {name: "Filler Reject", desc: "Sum of meter_readings[].filler_rejects across all meter readings"}
            ],
            icon: Award,
            color: "green"
        },
        {
            title: "OEE (%)",
            description: "Overall Equipment Effectiveness — product of all three factors.",
            formula: "\\text{Availability} \\times \\text{Quality} \\times \\text{Performance}",
            variables: [
                {name: "Availability", desc: "Availability % ÷ 100"},
                {name: "Quality", desc: "Quality % ÷ 100"},
                {name: "Performance", desc: "Performance % ÷ 100"}
            ],
            icon: Calculator,
            color: "amber"
        }
    ];

    return (
        <div className="content pb-0">

            {/* Page Header */}
            <div className="d-flex align-items-center justify-content-between gap-2 mb-4 flex-wrap animate__animated animate__fadeInDown">
                <div>
                    <h4 className="mb-1 text-slate-900 dark:text-white">Production Formulas</h4>
                    <p className="text-slate-500 dark:text-slate-400 mb-0">Mathematical models used for OEE calculations</p>
                    <nav aria-label="breadcrumb">
                        <ol className="breadcrumb mb-0 p-0">
                            <li className="breadcrumb-item"><Link to="/dashboard" className="text-slate-500 hover:text-primary">Home</Link></li>
                            <li className="breadcrumb-item active text-slate-900 dark:text-white" aria-current="page">Formulas</li>
                        </ol>
                    </nav>
                </div>
            </div>

            {/* OEE Benchmark Legend */}
            <Card className="border-0 shadow-sm mb-4 animate__animated animate__fadeInUp">
                <CardBody className="py-3">
                    <div className="d-flex align-items-center justify-content-center gap-4 flex-wrap">
                        <span className="d-flex align-items-center gap-2 text-sm">
                            <span className="d-inline-flex">
                                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
                            </span>
                            <span className="text-slate-600 dark:text-slate-300"><strong className="text-slate-900 dark:text-white">≥ 85%</strong> — World Class</span>
                        </span>
                        <span className="d-flex align-items-center gap-2 text-sm">
                            <span className="d-inline-flex">
                                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }}></span>
                            </span>
                            <span className="text-slate-600 dark:text-slate-300"><strong className="text-slate-900 dark:text-white">60 – 84%</strong> — Acceptable</span>
                        </span>
                        <span className="d-flex align-items-center gap-2 text-sm">
                            <span className="d-inline-flex">
                                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }}></span>
                            </span>
                            <span className="text-slate-600 dark:text-slate-300"><strong className="text-slate-900 dark:text-white">&lt; 60%</strong> — Needs Improvement</span>
                        </span>
                    </div>
                </CardBody>
            </Card>

            {/* Formulas Grid */}
            <div className="row g-4 animate__animated animate__fadeInUp">
                {formulas.map((f, idx) => (
                    <div className="col-xxl-6 col-xl-6 col-md-6" key={idx}>
                        <FormulaCard {...f} />
                    </div>
                ))}
            </div>

        </div>
    );
};

export default Formulas;

