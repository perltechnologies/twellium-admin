export const DOWNTIME_CLASSIFICATION = Object.freeze({
    PLANNED: 'planned',
    MECHANICAL: 'mechanical',
    UNPLANNED: 'unplanned',
    OTHER: 'other',
});

const TYPE_FIELDS = [
    'downtime_category_type',
    'category_type',
    'downtime_type',
    'type',
];

const NAME_FIELDS = [
    'sub_downtime_category_name',
    'sub_category_name',
    'downtime_category_name',
    'category_name',
    'name',
];

const classifyText = (value) => {
    const text = String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
    if (!text) return null;
    // Check unplanned before planned. Word boundaries prevent "unplanned"
    // from being accidentally counted as planned.
    if (/\bunplanned\b/.test(text)) return DOWNTIME_CLASSIFICATION.UNPLANNED;
    if (/\bplanned\b/.test(text)) return DOWNTIME_CLASSIFICATION.PLANNED;
    if (/\bmechanical\b/.test(text)) return DOWNTIME_CLASSIFICATION.MECHANICAL;
    return null;
};

const classificationFromFields = (record, fields) => {
    if (!record) return null;
    for (const field of fields) {
        const classification = classifyText(record[field]);
        if (classification) return classification;
    }
    return null;
};

/**
 * Classify one downtime item exactly once.
 *
 * Explicit API type fields are authoritative. For older payloads, category and
 * subcategory names are used. A planned parent or planned subcategory always
 * stays planned, so it can never leak into mechanical totals.
 */
export function classifyDowntime(record, parentCategory = null) {
    const explicit = classificationFromFields(record, TYPE_FIELDS);
    const parentExplicit = classificationFromFields(parentCategory, TYPE_FIELDS);

    if (explicit) return explicit;
    if (parentExplicit === DOWNTIME_CLASSIFICATION.PLANNED) return parentExplicit;

    const ownName = classificationFromFields(record, NAME_FIELDS);
    const parentName = classificationFromFields(parentCategory, NAME_FIELDS);

    if (ownName === DOWNTIME_CLASSIFICATION.PLANNED || parentName === DOWNTIME_CLASSIFICATION.PLANNED) {
        return DOWNTIME_CLASSIFICATION.PLANNED;
    }
    return ownName || parentExplicit || parentName || DOWNTIME_CLASSIFICATION.OTHER;
}

export function parseDowntimeMinutes(value) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'string' && value.includes(':')) {
        const [hours = 0, minutes = 0, seconds = 0] = value.split(':').map(Number);
        return (Number(hours) || 0) * 60 + (Number(minutes) || 0) + (Number(seconds) || 0) / 60;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Rebuild mutually-exclusive totals from downtime categories. Subcategories
 * take precedence when supplied; any positive category remainder is retained
 * under its parent classification so totals are not lost.
 */
export function aggregateDowntimeCategories(categories = []) {
    const totals = {
        [DOWNTIME_CLASSIFICATION.PLANNED]: 0,
        [DOWNTIME_CLASSIFICATION.MECHANICAL]: 0,
        [DOWNTIME_CLASSIFICATION.UNPLANNED]: 0,
        [DOWNTIME_CLASSIFICATION.OTHER]: 0,
    };
    const entries = [];

    const add = (classification, duration, label, category) => {
        const minutes = parseDowntimeMinutes(duration);
        if (minutes <= 0) return;
        totals[classification] += minutes;
        entries.push({ classification, duration: minutes, label, category });
    };

    categories.forEach((category) => {
        const subCategories = Array.isArray(category.sub_categories) ? category.sub_categories : [];
        const categoryMinutes = parseDowntimeMinutes(category.total_duration_mins);

        if (subCategories.length === 0) {
            add(classifyDowntime(category), categoryMinutes, category.category_name || 'Uncategorized', category.category_name);
            return;
        }

        let subcategoryMinutes = 0;
        subCategories.forEach((subCategory) => {
            const duration = parseDowntimeMinutes(subCategory.total_duration_mins);
            subcategoryMinutes += duration;
            add(
                classifyDowntime(subCategory, category),
                duration,
                subCategory.sub_category_name || 'Unspecified',
                category.category_name
            );
        });

        const remainder = Math.max(0, categoryMinutes - subcategoryMinutes);
        add(classifyDowntime(category), remainder, `${category.category_name || 'Uncategorized'} (unspecified)`, category.category_name);
    });

    return { totals, entries };
}

export function groupDowntimeAndSum(data) {
    const grouped = {};

    data.forEach((item) => {
        (item.incidents || []).forEach((incident) => {
            const categoryName = incident.downtime_category_name || 'Uncategorized';
            const duration = parseDowntimeMinutes(incident.incident_duration);
            if (duration > 0) {
                grouped[categoryName] = (grouped[categoryName] || 0) + duration;
            }
        });
    });

    return Object.entries(grouped).map(([name, total]) => ({
        category: name,
        totalDowntimeMinutes: total,
    }));
}
