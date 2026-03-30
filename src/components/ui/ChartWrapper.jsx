import React, { useState, useRef } from 'react';
import { Download, Image, FileText, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, Button } from './base';
import { exportChartToPDF } from '../../utils/exportUtils';

const ChartWrapper = ({
    children,
    title,
    chartId,
    enableExport = true,
    className = ''
}) => {
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const chartRef = useRef(null);

    const handleExportPNG = async () => {
        setIsExporting(true);
        try {
            const element = document.getElementById(chartId);
            if (!element) {
                console.error('Chart element not found:', chartId);
                return;
            }

            const canvas = await import('html2canvas').then(m => 
                m.default(element, {
                    scale: 2,
                    backgroundColor: '#ffffff',
                    logging: false,
                    useCORS: true
                })
            );

            const link = document.createElement('a');
            link.download = `${chartId}-${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (error) {
            console.error('Export failed:', error);
        } finally {
            setIsExporting(false);
            setShowExportMenu(false);
        }
    };

    const handleExportPDF = async () => {
        setIsExporting(true);
        try {
            await exportChartToPDF(chartId, chartId, title);
        } catch (error) {
            console.error('PDF export failed:', error);
        } finally {
            setIsExporting(false);
            setShowExportMenu(false);
        }
    };

    return (
        <Card className={`p-6 ${className}`}>
            <div className="flex items-center justify-between mb-4">
                {title && (
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        {title}
                    </h3>
                )}
                {enableExport && (
                    <div className="relative">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setShowExportMenu(!showExportMenu)}
                            disabled={isExporting}
                            className="flex items-center gap-2"
                        >
                            {isExporting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Download className="h-4 w-4" />
                            )}
                            Export
                        </Button>
                        <AnimatePresence>
                            {showExportMenu && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="absolute right-0 mt-2 w-36 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 overflow-hidden"
                                >
                                    <button
                                        onClick={handleExportPNG}
                                        className="w-full px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                    >
                                        <Image className="h-4 w-4 text-purple-600" />
                                        PNG
                                    </button>
                                    <button
                                        onClick={handleExportPDF}
                                        className="w-full px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                    >
                                        <FileText className="h-4 w-4 text-red-600" />
                                        PDF
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>
            <div ref={chartRef} id={chartId} className={!title ? 'pt-2' : ''}>
                {children}
            </div>
        </Card>
    );
};

export default ChartWrapper;
