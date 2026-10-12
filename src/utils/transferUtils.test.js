jest.mock('../api/axios', () => ({}));

import {
    buildTransferId,
    findTransfersById,
    getTransferRoute,
    getUnitDirection,
    DIRECTION_PENDING,
    DIRECTION_PRODUCTION_STAGING,
    DIRECTION_STAGING_WAREHOUSE,
} from './transferUtils';

const unit = (over) => ({
    id: Math.random().toString(36).slice(2),
    product_name: 'Rush Cola',
    pet_name: 'Pet 2',
    quantity: 100,
    current_status: 'PRODUCTION',
    created_at: '2026-09-08T10:00:00Z',
    updated_at: '2026-09-09T10:00:00Z',
    ...over,
});

describe('transferUtils', () => {
    test('buildTransferId formats date, product and pet', () => {
        expect(buildTransferId('2026-09-08', 'Rush Cola', 'Pet 2')).toBe('TR260908-RUSH-P02');
        expect(buildTransferId('unknown', '', 'N/A')).toBe('TR000000-PROD-P00');
    });

    test('findTransfersById groups units and ignores case/spaces', () => {
        const units = [
            unit({}),
            unit({ quantity: 50 }),
            unit({ pet_name: 'Pet 3' }),
            unit({ created_at: '2026-09-07T10:00:00Z' }),
        ];
        const found = findTransfersById(units, ' tr260908-rush-p02 ');
        expect(found).toHaveLength(1);
        expect(found[0].totalPallets).toBe(2);
        expect(found[0].totalPacks).toBe(150);
        expect(findTransfersById(units, 'TR999999-NONE-P01')).toEqual([]);
        expect(findTransfersById(units, '')).toEqual([]);
    });

    test('direction and route follow the current stage', () => {
        expect(getUnitDirection(unit({}))).toBe(DIRECTION_PENDING);
        expect(getUnitDirection(unit({ current_status: 'STAGGING' }))).toBe(DIRECTION_PRODUCTION_STAGING);
        expect(getUnitDirection(unit({ current_status: 'WAREHOUSE' }))).toBe(DIRECTION_STAGING_WAREHOUSE);
        expect(getTransferRoute([unit({})]).targetStage).toBe('STAGGING');
        expect(getTransferRoute([unit({ current_status: 'STAGGING' })]).targetStage).toBe('WAREHOUSE');
    });
});
