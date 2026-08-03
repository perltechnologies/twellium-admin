import React from 'react';
import { useNavigate } from 'react-router-dom';

const workflows = [
    {
        title: 'Inbound',
        targetStage: 'WAREHOUSE',
        description: 'Transfer tagged pallets into storage',
        icon: 'ti-building-warehouse',
        color: 'primary'
    },
    {
        title: 'Reject',
        targetStage: 'FAULTY',
        description: 'Flag units for inspection',
        icon: 'ti-alert-triangle',
        color: 'danger'
    },
    {
        title: 'Restore',
        targetStage: 'QUALIFIED',
        description: 'Re-qualify inspected units',
        icon: 'ti-refresh',
        color: 'success'
    },
    {
        title: 'Ex-Warehouse',
        targetStage: 'EXTERNAL_WAREHOUSE',
        description: 'Transfer to external site',
        icon: 'ti-truck-delivery',
        color: 'warning'
    },
    {
        title: 'Damaged',
        targetStage: 'DAMAGED',
        description: 'Mark as non-conformant',
        icon: 'ti-alert-octagon',
        color: 'dark'
    }
];

const WarehouseWorkflows = () => {
    const navigate = useNavigate();

    const handleNavigate = (workflow) => {
        navigate('/post-production/batch-scan', {
            state: {
                targetStage: workflow.targetStage,
                title: workflow.title
            }
        });
    };

    return (
        <div className="container-fluid">
            {/* Page Header */}
            <div className="row mb-4">
                <div className="col-12">
                    <div className="d-flex align-items-center gap-3 mb-2">
                        <div className="bg-light rounded p-2">
                            <i className="ti ti-arrows-transfer-down fs-4 text-primary"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Warehouse Workflows</h4>
                            <p className="text-muted mb-0 fs-7">Select a workflow to begin batch scanning</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Workflow Cards */}
            <div className="row g-3">
                {workflows.map((workflow) => (
                    <div key={workflow.targetStage} className="col-md-6 col-lg-4">
                        <div
                            className="card h-100 border-0 shadow-sm"
                            style={{ cursor: 'pointer' }}
                            onClick={() => handleNavigate(workflow)}
                        >
                            <div className="card-body d-flex align-items-center gap-3">
                                <div className={`bg-soft-${workflow.color} rounded p-3`}>
                                    <i className={`ti ${workflow.icon} fs-3 text-${workflow.color}`}></i>
                                </div>
                                <div className="flex-grow-1">
                                    <h5 className="card-title mb-1">{workflow.title}</h5>
                                    <p className="text-muted mb-0 small">{workflow.description}</p>
                                </div>
                                <i className="ti ti-chevron-right text-muted"></i>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default WarehouseWorkflows;
