// Local-calendar date helpers shared by analytics pages.
// All dates are 'YYYY-MM-DD' strings in the user's local timezone (avoids the
// off-by-one-day errors that toISOString() causes outside UTC).

const pad = (n) => String(n).padStart(2, '0');

export const toYmd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseYmd = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
};

export const addDays = (d, n) => {
    const next = new Date(d);
    next.setDate(next.getDate() + n);
    return next;
};

// Local date key for any timestamp, or null if missing/invalid.
export const toLocalKey = (value) => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : toYmd(d);
};

// Every date from start to end inclusive.
export const listDates = (start, end) => {
    const dates = [];
    for (let d = parseYmd(start); toYmd(d) <= end; d = addDays(d, 1)) dates.push(toYmd(d));
    return dates;
};

export const dayCount = (start, end) => Math.round((parseYmd(end) - parseYmd(start)) / 86400000) + 1;

export const presetRange = (preset) => {
    const today = new Date();
    if (preset === 'month') return { start: toYmd(new Date(today.getFullYear(), today.getMonth(), 1)), end: toYmd(today) };
    const days = preset === '30d' ? 30 : 7;
    return { start: toYmd(addDays(today, -(days - 1))), end: toYmd(today) };
};
