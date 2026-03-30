import React, { useState } from 'react';

/**
 * Enhanced Gauge Chart with animations, gradients, and interactive features
 */
const EnhancedGaugeChart = ({ 
    value, 
    label, 
    color = '#667eea',
    calculation,
    rawValues,
    size = 220,
    showTooltip = true,
    animated = true
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const [displayValue, setDisplayValue] = useState(animated ? 0 : value);

    // Animate value on mount
    React.useEffect(() => {
        if (animated) {
            const duration = 1500;
            const startTime = Date.now();
            const startValue = 0;
            
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(1, elapsed / duration);
                // Ease out quart
                const eased = 1 - Math.pow(1 - progress, 4);
                
                setDisplayValue(startValue + (value - startValue) * eased);
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                }
            };
            
            requestAnimationFrame(animate);
        }
    }, [value, animated]);

    const pct = Math.min(100, Math.max(0, displayValue));
    const cx = size / 2;
    const cy = size / 2 + 10;
    const r = 70;
    const startAngle = (Math.PI * 4) / 5; // 144 degrees
    const endAngle = Math.PI / 5; // 36 degrees
    const range = startAngle - endAngle;
    const needleAngle = startAngle - (range * pct) / 100;

    const polarToCartesian = (angle, radius) => ({
        x: cx + radius * Math.cos(angle),
        y: cy - radius * Math.sin(angle)
    });

    const createArc = (start, end, radius) => {
        const startPoint = polarToCartesian(start, radius);
        const endPoint = polarToCartesian(end, radius);
        const largeArc = Math.abs(start - end) > Math.PI ? 1 : 0;
        return `M ${startPoint.x} ${startPoint.y} A ${radius} ${radius} 0 ${largeArc} 1 ${endPoint.x} ${endPoint.y}`;
    };

    // Gradient color based on value
    const getGradientColor = (v) => {
        if (v >= 85) return { start: '#22c55e', end: '#10b981' };
        if (v >= 60) return { start: '#f59e0b', end: '#f97316' };
        return { start: '#ef4444', end: '#dc2626' };
    };

    const gradientColors = getGradientColor(pct);

    // Zones with gradients
    const zones = [
        { start: 0, end: 60, colors: ['#fecaca', '#fca5a5', '#f87171', '#ef4444'] },
        { start: 60, end: 85, colors: ['#fef3c7', '#fde68a', '#fcd34d', '#f59e0b'] },
        { start: 85, end: 100, colors: ['#d1fae5', '#a7f3d0', '#6ee7b7', '#22c55e'] }
    ];

    const createGradientZone = (zone, index) => {
        const gradientId = `zone-gradient-${index}`;

        return (
            <defs key={index}>
                <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                    {zone.colors.map((c, i) => (
                        <stop
                            key={i}
                            offset={`${(i / (zone.colors.length - 1)) * 100}%`}
                            stopColor={c}
                        />
                    ))}
                </linearGradient>
            </defs>
        );
    };

    return (
        <div 
            className="d-flex flex-column align-items-center p-4 rounded-4 shadow-sm h-100"
            style={{ 
                background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                border: '1px solid rgba(0,0,0,0.05)',
                transition: 'all 0.3s ease',
                transform: isHovered ? 'scale(1.02)' : 'scale(1)',
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Header with label */}
            <div className="mb-2 text-center">
                <h6 className="mb-1 fw-semibold" style={{ color: '#1f2937', fontSize: '0.95rem' }}>
                    {label}
                </h6>
                {pct >= 85 && (
                    <span className="badge bg-success bg-opacity-10 text-success px-2 py-1" style={{ fontSize: '0.65rem' }}>
                        <i className="ti ti-check me-1"></i>Excellent
                    </span>
                )}
                {pct >= 60 && pct < 85 && (
                    <span className="badge bg-warning bg-opacity-10 text-warning px-2 py-1" style={{ fontSize: '0.65rem' }}>
                        <i className="ti ti-alert-triangle me-1"></i>Good
                    </span>
                )}
                {pct < 60 && (
                    <span className="badge bg-danger bg-opacity-10 text-danger px-2 py-1" style={{ fontSize: '0.65rem' }}>
                        <i className="ti ti-alert-circle me-1"></i>Needs Attention
                    </span>
                )}
            </div>

            {/* SVG Gauge */}
            <div
                title={calculation || `${label}: ${value.toFixed(1)}%`}
                style={{ cursor: showTooltip ? 'help' : 'default' }}
                className="position-relative"
            >
                <svg width={size} height={size * 0.8} viewBox={`0 0 ${size} ${size * 0.8}`}>
                    <defs>
                        {/* Main gauge gradient */}
                        <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor={gradientColors.start} />
                            <stop offset="100%" stopColor={gradientColors.end} />
                        </linearGradient>
                        
                        {/* Glow filter */}
                        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                            <feMerge>
                                <feMergeNode in="coloredBlur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                        
                        {/* Shadow filter */}
                        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15"/>
                        </filter>

                        {/* Zone gradients */}
                        {zones.map((zone, i) => createGradientZone(zone, i))}
                    </defs>

                    {/* Background track */}
                    <path 
                        d={createArc(startAngle, endAngle, r)} 
                        fill="none" 
                        stroke="#e5e7eb" 
                        strokeWidth="28" 
                        strokeLinecap="round"
                        style={{ filter: 'url(#shadow)' }}
                    />

                    {/* Color zones */}
                    {zones.map((zone, i) => {
                        const zStart = startAngle - (range * zone.start) / 100;
                        const zEnd = startAngle - (range * zone.end) / 100;
                        return (
                            <path 
                                key={i} 
                                d={createArc(zStart, zEnd, r)} 
                                fill="none" 
                                stroke={`url(#zone-gradient-${i})`}
                                strokeWidth="26" 
                                strokeLinecap="round"
                                opacity="0.9"
                            />
                        );
                    })}

                    {/* Animated value arc */}
                    <path 
                        d={createArc(startAngle, needleAngle, r)} 
                        fill="none" 
                        stroke="url(#gaugeGradient)" 
                        strokeWidth="26" 
                        strokeLinecap="round"
                        style={{
                            transition: animated ? 'd 0.1s linear' : 'none',
                            filter: 'url(#glow)'
                        }}
                    />

                    {/* Tick marks */}
                    {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(tick => {
                        const angle = startAngle - (range * tick) / 100;
                        const isMajor = tick % 10 === 0;
                        const tickLength = isMajor ? 10 : 6;
                        const inner = polarToCartesian(angle, r + 12);
                        const outer = polarToCartesian(angle, r + 12 + tickLength);
                        
                        return (
                            <line 
                                key={tick} 
                                x1={inner.x} y1={inner.y} 
                                x2={outer.x} y2={outer.y}
                                stroke={tick % 20 === 0 ? '#6b7280' : '#d1d5db'} 
                                strokeWidth={isMajor ? 2 : 1} 
                                strokeLinecap="round" 
                            />
                        );
                    })}

                    {/* Tick labels */}
                    {[0, 25, 50, 75, 100].map(tick => {
                        const angle = startAngle - (range * tick) / 100;
                        const pos = polarToCartesian(angle, r + 32);
                        return (
                            <text 
                                key={tick} 
                                x={pos.x} 
                                y={pos.y + 4} 
                                textAnchor="middle" 
                                fontSize="12" 
                                fontWeight="600" 
                                fill="#6b7280"
                            >
                                {tick}
                            </text>
                        );
                    })}

                    {/* Needle with animation */}
                    <g 
                        style={{
                            transformOrigin: `${cx}px ${cy}px`,
                            transform: `rotate(${((startAngle - needleAngle) * 180 / Math.PI) - 90}deg)`,
                            transition: animated ? 'transform 0.1s linear' : 'none'
                        }}
                        filter="url(#shadow)"
                    >
                        <line 
                            x1={cx} y1={cy} 
                            x2={cx} y2={cy - (r - 15)}
                            stroke="#374151" 
                            strokeWidth="3" 
                            strokeLinecap="round" 
                        />
                        <circle cx={cx} cy={cy} r="8" fill="#374151" />
                        <circle cx={cx} cy={cy} r="4" fill="#ffffff" />
                    </g>

                    {/* Center value display */}
                    <g>
                        <text 
                            x={cx} 
                            y={cy + 35} 
                            textAnchor="middle" 
                            fontSize="32" 
                            fontWeight="800" 
                            fill="#111827"
                            style={{ filter: 'url(#shadow)' }}
                        >
                            {pct.toFixed(1)}%
                        </text>
                        <text 
                            x={cx} 
                            y={cy + 55} 
                            textAnchor="middle" 
                            fontSize="13" 
                            fontWeight="600" 
                            fill="#6b7280"
                        >
                            {label}
                        </text>
                    </g>
                </svg>
            </div>

            {/* Raw values display */}
            {rawValues && (
                <div className="mt-3 text-center w-100">
                    {pct === 0 ? (
                        <div className="badge bg-warning bg-opacity-10 text-warning px-3 py-2">
                            <i className="ti ti-alert-circle me-1"></i>
                            {rawValues.reason || 'No data available'}
                        </div>
                    ) : (
                        <div 
                            className="p-2 rounded-3"
                            style={{ 
                                background: 'rgba(0,0,0,0.03)',
                                fontSize: '10px',
                                lineHeight: '1.5',
                                fontFamily: 'monospace',
                                color: '#6b7280'
                            }}
                        >
                            {rawValues.display}
                        </div>
                    )}
                </div>
            )}

            {/* Hover effect overlay */}
            <div 
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: `radial-gradient(circle at center, ${color}15 0%, transparent 70%)`,
                    opacity: isHovered ? 1 : 0,
                    transition: 'opacity 0.3s ease',
                    pointerEvents: 'none',
                    borderRadius: '16px'
                }}
            />
        </div>
    );
};

export default EnhancedGaugeChart;
