import React from 'react';
import SimpleConfigPage from '../../components/SimpleConfigPage';
import { productionApi } from '../../api/production';

const SyrupDensities = () => {
    return (
        <SimpleConfigPage
            title="Syrup Densities"
            description="Manage syrup density standards for production"
            api={{
                list: productionApi.getSyrupDensities,
                create: productionApi.createSyrupDensity,
                update: productionApi.updateSyrupDensity,
                delete: productionApi.deleteSyrupDensity
            }}
            columns={[
                { header: 'Name', accessor: 'name' },
                { header: 'Value', accessor: 'value', align: 'right' },
                { header: 'Unit', accessor: 'unit' }
            ]}
            formFields={[
                { name: 'name', label: 'Density Name', required: true, placeholder: 'e.g., Standard Syrup, High Brix' },
                { name: 'value', label: 'Density Value', type: 'number', step: '0.001', required: true, help: 'Typical range: 1.2 - 1.4 g/mL' },
                { name: 'unit', label: 'Unit', type: 'select', required: true, defaultValue: 'g/mL', options: [
                    { value: 'g/mL', label: 'g/mL' },
                    { value: 'kg/L', label: 'kg/L' }
                ]}
            ]}
        />
    );
};

export default SyrupDensities;
