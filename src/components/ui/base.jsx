import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export const Button = ({ children, variant = 'primary', className, isLoading, ...props }) => {
    const variants = {
        primary: 'bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md hover:shadow-lg',
        secondary: 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm',
        ghost: 'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200',
        destructive: 'bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 dark:text-red-500 border border-red-200 dark:border-red-500/20',
        success: 'bg-gradient-to-br from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-md hover:shadow-lg',
        warning: 'bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-md hover:shadow-lg',
        outline: 'bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border-2 border-slate-200 dark:border-slate-700',
        indigo: 'bg-gradient-to-br from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white shadow-md hover:shadow-lg',
    };

    return (
        <button
            className={cn(
                'relative px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95',
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
            {label && <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>}
            <input
                className={cn(
                    'w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-sm',
                    error && 'border-red-400 focus:border-red-500 focus:ring-red-500/20',
                    className
                )}
                {...props}
            />
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
    );
};

export const Card = ({ children, className, hover = false }) => {
    return (
        <div className={cn(
            'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden',
            hover && 'hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300',
            className
        )}>
            {children}
        </div>
    );
};

export const CardHeader = ({ children, className }) => (
    <div className={cn(
        'px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between flex-wrap gap-2 text-base font-semibold text-slate-800 dark:text-slate-100 bg-gradient-to-b from-slate-50 to-white dark:from-slate-800 dark:to-slate-800',
        className
    )}>
        {children}
    </div>
);

export const CardBody = ({ children, className }) => (
    <div className={cn('p-5', className)}>
        {children}
    </div>
);

export const CardFooter = ({ children, className }) => (
    <div className={cn(
        'px-5 py-3.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50',
        className
    )}>
        {children}
    </div>
);

export const Select = ({ label, error, options = [], className, ...props }) => {
    return (
        <div className="space-y-1.5">
            {label && <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>}
            <select
                className={cn(
                    'w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-slate-900 dark:text-slate-100 text-sm cursor-pointer',
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
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
    );
};

export const Badge = ({ children, variant = 'default', className }) => {
    const variants = {
        default: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
        primary: 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
        success: 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400',
        danger: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400',
        warning: 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',
        info: 'bg-cyan-100 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-400',
    };

    return (
        <span className={cn(
            'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium',
            variants[variant],
            className
        )}>
            {children}
        </span>
    );
};

export const StatCard = ({ title, value, icon: Icon, trend, trendValue, className }) => {
    return (
        <Card hover className={cn('relative overflow-hidden', className)}>
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-blue-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
            <CardBody className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{title}</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
                    {trend && (
                        <p className={cn(
                            'text-xs mt-1.5 font-medium',
                            trend === 'up' ? 'text-green-600' : 'text-red-600'
                        )}>
                            {trend === 'up' ? '↑' : '↓'} {trendValue}%
                        </p>
                    )}
                </div>
                {Icon && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                        <Icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                )}
            </CardBody>
        </Card>
    );
};
