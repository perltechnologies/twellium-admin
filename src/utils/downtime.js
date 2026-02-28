export function groupDowntimeAndSum(data) {
    const grouped = {};

    data.forEach((item) => {
        (item.incidents || []).forEach((incident) => {
            const categoryName = incident.downtime_category_name || 'Uncategorized';
            const duration = parseFloat(incident.incident_duration) || 0;
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
