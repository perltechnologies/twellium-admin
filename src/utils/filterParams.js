export const buildFilterParams = (filters = {}, forStoppages = false) => {
  const params = {};
  
  if (filters.page_size) params.page_size = filters.page_size;
  
  if (forStoppages) {
    // Stoppages API uses log_date
    if (filters.log_date) {
      params.log_date = filters.log_date;
    } else if (filters.start_date && filters.end_date) {
      params.start_date = filters.start_date;
      params.end_date = filters.end_date;
    }
  } else {
    // Reports/OEE API uses production_date or start_date/end_date
    if (filters.start_date && filters.end_date) {
      params.start_date = filters.start_date;
      params.end_date = filters.end_date;
    } else if (filters.log_date) {
      params.production_date = filters.log_date;
    }
  }
  
  if (filters.pet) params.pet = filters.pet;
  if (filters.sub_category) params.sub_category = filters.sub_category;
  if (filters.shift) params.shift_name = filters.shift;
  
  return params;
};

// Format a Date as YYYY-MM-DD using LOCAL calendar values.
// Avoids the off-by-one that `toISOString()` causes in positive-offset
// timezones (toISOString converts to UTC first, which can roll to the next day).
export const toLocalDateStr = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Default dashboard window: the last 30 days (inclusive of today).
// Landing on a single "today" often shows empty charts because reports for the
// current day may not be logged yet; a recent range surfaces data on load.
const DEFAULT_RANGE_DAYS = 30;
const _today = new Date();
const _rangeStart = new Date(_today);
_rangeStart.setDate(_rangeStart.getDate() - (DEFAULT_RANGE_DAYS - 1));

export const DEFAULT_FILTERS = {
  page_size: 1000,
  log_date: null,
  start_date: toLocalDateStr(_rangeStart),
  end_date: toLocalDateStr(_today),
  pet: null,
  sub_category: null
};
