import { useFilters } from '../context/FilterContext';
import { buildFilterParams } from './filterParams';

export const useApiWithFilters = () => {
  const { filters } = useFilters();
  
  const getParams = (additionalParams = {}) => {
    return { ...buildFilterParams(filters), ...additionalParams };
  };

  return { getParams, filters };
};
