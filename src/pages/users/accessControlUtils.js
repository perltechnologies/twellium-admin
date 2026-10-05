export const unwrapData = (response) => response?.data?.data ?? response?.data ?? response;

export const unwrapList = (response) => {
    const payload = unwrapData(response);
    if (Array.isArray(payload)) return payload;
    return Array.isArray(payload?.results) ? payload.results : [];
};

export const formatAccessApiError = (error, fallback = 'The request could not be completed.') => {
    const payload = error?.response?.data?.data ?? error?.response?.data;
    if (typeof payload?.message === 'string') return payload.message;
    if (typeof payload?.detail === 'string') return payload.detail;
    if (payload && typeof payload === 'object') {
        const messages = Object.entries(payload).flatMap(([field, value]) => {
            if (['status_code', 'message'].includes(field)) return [];
            const detail = Array.isArray(value) ? value.join(' ') : String(value);
            return `${field.replaceAll('_', ' ')}: ${detail}`;
        });
        if (messages.length) return messages.join(' ');
    }
    return fallback;
};

export const FALLBACK_BASE_ROLES = [
    ['OPERATOR', 'Operator'],
    ['SUPERVISOR', 'Supervisor'],
    ['QUALITY_CONTROL', 'Quality Control'],
    ['WAREHOUSE_CLERK', 'Warehouse Clerk'],
    ['DRIVER', 'Driver'],
    ['DISPATCHER', 'Dispatcher'],
    ['VIEWER', 'Viewer'],
    ['ADMIN', 'Administrator'],
].map(([value, label]) => ({ value, label }));

export const normalizeBaseRoles = (response) => {
    const payload = unwrapData(response);
    const source = Array.isArray(payload) ? payload
        : (Array.isArray(payload?.results) ? payload.results
            : (Array.isArray(payload?.choices) ? payload.choices : null));
    if (source) {
        const normalized = source.map((item) => {
            if (Array.isArray(item)) return { value: String(item[0]), label: String(item[1] ?? item[0]) };
            if (typeof item === 'string') return { value: item, label: item.replaceAll('_', ' ') };
            const value = item.value ?? item.key ?? item.code ?? item.role;
            return value == null ? null : { value: String(value), label: String(item.label ?? item.name ?? item.display_name ?? value) };
        }).filter(Boolean);
        if (normalized.length) return normalized;
    }
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        const ignored = new Set(['status_code', 'message', 'count', 'next', 'previous']);
        const normalized = Object.entries(payload)
            .filter(([key, value]) => !ignored.has(key) && ['string', 'number'].includes(typeof value))
            .map(([value, label]) => ({ value, label: String(label) }));
        if (normalized.length) return normalized;
    }
    return FALLBACK_BASE_ROLES;
};
