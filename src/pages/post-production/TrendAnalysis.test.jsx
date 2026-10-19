import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TrendAnalysis from './TrendAnalysis';
import { inventoryApi, productionApi, logisticsApi } from '../../api';

jest.mock('../../api', () => ({
    inventoryApi: { getHandlingUnits: jest.fn(), getStages: jest.fn() },
    productionApi: { getPets: jest.fn(), getProductionSummary: jest.fn() },
    logisticsApi: { getShipments: jest.fn() },
}));
jest.mock('../../api/inventory', () => ({ MAIN_WAREHOUSE_STAGE: 'WAREHOUSE', STAGING_WAREHOUSE_STAGE: 'STAGGING' }));
jest.mock('../../utils/exportUtils', () => ({ exportToExcel: jest.fn() }));
jest.mock('recharts', () => {
    const Passthrough = ({ children }) => <div>{children}</div>;
    return {
        ResponsiveContainer: Passthrough, LineChart: Passthrough, BarChart: Passthrough, Line: () => null,
        Bar: () => null, XAxis: () => null, YAxis: () => null, CartesianGrid: () => null, Tooltip: () => null, Legend: () => null,
    };
});

const ymd = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
// noon local time so the local date key is unambiguous
const at = (offset) => `${ymd(offset)}T12:00:00`;

const unit = (offset, pet, product, qty, stage) => ({
    created_at: at(offset), pet_name: pet, product_name: product, quantity: qty, current_status: stage,
});

const units = [
    unit(-5, 'Pet 1', 'Rush', 100, 'STAGGING'),
    unit(-5, 'Pet 1', 'Cola', 50, 'WAREHOUSE'),
    // Pet 2 does not appear on the first day of data (old code dropped it from the chart)
    unit(-2, 'Pet 2', 'Rush', 200, 'WAREHOUSE'),
    unit(-2, 'Pet 1', 'Rush', 10, 'PRODUCTION'),
    unit(-40, 'Pet 1', 'Rush', 999, 'WAREHOUSE'), // outside the default 7-day range
];

const dailyTable = () => screen.getByText('Daily breakdown').closest('.card').querySelector('table');
const kpi = (label) => screen.getByText(label, { exact: false }).closest('.card-body').querySelector('h2').textContent;

beforeEach(() => {
    inventoryApi.getHandlingUnits.mockResolvedValue({ data: { data: { results: units, count: units.length } } });
    inventoryApi.getStages.mockResolvedValue({ data: { data: [{ name: 'STAGGING', display_name: 'Staging Warehouse' }] } });
    productionApi.getPets.mockResolvedValue({ data: { data: [{ id: 1, pet_name: 'Pet 1' }, { id: 2, pet_name: 'Pet 2' }] } });
    logisticsApi.getShipments.mockResolvedValue({ data: { data: [
        { created_at: at(-1), customer_name: 'Acme' },
        { created_at: at(-1), customer_name: 'Acme' },
        { created_at: at(-30), customer_name: 'Old' },
    ] } });
    productionApi.getProductionSummary.mockResolvedValue({ data: { data: { daily_breakdown: [
        { date: ymd(-3), pets: [
            { pet_id: 1, pet_name: 'Pet 1', product_name: 'Rush', total_bottles_produced: 5000, total_bottles: 5100 },
            { pet_id: 2, pet_name: 'Pet 2', product_name: 'Cola', total_bottles_produced: 0, total_bottles: 3000 },
        ] },
    ] } } });
});

describe('TrendAnalysis', () => {
    test('plots every day of the range, including empty days, and all PET lines', async () => {
        render(<TrendAnalysis />);
        await waitFor(() => expect(kpi('Total packs')).toBe('360'));
        const table = dailyTable();
        // 7 default days -> 7 body rows (days with no pallets are present as 0)
        expect(within(table).getAllByRole('row')).toHaveLength(7 + 2); // + header + footer
        const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent);
        expect(headers).toEqual(expect.arrayContaining(['Pet 1', 'Pet 2']));
        expect(screen.getByText('Active days').closest('.card-body').querySelector('h2').textContent).toBe('2 / 7');
    });

    test('product filter applies to packs', async () => {
        render(<TrendAnalysis />);
        await waitFor(() => expect(kpi('Total packs')).toBe('360'));
        await userEvent.selectOptions(screen.getByLabelText('Product'), 'Cola');
        expect(kpi('Total packs')).toBe('50');
    });

    test('PET line filter matches by id', async () => {
        render(<TrendAnalysis />);
        await waitFor(() => expect(kpi('Total packs')).toBe('360'));
        await userEvent.selectOptions(screen.getByLabelText('PET line'), '2');
        expect(kpi('Total packs')).toBe('200');
    });

    test('warehouse tab filters by stage and product', async () => {
        render(<TrendAnalysis />);
        await waitFor(() => expect(kpi('Total packs')).toBe('360'));
        await userEvent.click(screen.getByRole('button', { name: /Warehouse Stages/ }));
        expect(kpi('Total pallets')).toBe('4');
        await userEvent.selectOptions(screen.getByLabelText('Stage'), 'WAREHOUSE');
        expect(kpi('Total pallets')).toBe('2');
        await userEvent.selectOptions(screen.getByLabelText('Product'), 'Cola');
        expect(kpi('Total pallets')).toBe('1');
    });

    test('bottles tab uses the production summary for the selected range', async () => {
        render(<TrendAnalysis />);
        await waitFor(() => expect(kpi('Total packs')).toBe('360'));
        await userEvent.click(screen.getByRole('button', { name: /^Bottles/ }));
        await waitFor(() => expect(kpi('Total bottles')).toBe('8,000')); // 5000 finalized + 3000 live fallback
        expect(productionApi.getProductionSummary).toHaveBeenCalledWith({ start_date: ymd(-6), end_date: ymd(0) });
        await userEvent.selectOptions(screen.getByLabelText('Product'), 'Rush');
        expect(kpi('Total bottles')).toBe('5,000');
    });

    test('customer dispatch respects the date range', async () => {
        render(<TrendAnalysis />);
        await waitFor(() => expect(kpi('Total packs')).toBe('360'));
        await userEvent.click(screen.getByRole('button', { name: /Customer Dispatch/ }));
        expect(kpi('Total shipments')).toBe('2');
    });
});
