import React, { useEffect, useState } from 'react';
import { useFilters } from '../context/FilterContext';
import { productionApi } from '../api/production';

const FilterInputs = ({ showPageSize = false }) => {
  const { filters, updateFilters } = useFilters();
  const [pets, setPets] = useState([]);

  useEffect(() => {
    productionApi.getPets({ page_size: 1000 })
      .then(res => setPets(res.data.data || []))
      .catch(err => console.error('Failed to load pets:', err));
  }, []);

  return (
    <div className="row mb-3">
      <div className={showPageSize ? "col-md-4" : "col-md-6"}>
        <label className="form-label">Date</label>
        <input
          type="date"
          className="form-control"
          value={filters.log_date}
          onChange={(e) => updateFilters({ log_date: e.target.value })}
        />
      </div>
      <div className={showPageSize ? "col-md-4" : "col-md-6"}>
        <label className="form-label">PET</label>
        <select
          className="form-select"
          value={filters.pet || ''}
          onChange={(e) => updateFilters({ pet: e.target.value || null })}
        >
          <option value="">All</option>
          {pets.map(pet => (
            <option key={pet.id} value={pet.id}>{pet.pet_name}</option>
          ))}
        </select>
      </div>
      {showPageSize && (
        <div className="col-md-4">
          <label className="form-label">Page Size</label>
          <select
            className="form-select"
            value={filters.page_size}
            onChange={(e) => updateFilters({ page_size: e.target.value })}
          >
            <option value="10">10</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="1000">1000</option>
          </select>
        </div>
      )}
    </div>
  );
};

export default FilterInputs;
