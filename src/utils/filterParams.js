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
    // Reports API uses datetime format
    if (filters.start_date && filters.end_date) {
      params.datetime_start_time = new Date(filters.start_date + 'T00:00:00Z').toISOString();
      params.datetime_end_time = new Date(filters.end_date + 'T23:59:59Z').toISOString();
    } else if (filters.log_date) {
      params.datetime_start_time = new Date(filters.log_date + 'T00:00:00Z').toISOString();
      params.datetime_end_time = new Date(filters.log_date + 'T23:59:59Z').toISOString();
    }
  }
  
  if (filters.pet) params.pet_id = filters.pet;
  if (filters.shift) params.shift_name = filters.shift;
  
  return params;
};

export const DEFAULT_FILTERS = {
  page_size: 1000,
  log_date: new Date().toISOString().split('T')[0],
  start_date: null,
  end_date: null,
  pet: null
};
