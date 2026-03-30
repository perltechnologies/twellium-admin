import React from 'react';

/**
 * Enhanced Stat Card for Shift Production Metrics
 * Features: Gradient backgrounds, animations, trend indicators, tooltips
 */
const EnhancedStatCard = ({ 
    title, 
    value, 
    unit, 
    icon, 
    color = 'primary', 
    trend = null,
    target = null,
    subtitle = null,
    delay = 0
}) => {
    const colorConfig = {
        primary: {
            gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            bg: 'bg-soft-primary',
            iconBg: 'rgba(102, 126, 234, 0.1)',
            text: 'text-primary',
            border: 'border-primary'
        },
        success: {
            gradient: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
            bg: 'bg-soft-success',
            iconBg: 'rgba(17, 153, 142, 0.1)',
            text: 'text-success',
            border: 'border-success'
        },
        danger: {
            gradient: 'linear-gradient(135deg, #eb3349 0%, #f45c43 100%)',
            bg: 'bg-soft-danger',
            iconBg: 'rgba(235, 51, 73, 0.1)',
            text: 'text-danger',
            border: 'border-danger'
        },
        warning: {
            gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            bg: 'bg-soft-warning',
            iconBg: 'rgba(240, 147, 251, 0.1)',
            text: 'text-warning',
            border: 'border-warning'
        },
        info: {
            gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            bg: 'bg-soft-info',
            iconBg: 'rgba(79, 172, 254, 0.1)',
            text: 'text-info',
            border: 'border-info'
        },
        teal: {
            gradient: 'linear-gradient(135deg, #42e695 0%, #3bb2b8 100%)',
            bg: 'bg-soft-teal',
            iconBg: 'rgba(66, 230, 149, 0.1)',
            text: 'text-teal',
            border: 'border-teal'
        }
    };

    const config = colorConfig[color] || colorConfig.primary;

    return (
        <div 
            className="card border-0 shadow-sm h-100 overflow-hidden position-relative"
            style={{
                animation: `slideUp 0.5s ease-out ${delay}ms both`,
                transition: 'all 0.3s ease',
                transform: 'translateY(0)',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-5px)';
                e.currentTarget.style.boxShadow = '0 0.5rem 2rem rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 0.25rem 1rem rgba(0,0,0,0.1)';
            }}
        >
            {/* Animated background pattern */}
            <div 
                className="position-absolute"
                style={{
                    top: '-50%',
                    right: '-50%',
                    width: '100%',
                    height: '100%',
                    background: `radial-gradient(circle, ${config.iconBg} 0%, transparent 70%)`,
                    opacity: 0.5,
                    transition: 'opacity 0.3s ease'
                }}
            />
            
            <div className="card-body position-relative" style={{ zIndex: 1 }}>
                <div className="d-flex align-items-start justify-content-between mb-2">
                    <div 
                        className="d-flex align-items-center justify-content-center rounded-circle"
                        style={{
                            width: '48px',
                            height: '48px',
                            background: config.iconBg,
                            boxShadow: `0 4px 12px ${config.iconBg}`
                        }}
                    >
                        <i className={`ti ti-${icon} ${config.text} fs-4`}></i>
                    </div>
                    {trend !== null && (
                        <div 
                            className={`d-flex align-items-center gap-1 px-2 py-1 rounded-pill ${
                                trend > 0 ? 'bg-success bg-opacity-10' : trend < 0 ? 'bg-danger bg-opacity-10' : 'bg-secondary bg-opacity-10'
                            }`}
                            style={{ fontSize: '0.75rem' }}
                        >
                            {trend > 0 ? (
                                <i className="ti ti-arrow-up-right text-success"></i>
                            ) : trend < 0 ? (
                                <i className="ti ti-arrow-down-right text-danger"></i>
                            ) : (
                                <i className="ti ti-minus text-secondary"></i>
                            )}
                            <span className={`fw-semibold ${
                                trend > 0 ? 'text-success' : trend < 0 ? 'text-danger' : 'text-secondary'
                            }`}>
                                {Math.abs(trend)}%
                            </span>
                        </div>
                    )}
                </div>
                
                <div className="mt-3">
                    <p className="text-muted text-uppercase mb-1" style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.5px' }}>
                        {title}
                    </p>
                    <div className="d-flex align-items-baseline gap-2">
                        <h3 className="mb-0 fw-bold" style={{ fontSize: '1.75rem', color: '#1f2937' }}>
                            {value.toLocaleString()}
                        </h3>
                        {unit && <span className="text-muted" style={{ fontSize: '0.875rem' }}>{unit}</span>}
                    </div>
                    {subtitle && (
                        <p className="text-muted mb-0 mt-2" style={{ fontSize: '0.75rem' }}>
                            {subtitle}
                        </p>
                    )}
                    {target !== null && (
                        <div className="mt-2">
                            <div className="progress" style={{ height: '6px' }} role="progressbar">
                                <div 
                                    className="progress-bar"
                                    style={{ 
                                        width: `${Math.min(100, (value / target) * 100)}%`,
                                        background: config.gradient
                                    }}
                                />
                            </div>
                            <small className="text-muted" style={{ fontSize: '0.7rem' }}>
                                Target: {target.toLocaleString()} ({Math.round((value / target) * 100)}%)
                            </small>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Bottom accent border */}
            <div 
                className="position-absolute bottom-0 start-0 w-100"
                style={{
                    height: '4px',
                    background: config.gradient
                }}
            />
        </div>
    );
};

export default EnhancedStatCard;
