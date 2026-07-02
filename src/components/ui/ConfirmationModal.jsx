import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './base';

export const ConfirmationModal = ({
    isOpen,
    onClose,
    onConfirm,
    title = "Confirm Action",
    message = "Are you sure you want to proceed?",
    confirmText = "Delete",
    confirmVariant = "destructive", // or 'primary'
    isLoading = false
}) => {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
                >
                    <div className="flex justify-between items-center p-4 border-b border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                                <AlertTriangle className="h-4 w-4" />
                            </div>
                            <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-white">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="p-6">
                        <p className="text-slate-300">{message}</p>
                    </div>

                    <div className="flex justify-end gap-3 p-4 bg-slate-900/50 border-t border-slate-800">
                        <Button variant="ghost" onClick={onClose} disabled={isLoading}>
                            Cancel
                        </Button>
                        <Button
                            className={`${confirmVariant === 'destructive' ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'}`}
                            onClick={onConfirm}
                            disabled={isLoading}
                        >
                            {isLoading ? 'Processing...' : confirmText}
                        </Button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
