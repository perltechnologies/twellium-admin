import React from 'react';
import SimpleConfigPage from '../../components/SimpleConfigPage';
import { productionApi } from '../../api/production';

const SyrupDilutionRatios = () => {
    return (
        <SimpleConfigPage
            title="Syrup Dilution Ratios"
            description="Manage syrup dilution ratio standards"
            api={{
                list: productionApi.getSyrupDilutionRatios,
                create: productionApi.createSyrupDilutionRatio,
                update: productionApi.updateSyrupDilutionRatio,
                delete: productionApi.deleteSyrupDilutionRatio
            }}
            columns={[
                { header: 'Name', accessor: 'name' },
                { header: 'Value', accessor: 'value', align: 'right' },
                { header: 'Unit', accessor: 'unit' }
            ]}
            formFields={[
                { name: 'name', label: 'Ratio Name', required: true, placeholder: 'e.g., Standard Mix, High Concentration' },
                { name: 'value', label: 'Ratio Value', type: 'number', step: '0.01', required: true, placeholder: 'e.g., 5.5' },
                { name: 'unit', label: 'Unit', required: true, placeholder: 'e.g., 1:5, parts' }
            ]}
        />
    );
};

export default SyrupDilutionRatios;
