import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export const Button = ({ children, variant = 'primary', className, isLoading, ...props }) => {
    const variants = {
        primary: 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm',
        secondary: 'bg-white dark:bg-[#0c0c20] hover:bg-[#f7f8f9] dark:hover:bg-[#161641] text-[#1f2020] dark:text-[#d9dcff] border border-[#e2e8f0] dark:border-[#161641]',
        ghost: 'bg-transparent hover:bg-[#f7f8f9] dark:hover:bg-[#0c0c20] text-[#707070] dark:text-[#828997] hover:text-[#1f2020] dark:hover:text-[#d9dcff]',
        destructive: 'bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 dark:text-red-500 border border-red-200 dark:border-red-500/20',
        success: 'bg-green-600 hover:bg-green-700 text-white shadow-sm',
        warning: 'bg-yellow-500 hover:bg-yellow-600 text-white shadow-sm',
        outline: 'bg-transparent hover:bg-[#f7f8f9] dark:hover:bg-[#0c0c20] text-[#1f2020] dark:text-[#d9dcff] border border-[#e2e8f0] dark:border-[#161641] shadow-sm',
    };

    return (
        <button
            className={cn(
                'relative px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed',
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
        <div className="space-y-1.5">
            {label && <label className="text-sm font-medium text-[#1f2020] dark:text-[#d9dcff]">{label}</label>}
            <input
                className={cn(
                    'w-full px-3 py-2 bg-white dark:bg-[#0c0c20] border border-[#e2e8f0] dark:border-[#161641] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 text-[#1f2020] dark:text-[#d9dcff] placeholder:text-[#9d9d9d] text-sm',
                    error && 'border-red-400 focus:border-red-500 focus:ring-red-500/20',
                    className
                )}
                {...props}
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
    );
};

export const Card = ({ children, className }) => {
    return (
        <div className={cn('bg-white dark:bg-[#030318] border border-[#e2e8f0] dark:border-[#161641] rounded-xl shadow-crm overflow-hidden', className)}>
            {children}
        </div>
    );
};

export const CardHeader = ({ children, className }) => (
    <div className={cn('px-5 py-4 border-b border-[#e2e8f0] dark:border-[#161641] flex items-center justify-between flex-wrap gap-2 text-base font-semibold text-[#1f2020] dark:text-[#d9dcff]', className)}>
        {children}
    </div>
);

export const CardBody = ({ children, className }) => (
    <div className={cn('p-5', className)}>
        {children}
    </div>
);

export const Select = ({ label, error, options = [], className, ...props }) => {
    return (
        <div className="space-y-1.5">
            {label && <label className="text-sm font-medium text-[#1f2020] dark:text-[#d9dcff]">{label}</label>}
            <select
                className={cn(
                    'w-full px-3 py-2 bg-white dark:bg-[#0c0c20] border border-[#e2e8f0] dark:border-[#161641] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 text-[#1f2020] dark:text-[#d9dcff] text-sm',
                    error && 'border-red-400 focus:border-red-500 focus:ring-red-500/20',
                    className
                )}
                {...props}
            >
                <option value="">Select...</option>
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
            {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
    );
};
