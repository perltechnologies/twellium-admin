import React, { useState } from 'react';
import { Package, CheckCircle, Clock, XCircle, AlertCircle, Pause } from 'lucide-react';

const colorMap = {
    primary: { bg: 'var(--primary-transparent)', border: 'var(--primary)', text: 'var(--primary)', decorImg: '/img/icons/elemnt-01.svg' },
    success: { bg: 'var(--success-transparent)', border: 'var(--success)', text: 'var(--success)', decorImg: '/img/icons/elemnt-02.svg' },
    warning: { bg: 'var(--warning-transparent)', border: 'var(--warning)', text: 'var(--warning)', decorImg: '/img/icons/elemnt-03.svg' },
    danger: { bg: 'var(--danger-transparent)', border: 'var(--danger)', text: 'var(--danger)', decorImg: '/img/icons/elemnt-04.svg' },
    info: { bg: 'var(--info-transparent)', border: 'var(--info)', text: 'var(--info)', decorImg: '/img/icons/elemnt-01.svg' },
    indigo: { bg: 'var(--indigo-transparent)', border: 'var(--indigo)', text: 'var(--indigo)', decorImg: '/img/icons/elemnt-01.svg' },
    purple: { bg: 'var(--purple-transparent)', border: 'var(--purple)', text: 'var(--purple)', decorImg: '/img/icons/elemnt-01.svg' },
    orange: { bg: 'var(--orange-transparent)', border: 'var(--orange)', text: 'var(--orange)', decorImg: '/img/icons/elemnt-03.svg' },
    teal: { bg: 'var(--teal-transparent)', border: 'var(--teal)', text: 'var(--teal)', decorImg: '/img/icons/elemnt-02.svg' },
};

const ProductionStatsCards = ({ reports }) => {
    const today = new Date().toISOString().split('T')[0];
    const [selectedDate, setSelectedDate] = useState(today);
    const todayReports = reports.filter(r => r.production_date === selectedDate);
    
    const totalPets = todayReports.length;
    const statusCounts = todayReports.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
    }, {});

    const stats = [
        { label: 'Total PETs Today', value: totalPets, icon: Package, color: 'primary' },
        { label: 'Completed', value: statusCounts.COMPLETED || 0, icon: CheckCircle, color: 'success' },
        { label: 'Started', value: statusCounts.STARTED || 0, icon: Clock, color: 'info' },
        { label: 'Approved', value: statusCounts.APPROVED || 0, icon: CheckCircle, color: 'purple' },
        { label: 'Declined', value: statusCounts.DECLINED || 0, icon: XCircle, color: 'danger' },
        { label: 'Incomplete', value: statusCounts.INCOMPLETE || 0, icon: AlertCircle, color: 'warning' },
        { label: 'Idle', value: statusCounts.IDLE || 0, icon: Pause, color: 'teal' }
    ];

    return (
        <div className="mb-4">
            <div className="row mb-3">
                <div className="col-md-6">
                    <div className="d-flex align-items-center gap-3">
                        <label className="form-label mb-0 text-muted">Filter by Date:</label>
                        <input 
                            type="date" 
                            value={selectedDate}
                            max={today}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="form-control w-auto"
                        />
                    </div>
                </div>
            </div>
            <div className="row g-3">
                {stats.map((stat) => {
                    const Icon = stat.icon;
                    const c = colorMap[stat.color] || colorMap.primary;
                    return (
                        <div key={stat.label} className="col-6 col-md-4 col-lg-3 col-xl">
                            <div className="card h-100 position-relative overflow-hidden">
                                <div className="card-body position-relative" style={{ zIndex: 1 }}>
                                    <div className="d-flex align-items-start justify-content-between">
                                        <div>
                                            <p className="text-muted small mb-1">{stat.label}</p>
                                            <h5 className="mb-0 fw-semibold">{stat.value}</h5>
                                        </div>
                                        <span
                                            className="d-inline-flex align-items-center justify-content-center rounded-circle border"
                                            style={{ 
                                                backgroundColor: c.bg, 
                                                borderColor: c.border,
                                                width: '32px',
                                                height: '32px'
                                            }}
                                        >
                                            <Icon size={14} style={{ color: c.text }} />
                                        </span>
                                    </div>
                                </div>
                                <img 
                                    src={c.decorImg} 
                                    alt="" 
                                    className="position-absolute top-0 start-0" 
                                    style={{ width: 'auto', height: 'auto' }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ProductionStatsCards;
