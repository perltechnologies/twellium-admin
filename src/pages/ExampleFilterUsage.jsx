import React, { useEffect, useState } from 'react';
import { Container } from 'react-bootstrap';
import FilterInputs from '../components/FilterInputs';
import { useApiWithFilters } from '../utils/useApiWithFilters';
import { productionApi } from '../api/production';

const ExamplePage = () => {
  const { getParams } = useApiWithFilters();
  const [reports, setReports] = useState([]);
  const [stoppages, setStoppages] = useState([]);

  useEffect(() => {
    loadData();
  }, [getParams()]);

  const loadData = async () => {
    try {
      // Automatically includes page_size, log_date, and pet filters
      const reportsRes = await productionApi.getReports(getParams());
      setReports(reportsRes.data.data || []);

      const stoppagesRes = await productionApi.getStoppages(getParams());
      setStoppages(stoppagesRes.data.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  return (
    <Container>
      <h2>Example Page with Filters</h2>
      <FilterInputs />
      
      <div>
        <h3>Reports: {reports.length}</h3>
        <h3>Stoppages: {stoppages.length}</h3>
      </div>
    </Container>
  );
};

export default ExamplePage;
