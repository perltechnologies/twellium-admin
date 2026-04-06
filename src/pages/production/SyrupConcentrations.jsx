import React from 'react';
import SimpleConfigPage from '../../components/SimpleConfigPage';
import { productionApi } from '../../api/production';

const SyrupConcentrations = () => {
    return (
        <SimpleConfigPage
            title="Syrup Concentrations"
            description="Manage syrup concentration standards"
            api={{
                list: productionApi.getSyrupConcentrations,
                create: productionApi.createSyrupConcentration,
                update: productionApi.updateSyrupConcentration,
                delete: productionApi.deleteSyrupConcentration
            }}
            columns={[
                { header: 'Name', accessor: 'name' },
                { header: 'Value', accessor: 'value', align: 'right' },
                { header: 'Unit', accessor: 'unit' }
            ]}
            formFields={[
                { name: 'name', label: 'Concentration Name', required: true, placeholder: 'e.g., Standard, High Brix' },
                { name: 'value', label: 'Concentration Value', type: 'number', step: '0.01', required: true, placeholder: 'e.g., 65' },
                { name: 'unit', label: 'Unit', required: true, placeholder: 'e.g., %, Brix' }
            ]}
        />
    );
};

export default SyrupConcentrations;
