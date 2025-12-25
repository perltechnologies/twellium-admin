import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { DataTable } from './DataTable';

export { DataTable };
export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export const Button = ({ children, variant = 'primary', className, isLoading, ...props }) => {
    const variants = {
        primary: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/20',
        secondary: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700',
        ghost: 'bg-transparent hover:bg-slate-800/50 text-slate-400 hover:text-white',
        destructive: 'bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20',
    };

    return (
        <button
            className={cn(
                'relative px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed',
                variants[variant],
                className
            )}
            disabled={isLoading}
            {...props}
        >
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-inherit rounded-lg">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                </div>
            )}
            <span className={cn(isLoading && 'invisible')}>{children}</span>
        </button>
    );
};

export const Input = ({ label, error, className, ...props }) => {
    return (
        <div className="space-y-1">
            {label && <label className="text-sm font-medium text-slate-400">{label}</label>}
            <input
                className={cn(
                    'w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all duration-200 text-slate-200 placeholder:text-slate-600',
                    error && 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20',
                    className
                )}
                {...props}
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
    );
};

export const Card = ({ children, className }) => {
    return (
        <div className={cn('bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl overflow-hidden', className)}>
            {children}
        </div>
    );
};
