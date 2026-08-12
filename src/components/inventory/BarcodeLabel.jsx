import React from 'react';
import Barcode from 'react-barcode';
import { format } from 'date-fns';

const BarcodeLabel = React.forwardRef(({ data }, ref) => {
    if (!data) return null;

    const {
        barcode,
        product_name,
        pet_name,
        quantity,
        pet_sequence,
        timestamp = new Date(),
        type = 'LABEL'
    } = data;

    return (
        <div ref={ref} className="bg-white p-6 border border-slate-200 rounded-lg shadow-sm print:shadow-none print:border-none print-compact w-[380px] mx-auto overflow-hidden text-slate-900">
            {/* Print Styles */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { margin: 0; size: auto; }
                    body { -webkit-print-color-adjust: exact; padding: 0 !important; margin: 0 !important; color: black !important; }
                    .no-print { display: none !important; }
                    .print-compact { padding: 4px !important; margin: 0 !important; width: 100% !important; border: none !important; }
                }
            `}} />

            <div className="flex flex-col items-center text-center space-y-2">
                {/* Product Name at the Very Top */}
                <h2 className="text-3xl font-black uppercase tracking-tight leading-none mb-1">
                    {product_name || 'N/A'}
                </h2>

                {/* Header (P/S) */}
                <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">
                    {(barcode && typeof barcode === 'string' && barcode.charAt(0)) || 'S'}
                </h1>

                <div className="py-1 scale-110">
                    <Barcode
                        value={barcode || '000000000000'}
                        width={2.2}
                        height={85}
                        fontSize={18}
                        fontOptions="bold"
                        background="transparent"
                    />
                </div>

                <div className="w-full border-t-[3px] border-slate-900 pt-4 space-y-2">
                    <p className="text-xl font-bold">
                        {pet_name || 'N/A'}
                    </p>
                    
                    <p className="text-xl font-bold">
                        <span className="text-sm font-black uppercase mr-2">Quantity:</span>
                        {quantity || 0}
                    </p>

                    {pet_sequence !== undefined && (
                        <p className="text-xl font-bold">
                            <span className="text-sm font-black uppercase mr-2">Sequence:</span>
                            {pet_sequence}
                        </p>
                    )}
                    
                    <div className="pt-2">
                        <p className="text-sm font-mono font-bold border-t border-slate-200 pt-2">
                            {format(new Date(timestamp), 'yyyy-MM-dd HH:mm:ss')}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
});

export default BarcodeLabel;
