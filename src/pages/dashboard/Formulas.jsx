import React from 'react';
import { Link } from 'react-router-dom';
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';
import {Card} from '../../components/ui';
import {Calculator, Info} from 'lucide-react';

const FormulaCard = ({title, description, formula, variables}) => {
    return (
        <Card className="p-4 h-100 d-flex flex-column" >
            <div className="d-flex align-items-center gap-3 mb-4">
                <div className="p-2 bg-primary bg-opacity-10 rounded text-primary">
                    <Calculator size={20}/>
                </div>
                <div>
                    <h5 className="mb-1">{title}</h5>
                    <p className="text-muted small mb-0">{description}</p>
                </div>
            </div>

            <div className="bg-light p-4 rounded mb-4 d-flex align-items-center justify-content-center overflow-auto" style={{minHeight: '120px'}}>
                <div className="fs-5">
                    <Latex>{`$$${formula}$$`}</Latex>
                </div>
            </div>

            <div className="mt-auto">
                <div className="d-flex align-items-center gap-2 small fw-semibold border-bottom pb-2 mb-3">
                    <Info size={16} className="text-primary"/>
                    <span>Variable Mapping</span>
                </div>
                <div className="small text-muted">
                    {variables.map((v, idx) => (
                        <div key={idx} className="d-flex align-items-start gap-2 mb-2">
                            <span className="font-monospace badge bg-secondary">{v.name}</span>
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
            description: "Measure of uptime relative to unplanned loss time.",
            formula: "\\frac{\\text{Planned Time} - \\text{Total Downtime}}{\\text{Planned Time} - \\text{Mechanical Downtime}} \\times 100",
            variables: [
                {name: "Planned Time", desc: "Shift duration derived from report start_time → end_time (hours)"},
                {name: "Total Downtime", desc: "Sum of stoppage_logs[].downtime_minutes across all stoppages (converted to hours)"},
                {name: "Mechanical Downtime", desc: "Sum of incident_duration where downtime_category_name contains 'mechanical' (converted to hours)"}
            ]
        },
        {
            title: "Performance (%)",
            description: "Measure of speed loss during production.",
            formula: "\\frac{\\text{Planned Time} - \\text{Total Downtime}}{\\text{Planned Time} - \\text{Planned Downtime}} \\times 100",
            variables: [
                {name: "Planned Time", desc: "Shift duration derived from report start_time → end_time (hours)"},
                {name: "Total Downtime", desc: "Sum of stoppage_logs[].downtime_minutes across all stoppages (converted to hours)"},
                {name: "Planned Downtime", desc: "Sum of incident_duration where downtime_category_name contains 'planned' (converted to hours)"}
            ]
        },
        {
            title: "Quality (%)",
            description: "Percentage of good units out of total production.",
            formula: "\\frac{\\text{Total Production} - \\text{Filler Reject}}{\\text{Total Production}} \\times 100",
            variables: [
                {name: "Total Production", desc: "Sum of meter_readings[].filler_reading across all meter readings"},
                {name: "Filler Reject", desc: "Sum of meter_readings[].filler_rejects across all meter readings"}
            ]
        },
        {
            title: "OEE (%)",
            description: "Overall Equipment Effectiveness — product of all three factors.",
            formula: "\\text{Availability} \\times \\text{Quality} \\times \\text{Performance}",
            variables: [
                {name: "Availability", desc: "Availability % ÷ 100"},
                {name: "Quality", desc: "Quality % ÷ 100"},
                {name: "Performance", desc: "Performance % ÷ 100"}
            ]
        }
    ];

    return (
        <div className="content pb-0">

            <div className="d-flex align-items-center justify-content-between gap-2 mb-4 flex-wrap">
                <div>
                    <h4 className="mb-1">Production Formulas</h4>
                    <p className="text-muted">Mathematical models used for OEE calculations</p>
                    <nav aria-label="breadcrumb">
                        <ol className="breadcrumb mb-0 p-0">
                            <li className="breadcrumb-item"><Link to="/dashboard">Home</Link></li>
                            <li className="breadcrumb-item active" aria-current="page">Formulas</li>
                        </ol>
                    </nav>
                </div>
            </div>

            {/* OEE Benchmark Legend */}
            <div className="alert alert-light border d-flex align-items-center justify-content-center gap-4 mb-4 flex-wrap">
                <span className="d-flex align-items-center gap-2 fs-13">
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
                    <strong>≥ 85%</strong> — World Class
                </span>
                <span className="d-flex align-items-center gap-2 fs-13">
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }}></span>
                    <strong>60 – 84%</strong> — Acceptable
                </span>
                <span className="d-flex align-items-center gap-2 fs-13">
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }}></span>
                    <strong>&lt; 60%</strong> — Needs Improvement
                </span>
            </div>

            <div className="row">
                {formulas.map((f, idx) => (
                    <div className="col-xxl-6 col-xl-6 col-md-6 p-0" key={idx}>
                        <FormulaCard key={idx} {...f} />
                    </div>
                ))}
            </div>

        </div>
    );
};

export default Formulas;

