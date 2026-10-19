import React from 'react';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PacksAnalytics from './PacksAnalytics';
import { productionApi } from '../../api/production';

jest.mock('../../api/production', () => ({
    productionApi: { getProductionSummary: jest.fn() },
}));
jest.mock('../../utils/exportUtils', () => ({ exportToExcel: jest.fn() }));
// recharts needs layout; not under test here
jest.mock('recharts', () => {
    const Passthrough = ({ children }) => <div>{children}</div>;
    return {
        ResponsiveContainer: Passthrough, BarChart: Passthrough, Bar: () => null, XAxis: () => null,
        YAxis: () => null, CartesianGrid: () => null, Tooltip: () => null, Legend: () => null,
    };
});

const iso = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const response = {
    data: {
        data: {
            daily_breakdown: [
                {
                    date: iso(-1),
                    pets: [
                        { pet_name: 'Pet 1', product_name: 'Rush', shift: 'DAY', total_packs: 100 },
                        { pet_name: 'Pet 2', product_name: 'Cola', shift: 'DAY', total_packs: 40 },
                        { pet_name: 'Can Line', product_name: 'Rush', shift: 'DAY', total_packs: 999 },
                    ],
                },
                {
                    date: iso(0),
                    pets: [
                        { pet_name: 'Pet 1', product_name: 'Cola', shift: 'NIGHT', total_packs: 60 },
                        { pet_name: 'Pet 1', product_name: 'Rush', shift: 'DAY', total_packs: 25 },
                    ],
                },
            ],
        },
    },
};

const statValue = (label) => screen.getByText(label).parentElement.querySelector('h2').textContent;

describe('PacksAnalytics', () => {
    beforeEach(() => productionApi.getProductionSummary.mockResolvedValue(response));

    test('totals packs across the range and ignores can lines', async () => {
        render(<PacksAnalytics />);
        await waitFor(() => expect(statValue('Total Packs')).toBe('225'));
        expect(productionApi.getProductionSummary).toHaveBeenCalledWith(
            expect.objectContaining({ start_date: expect.any(String), end_date: iso(0) })
        );
    });

    test('filters by product', async () => {
        render(<PacksAnalytics />);
        await waitFor(() => expect(statValue('Total Packs')).toBe('225'));
        await userEvent.selectOptions(screen.getByDisplayValue('All products'), 'Cola');
        expect(statValue('Total Packs')).toBe('100');
    });

    test('filters by PET line and by product together', async () => {
        render(<PacksAnalytics />);
        await waitFor(() => expect(statValue('Total Packs')).toBe('225'));
        await userEvent.selectOptions(screen.getByDisplayValue('All PET lines'), 'Pet 1');
        expect(statValue('Total Packs')).toBe('185');
        await userEvent.selectOptions(screen.getByDisplayValue('All products'), 'Rush');
        expect(statValue('Total Packs')).toBe('125');
    });

    test('drilling into a product row applies the filter', async () => {
        render(<PacksAnalytics />);
        await waitFor(() => expect(statValue('Total Packs')).toBe('225'));
        // the chart breakdown toggle is first; the table tab is second
        await userEvent.click(screen.getAllByRole('button', { name: /By product/ })[1]);
        const rows = screen.getAllByRole('row');
        const colaRow = rows.find((row) => within(row).queryByText('Cola'));
        await userEvent.click(colaRow);
        expect(screen.getByDisplayValue('Cola')).toBeInTheDocument();
        expect(statValue('Total Packs')).toBe('100');
    });

    test('rejects an inverted date range without fetching', async () => {
        render(<PacksAnalytics />);
        await waitFor(() => expect(statValue('Total Packs')).toBe('225'));
        productionApi.getProductionSummary.mockClear();
        const [start] = screen.getAllByLabelText(/date/i);
        await userEvent.clear(start);
        await userEvent.type(start, iso(5));
        expect(await screen.findByText(/Start date must be on or before/)).toBeInTheDocument();
        expect(productionApi.getProductionSummary).not.toHaveBeenCalled();
    });
});
