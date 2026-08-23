import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowRight } from 'lucide-react';

export const Pagination = ({
    page = 1,
    pageSize = 20,
    totalCount = 0,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = [10, 20, 50, 100],
    siblingCount = 1,
    className = '',
    showPageSize = true,
    showJump = true,
    itemLabel = 'records',
}) => {
    const [jumpInput, setJumpInput] = useState('');
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    if (totalCount === 0) return null;

    const startItem = (page - 1) * pageSize + 1;
    const endItem = Math.min(page * pageSize, totalCount);

    const goToPage = (target) => {
        const p = typeof target === 'number' ? target : parseInt(target, 10);
        if (!isNaN(p) && p >= 1 && p <= totalPages && p !== page) {
            onPageChange(p);
            setJumpInput('');
        }
    };

    const handleJumpSubmit = (e) => {
        e.preventDefault();
        goToPage(jumpInput);
    };

    const generatePages = () => {
        const pages = [];
        const showFirst = page > siblingCount + 2;
        const showLast = page < totalPages - siblingCount - 1;

        if (showFirst) {
            pages.push(1);
            if (page > siblingCount + 3) pages.push('...');
        }

        const start = Math.max(1, page - siblingCount - (showFirst ? 1 : 0));
        const end = Math.min(totalPages, page + siblingCount + (showLast ? 1 : 0));

        for (let i = start; i <= end; i++) {
            pages.push(i);
        }

        if (showLast) {
            if (page < totalPages - siblingCount - 3) pages.push('...');
            pages.push(totalPages);
        }

        return pages;
    };

    const pages = generatePages();

    return (
        <div className={`d-flex flex-column flex-md-row justify-content-between align-items-center py-3 px-3 gap-3 border-top ${className}`}>
            {/* Left: Item Counter & Page Size Selector */}
            <div className="d-flex flex-wrap align-items-center gap-3">
                <small className="text-muted text-nowrap">
                    Showing <strong className="text-dark">{startItem}</strong>–<strong className="text-dark">{endItem}</strong> of <strong className="text-dark">{totalCount.toLocaleString()}</strong> {itemLabel}
                </small>

                {showPageSize && onPageSizeChange && (
                    <div className="d-flex align-items-center gap-1.5">
                        <label htmlFor="pageSizeSelect" className="text-muted small text-nowrap mb-0" style={{ fontSize: '0.8rem' }}>
                            Per page:
                        </label>
                        <select
                            id="pageSizeSelect"
                            className="form-select form-select-sm border py-0 ps-2 pe-4"
                            style={{ width: 'auto', height: '28px', fontSize: '0.8rem' }}
                            value={pageSize}
                            onChange={(e) => {
                                const newSize = Number(e.target.value);
                                onPageSizeChange(newSize);
                                if (onPageChange) onPageChange(1);
                            }}
                        >
                            {pageSizeOptions.map((opt) => (
                                <option key={opt} value={opt}>
                                    {opt}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* Right: Page Navigation & Jump to Page */}
            <div className="d-flex flex-wrap align-items-center gap-2">
                {totalPages > 1 && (
                    <nav aria-label="Table pagination">
                        <ul className="pagination pagination-sm mb-0 shadow-none">
                            {/* First Page */}
                            <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
                                <button
                                    className="page-link"
                                    onClick={() => goToPage(1)}
                                    disabled={page === 1}
                                    title="First page"
                                    aria-label="First page"
                                >
                                    <ChevronsLeft size={13} />
                                </button>
                            </li>

                            {/* Previous Page */}
                            <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
                                <button
                                    className="page-link"
                                    onClick={() => goToPage(page - 1)}
                                    disabled={page === 1}
                                    title="Previous page"
                                    aria-label="Previous page"
                                >
                                    <ChevronLeft size={13} />
                                </button>
                            </li>

                            {/* Page Numbers */}
                            {pages.map((p, idx) =>
                                p === '...' ? (
                                    <li key={`ellipsis-${idx}`} className="page-item disabled">
                                        <span className="page-link px-2">…</span>
                                    </li>
                                ) : (
                                    <li key={p} className={`page-item ${page === p ? 'active' : ''}`}>
                                        <button
                                            className="page-link px-2.5 fw-semibold"
                                            onClick={() => goToPage(p)}
                                        >
                                            {p}
                                        </button>
                                    </li>
                                )
                            )}

                            {/* Next Page */}
                            <li className={`page-item ${page === totalPages ? 'disabled' : ''}`}>
                                <button
                                    className="page-link"
                                    onClick={() => goToPage(page + 1)}
                                    disabled={page === totalPages}
                                    title="Next page"
                                    aria-label="Next page"
                                >
                                    <ChevronRight size={13} />
                                </button>
                            </li>

                            {/* Last Page */}
                            <li className={`page-item ${page === totalPages ? 'disabled' : ''}`}>
                                <button
                                    className="page-link"
                                    onClick={() => goToPage(totalPages)}
                                    disabled={page === totalPages}
                                    title="Last page"
                                    aria-label="Last page"
                                >
                                    <ChevronsRight size={13} />
                                </button>
                            </li>
                        </ul>
                    </nav>
                )}

                {/* Quick Jump (when more than 4 pages) */}
                {showJump && totalPages > 4 && (
                    <form onSubmit={handleJumpSubmit} className="d-flex align-items-center gap-1 ms-1">
                        <label htmlFor="jumpInput" className="text-muted small text-nowrap mb-0 d-none d-lg-inline" style={{ fontSize: '0.78rem' }}>
                            Go:
                        </label>
                        <input
                            id="jumpInput"
                            type="number"
                            className="form-control form-control-sm text-center px-1"
                            style={{ width: '48px', height: '28px', fontSize: '0.8rem' }}
                            min={1}
                            max={totalPages}
                            placeholder={page}
                            value={jumpInput}
                            onChange={(e) => setJumpInput(e.target.value)}
                            onBlur={() => { if (jumpInput) goToPage(jumpInput); }}
                        />
                        <button
                            type="submit"
                            className="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center p-0"
                            style={{ width: '28px', height: '28px' }}
                            title="Go to page"
                        >
                            <ArrowRight size={12} />
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default Pagination;
