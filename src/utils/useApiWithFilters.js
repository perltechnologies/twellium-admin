import { useFilters } from '../context/FilterContext';
import { buildFilterParams } from './filterParams';

export const useApiWithFilters = () => {
  const { filters } = useFilters();
  
  const getParams = (additionalParams = {}, forStoppages = false) => {
    return { ...buildFilterParams(filters, forStoppages), ...additionalParams };
  };

  return { getParams, filters };
};
