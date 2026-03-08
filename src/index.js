import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { ThemeProvider } from './context/ThemeContext';
import { RefreshProvider } from './context/RefreshContext';
import { FilterProvider } from './context/FilterContext';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <RefreshProvider>
        <FilterProvider>
          <App />
        </FilterProvider>
      </RefreshProvider>
    </ThemeProvider>
  </React.StrictMode>
);


reportWebVitals();
