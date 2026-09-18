import {
    aggregateDowntimeCategories,
    classifyDowntime,
    DOWNTIME_CLASSIFICATION,
    parseDowntimeMinutes,
} from './downtime';

describe('downtime classification', () => {
    test('does not classify unplanned as planned', () => {
        expect(classifyDowntime({ category_name: 'Unplanned Downtime' }))
            .toBe(DOWNTIME_CLASSIFICATION.UNPLANNED);
    });

    test('uses the explicit API category type before a legacy name', () => {
        expect(classifyDowntime({
            downtime_category_type: 'PLANNED',
            downtime_category_name: 'Mechanical maintenance',
        })).toBe(DOWNTIME_CLASSIFICATION.PLANNED);
    });

    test('moves a planned subcategory out of a mechanical parent', () => {
        const categories = [{
            category_name: 'Mechanical Downtime',
            total_duration_mins: 30,
            sub_categories: [
                { sub_category_name: 'Planned maintenance', total_duration_mins: 10 },
                { sub_category_name: 'Filler breakdown', total_duration_mins: 20 },
            ],
        }];

        const { totals } = aggregateDowntimeCategories(categories);
        expect(totals.planned).toBe(10);
        expect(totals.mechanical).toBe(20);
        expect(totals.planned + totals.mechanical).toBe(30);
    });

    test('uses an incident subcategory before its legacy parent category name', () => {
        expect(classifyDowntime({
            downtime_category_name: 'Mechanical Downtime',
            sub_downtime_category_name: 'Planned maintenance',
        })).toBe(DOWNTIME_CLASSIFICATION.PLANNED);
    });

    test('retains a category remainder without double counting', () => {
        const { totals, entries } = aggregateDowntimeCategories([{
            category_name: 'Planned Downtime',
            total_duration_mins: 20,
            sub_categories: [{ sub_category_name: 'Changeover', total_duration_mins: 15 }],
        }]);

        expect(totals.planned).toBe(20);
        expect(entries.reduce((sum, entry) => sum + entry.duration, 0)).toBe(20);
    });

    test('parses API duration strings as minutes', () => {
        expect(parseDowntimeMinutes('01:30:30')).toBe(90.5);
    });
});
