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
    } = data;

    const barcodeValue = String(barcode || '000000000000').trim();
    const prefixChar = barcodeValue.length > 0 ? barcodeValue.charAt(0).toUpperCase() : 'S';

    return (
        <div
            ref={ref}
            className="barcode-label-light-mode p-4 border rounded-lg mx-auto overflow-hidden text-center"
            style={{
                backgroundColor: '#ffffff',
                color: '#000000',
                borderColor: '#cbd5e1',
                width: '380px',
                maxWidth: '100%',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)'
            }}
        >
            {/* Print & Display Styles */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { margin: 0; size: auto; }
                    body { -webkit-print-color-adjust: exact; padding: 0 !important; margin: 0 !important; color: #000000 !important; background: #ffffff !important; }
                    .no-print { display: none !important; }
                    .print-compact { padding: 4px !important; margin: 0 !important; width: 100% !important; border: none !important; background: #ffffff !important; color: #000000 !important; }
                }
                .barcode-label-light-mode {
                    background-color: #ffffff !important;
                    color: #000000 !important;
                }
                .barcode-label-light-mode h1,
                .barcode-label-light-mode h2,
                .barcode-label-light-mode p,
                .barcode-label-light-mode span,
                .barcode-label-light-mode div {
                    color: #000000 !important;
                }
                .barcode-label-light-mode canvas {
                    background-color: #ffffff !important;
                    display: block !important;
                    margin: 0 auto !important;
                }
            `}} />

            <div className="d-flex flex-column align-items-center text-center w-100" style={{ backgroundColor: '#ffffff' }}>
                {/* Product Name at the Very Top */}
                <h2
                    className="text-uppercase tracking-tight leading-none mb-1 text-center w-100"
                    style={{ fontSize: '1.35rem', fontWeight: 900, color: '#000000', wordBreak: 'break-word', margin: 0 }}
                >
                    {product_name || 'N/A'}
                </h2>

                {/* Header prefix */}
                <h1
                    className="tracking-tighter text-uppercase mb-2 text-center w-100"
                    style={{ fontSize: '2rem', fontWeight: 900, color: '#000000', margin: 0 }}
                >
                    {prefixChar}
                </h1>

                {/* Barcode Graphic - Canvas renderer guarantees black bars on pure white background */}
                <div
                    className="py-1 d-flex justify-content-center align-items-center w-100"
                    style={{ backgroundColor: '#ffffff', minHeight: '100px' }}
                >
                    <Barcode
                        value={barcodeValue}
                        renderer="canvas"
                        width={2.0}
                        height={75}
                        fontSize={15}
                        font="monospace"
                        fontOptions="bold"
                        background="#ffffff"
                        lineColor="#000000"
                        margin={6}
                        displayValue={true}
                    />
                </div>

                {/* Details Section */}
                <div
                    className="w-100 pt-3 mt-2"
                    style={{ borderTop: '3px solid #000000', textAlign: 'center', backgroundColor: '#ffffff' }}
                >
                    <p className="mb-1" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#000000' }}>
                        {pet_name || 'N/A'}
                    </p>

                    <p className="mb-1" style={{ fontSize: '1.15rem', fontWeight: 800, color: '#000000' }}>
                        <span className="small text-uppercase me-2" style={{ fontSize: '0.82rem', fontWeight: 900 }}>Quantity:</span>
                        {quantity || 0}
                    </p>

                    {pet_sequence !== undefined && pet_sequence !== null && (
                        <p className="mb-1" style={{ fontSize: '1.1rem', fontWeight: 800, color: '#000000' }}>
                            <span className="small text-uppercase me-2" style={{ fontSize: '0.82rem', fontWeight: 900 }}>Sequence:</span>
                            {pet_sequence}
                        </p>
                    )}

                    <div className="pt-2 mt-2" style={{ borderTop: '1px solid #cbd5e1', backgroundColor: '#ffffff' }}>
                        <p className="font-monospace mb-0" style={{ fontSize: '0.85rem', fontWeight: 700, color: '#000000' }}>
                            {format(new Date(timestamp), 'yyyy-MM-dd HH:mm:ss')}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
});

export default BarcodeLabel;
