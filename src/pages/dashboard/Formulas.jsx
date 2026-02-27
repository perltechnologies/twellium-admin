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
            description: "Measure of uptime and reliability.",
            formula: "\\frac{\\text{Planned Time} - \\text{Ext. Downtime}}{\\text{Planned Time}} \\times 100",
            variables: [
                {name: "Planned Time", desc: "Total Production Time (Hours)"},
                {name: "Ext. Downtime", desc: "External Downtime (converted to Hours)"}
            ]
        },
        {
            title: "Quality (%)",
            description: "Percentage of good units produced.",
            formula: "\\frac{\\text{Total Potential} - \\text{Waste}}{\\text{Total Potential}} \\times 100",
            variables: [
                {name: "Total Potential", desc: "Total Bottles Produced (or Total Packs × Bottles/Pack)"},
                {name: "Waste", desc: "Filler Rejects (from Meter Readings)"}
            ]
        },
        {
            title: "Performance (%)",
            description: "Speed relative to designed capacity.",
            formula: "\\frac{\\text{Filler Reading}}{\\text{Line Speed} \\times \\text{Total Hours}} \\times 100",
            variables: [
                {name: "Filler Reading", desc: "Meter Reading (Filler)"},
                {name: "Line Speed", desc: "Target Speed (BPH)"},
                {name: "Total Hours", desc: "Total Production Time (Hours)"}
            ]
        },
        {
            title: "OEE (%)",
            description: "Overall Equipment Effectiveness.",
            formula: "\\text{Availability} \\times \\text{Quality} \\times \\text{Performance}",
            variables: [
                {name: "Note", desc: "Calculated as the product of the three factors."}
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
                            <li className="breadcrumb-item"><Link to="/Dashboard">Home</Link></li>
                            <li className="breadcrumb-item active" aria-current="page">Formulas</li>
                        </ol>
                    </nav>
                </div>
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
