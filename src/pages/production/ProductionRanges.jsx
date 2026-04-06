import React from 'react';
import SimpleConfigPage from '../../components/SimpleConfigPage';
import { productionApi } from '../../api/production';

const ProductionRanges = () => {
    return (
        <SimpleConfigPage
            title="Production Ranges"
            description="Define production output ranges"
            api={{
                list: productionApi.getProductionRanges,
                create: productionApi.createProductionRange,
                update: productionApi.updateProductionRange,
                delete: productionApi.deleteProductionRange
            }}
            columns={[
                { header: 'Name', accessor: 'name' },
                { header: 'Start Value', accessor: 'start_value', align: 'right' },
                { header: 'End Value', accessor: 'end_value', align: 'right' }
            ]}
            formFields={[
                { name: 'name', label: 'Range Name', required: true, placeholder: 'e.g., Low, Medium, High' },
                { name: 'start_value', label: 'Start Value', type: 'number', step: '0.01', required: true },
                { name: 'end_value', label: 'End Value', type: 'number', step: '0.01', required: true }
            ]}
            formatValue={(val, key) => {
                if (key === 'start_value' || key === 'end_value') {
                    return val?.toLocaleString();
                }
                return val;
            }}
        />
    );
};

export default ProductionRanges;

export default ProductionRanges;
