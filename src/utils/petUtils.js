/**
 * Formats and sorts PET lines numerically (Pet 1, Pet 2, Pet 3, ..., Pet 10, etc.)
 * Filters out CAN lines and non-PET items.
 */
export const formatAndSortPets = (rawList) => {
    if (!rawList) return [];
    
    let list = [];
    if (Array.isArray(rawList)) {
        list = rawList;
    } else if (rawList.data && Array.isArray(rawList.data)) {
        list = rawList.data;
    } else if (rawList.results && Array.isArray(rawList.results)) {
        list = rawList.results;
    } else if (rawList.data?.data && Array.isArray(rawList.data.data)) {
        list = rawList.data.data;
    }

    return list
        .filter(p => !(p.pet_name || p.name || '').toLowerCase().includes('can'))
        .map((p, index) => {
            const rawLabel = String(p.pet_name || p.name || '');
            const match = rawLabel.match(/\d+/);
            const petNumber = match ? parseInt(match[0], 10) : index + 1;
            const displayName = `Pet ${petNumber}`;
            return {
                ...p,
                id: p.id,
                value: p.id,
                pet_name: displayName,
                label: displayName,
                rawName: rawLabel,
                petNumber,
            };
        })
        .sort((a, b) => a.petNumber - b.petNumber);
};
