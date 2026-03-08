export const buildFilterParams = (filters = {}) => {
  const params = {};
  
  if (filters.page_size) params.page_size = filters.page_size;
  if (filters.log_date) params.log_date = filters.log_date;
  if (filters.pet) params.pet = filters.pet;
  
  return params;
};

export const DEFAULT_FILTERS = {
  page_size: 1000,
  log_date: new Date().toISOString().split('T')[0],
  pet: null
};
