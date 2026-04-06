import React from 'react';
import SimpleConfigPage from '../../components/SimpleConfigPage';
import { productionApi } from '../../api/production';

const MeasuringUnits = () => {
    return (
        <SimpleConfigPage
            title="Measuring Units"
            description="Define measurement units for production"
            api={{
                list: productionApi.getMeasuringUnits,
                create: productionApi.createMeasuringUnit,
                update: productionApi.updateMeasuringUnit,
                delete: productionApi.deleteMeasuringUnit
            }}
            columns={[
                { header: 'Name', accessor: 'name' },
                { header: 'Short Name', accessor: 'short_name' },
                { header: 'Value', accessor: 'value', align: 'right' }
            ]}
            formFields={[
                { name: 'name', label: 'Unit Name', required: true, placeholder: 'e.g., Kilogram, Liter' },
                { name: 'short_name', label: 'Short Name', required: true, placeholder: 'e.g., kg, L' },
                { name: 'value', label: 'Value', type: 'number', step: '0.001', required: true, help: 'Base conversion value' }
            ]}
        />
    );
};

export default MeasuringUnits;
