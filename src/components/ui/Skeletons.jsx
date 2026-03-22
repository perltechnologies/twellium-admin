import React from 'react';

const shimmerStyle = {
    background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s ease-in-out infinite',
    borderRadius: 8,
};

/* Inject keyframes once */
const StyleTag = () => (
    <style>{`
        @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }
    `}</style>
);

const Bone = ({ width = '100%', height = 14, style = {}, className = '' }) => (
    <div className={className} style={{ ...shimmerStyle, width, height, ...style }} />
);

/* ── Stat Card Skeleton ─────────────────────────── */
export const SkeletonStatCard = () => (
    <div className="col-xl-3 col-sm-6 d-flex">
        <div className="card flex-fill mb-0 position-relative overflow-hidden">
            <div className="card-body position-relative z-1">
                <div className="d-flex align-items-start justify-content-between">
                    <div style={{ flex: 1 }}>
                        <Bone width="60%" height={12} style={{ marginBottom: 10 }} />
                        <Bone width="40%" height={24} style={{ marginBottom: 8 }} />
                        <Bone width="75%" height={11} />
                    </div>
                    <div style={{ ...shimmerStyle, width: 48, height: 48, borderRadius: '12px' }} />
                </div>
            </div>
        </div>
    </div>
);

export const SkeletonStatCards = ({ count = 4 }) => (
    <div className="row row-gap-3 mb-4">
        <StyleTag />
        {Array.from({ length: count }).map((_, i) => (
            <SkeletonStatCard key={i} />
        ))}
    </div>
);

/* ── Gauge Skeleton ─────────────────────────────── */
export const SkeletonGauge = () => (
    <div className="col-lg-3 col-sm-6 d-flex justify-content-center">
        <div className="d-flex flex-column align-items-center p-4 border rounded-3 shadow-sm w-100" style={{ background: '#ffffff' }}>
            <Bone width="50%" height={14} style={{ marginBottom: 20 }} />
            <div style={{ ...shimmerStyle, width: 140, height: 140, borderRadius: '50%', margin: '8px 0' }} />
            <Bone width="35%" height={20} style={{ marginTop: 12 }} />
        </div>
    </div>
);

export const SkeletonGauges = ({ count = 4 }) => (
    <div className="row row-gap-3 mb-4">
        <div className="col-12">
            <div className="card">
                <div className="card-header">
                    <Bone width="35%" height={16} />
                </div>
                <div className="card-body">
                    <StyleTag />
                    <div className="row g-3">
                        {Array.from({ length: count }).map((_, i) => (
                            <SkeletonGauge key={i} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    </div>
);

/* ── Chart Skeleton ─────────────────────────────── */
export const SkeletonChart = ({ height = 350, title }) => (
    <div className="card flex-fill">
        {title && (
            <div className="card-header">
                <Bone width="40%" height={16} />
            </div>
        )}
        <div className="card-body">
            <StyleTag />
            <div className="d-flex align-items-end gap-2" style={{ height, paddingTop: 20 }}>
                {[65, 45, 80, 55, 70, 40, 60, 75, 50, 85].map((h, i) => (
                    <div
                        key={i}
                        style={{
                            ...shimmerStyle,
                            flex: 1,
                            height: `${h}%`,
                            borderRadius: '6px 6px 0 0',
                        }}
                    />
                ))}
            </div>
        </div>
    </div>
);

/* ── Table Skeleton ─────────────────────────────── */
export const SkeletonTable = ({ rows = 4, cols = 6 }) => (
    <div className="card flex-fill">
        <div className="card-header d-flex align-items-center justify-content-between">
            <Bone width="30%" height={16} />
            <Bone width={80} height={32} style={{ borderRadius: 8 }} />
        </div>
        <div className="card-body p-0">
            <StyleTag />
            <div className="table-responsive">
                <table className="table mb-0">
                    <thead className="table-light">
                        <tr>
                            {Array.from({ length: cols }).map((_, i) => (
                                <th key={i} className="ps-3">
                                    <Bone width="70%" height={12} />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: rows }).map((_, row) => (
                            <tr key={row}>
                                {Array.from({ length: cols }).map((_, col) => (
                                    <td key={col} className="ps-3">
                                        <Bone width={col === 0 ? '80%' : '50%'} height={12} />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
);

/* ── Downtime List Skeleton ─────────────────────── */
export const SkeletonDowntimeList = () => (
    <div className="card flex-fill">
        <div className="card-header d-flex align-items-center justify-content-between">
            <div>
                <Bone width={180} height={16} style={{ marginBottom: 6 }} />
                <Bone width={250} height={11} />
            </div>
            <Bone width={60} height={28} style={{ borderRadius: 6 }} />
        </div>
        <div className="card-body">
            <StyleTag />
            <div className="alert alert-light border mb-4 p-3">
                <Bone width="40%" height={12} style={{ marginBottom: 8 }} />
                <Bone width="30%" height={24} />
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="border rounded p-3 mb-3">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                        <div className="d-flex align-items-center gap-2">
                            <div style={{ ...shimmerStyle, width: 32, height: 32, borderRadius: '8px' }} />
                            <Bone width={120} height={14} />
                        </div>
                        <div className="text-end">
                            <Bone width={50} height={14} style={{ marginBottom: 4 }} />
                            <Bone width={30} height={10} />
                        </div>
                    </div>
                    <Bone height={8} style={{ borderRadius: 4 }} />
                </div>
            ))}
        </div>
    </div>
);

/* ── Donut Chart Skeleton ───────────────────────── */
export const SkeletonDonut = ({ title }) => (
    <div className="card flex-fill">
        {title !== false && (
            <div className="card-header">
                <Bone width="50%" height={16} />
            </div>
        )}
        <div className="card-body d-flex flex-column align-items-center">
            <StyleTag />
            <div style={{ ...shimmerStyle, width: 150, height: 150, borderRadius: '50%', marginBottom: 20 }} />
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="d-flex align-items-center justify-content-between w-100 mb-2">
                    <Bone width="40%" height={12} />
                    <Bone width={30} height={12} />
                </div>
            ))}
        </div>
    </div>
);

/* ── Enhanced Page Skeleton ─────────────────────── */
export const SkeletonPage = ({ sections = 3 }) => (
    <div className="animate-in">
        <StyleTag />
        {/* Page Header */}
        <div className="d-flex align-items-center justify-content-between gap-2 mb-4">
            <div>
                <Bone width={180} height={28} style={{ marginBottom: 8 }} />
                <Bone width={280} height={14} />
            </div>
            <Bone width={120} height={36} style={{ borderRadius: 8 }} />
        </div>
        
        {/* Filters */}
        <div className="card mb-4">
            <div className="card-body">
                <div className="row g-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="col-md-3">
                            <Bone width="100%" height={40} style={{ borderRadius: 8 }} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
        
        {/* Stat Cards */}
        <SkeletonStatCards count={4} />
        
        {/* Charts and Tables */}
        {Array.from({ length: sections }).map((_, i) => (
            <div key={i} className="card mb-4">
                <div className="card-header">
                    <Bone width="30%" height={16} />
                </div>
                <div className="card-body">
                    <StyleTag />
                    <div style={{ ...shimmerStyle, width: '100%', height: 250, borderRadius: 12 }} />
                </div>
            </div>
        ))}
    </div>
);
