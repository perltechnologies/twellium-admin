import React from 'react';
import SimpleConfigPage from '../../components/SimpleConfigPage';
import { productionApi } from '../../api/production';

const StandardCO2Levels = () => {
    return (
        <SimpleConfigPage
            title="Standard CO2 Levels"
            description="Manage CO2 carbonation standards for production"
            api={{
                list: productionApi.getStandardCO2s,
                create: productionApi.createStandardCO2,
                update: productionApi.updateStandardCO2,
                delete: productionApi.deleteStandardCO2
            }}
            columns={[
                { header: 'Name', accessor: 'name' },
                { header: 'Value (g/L)', accessor: 'value', align: 'right' }
            ]}
            formFields={[
                { name: 'name', label: 'Level Name', required: true, placeholder: 'e.g., Standard, High Carbonation' },
                { name: 'value', label: 'CO2 Value (g/L)', type: 'number', step: '0.01', required: true, help: 'Typical range: 3.5 - 4.5 g/L' }
            ]}
        />
    );
};

export default StandardCO2Levels;
