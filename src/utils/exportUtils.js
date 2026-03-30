import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const exportToExcel = (data, filename, sheetName = 'Sheet1', title = null) => {
    let ws;
    if (title) {
        // Add title row
        const titleRow = [{ A: title }];
        const wsData = XLSX.utils.json_to_sheet(titleRow, { skipHeader: true });
        XLSX.utils.sheet_add_json(wsData, data, { origin: 'A3', skipHeader: false });
        
        // Merge cells for title
        wsData['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: Object.keys(data[0] || {}).length - 1 } }];
        
        // Style title (bold and larger)
        if (wsData['A1']) {
            wsData['A1'].s = {
                font: { bold: true, sz: 16 },
                alignment: { horizontal: 'center', vertical: 'center' }
            };
        }
        ws = wsData;
    } else {
        ws = XLSX.utils.json_to_sheet(data);
    }
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${filename}.xlsx`);
};

export const exportChartToPDF = async (elementId, filename, title) => {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error('Element not found:', elementId);
        return;
    }

    const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('landscape', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min((pdfWidth - 20) / imgWidth, (pdfHeight - 40) / imgHeight);
    const imgX = (pdfWidth - imgWidth * ratio) / 2;
    const imgY = 20;

    if (title) {
        pdf.setFontSize(16);
        pdf.text(title, pdfWidth / 2, 12, { align: 'center' });
    }

    pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
    pdf.save(`${filename}.pdf`);
};

export const exportMultipleChartsToPDF = async (chartIds, filename, title) => {
    const pdf = new jsPDF('landscape', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    let currentY = 20;

    if (title) {
        pdf.setFontSize(16);
        pdf.text(title, pdfWidth / 2, 12, { align: 'center' });
        currentY = 25;
    }

    for (const chartId of chartIds) {
        const element = document.getElementById(chartId);
        if (!element) continue;

        const canvas = await html2canvas(element, {
            scale: 2,
            backgroundColor: '#ffffff',
            logging: false,
            useCORS: true
        });

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const ratio = Math.min((pdfWidth - 20) / imgWidth, 80 / imgHeight);
        const imgX = (pdfWidth - imgWidth * ratio) / 2;

        if (currentY + imgHeight * ratio > pdf.internal.pageSize.getHeight() - 15) {
            pdf.addPage();
            currentY = 15;
        }

        pdf.addImage(imgData, 'PNG', imgX, currentY, imgWidth * ratio, imgHeight * ratio);
        currentY += imgHeight * ratio + 10;
    }

    pdf.save(`${filename}.pdf`);
};
