import React from 'react';
import SimpleConfigPage from '../../components/SimpleConfigPage';
import { productionApi } from '../../api/production';

const PreformSizes = () => {
    return (
        <SimpleConfigPage
            title="Preform Sizes"
            api={{
                list: productionApi.getPreformSizes,
                create: productionApi.createPreformSize,
                update: productionApi.updatePreformSize,
                delete: productionApi.deletePreformSize
            }}
            columns={[{ header: 'Weight (g)', accessor: 'value_gr' }]}
            formFields={[{ name: 'value_gr', label: 'Weight (grams)', required: true, type: 'number', step: '0.01' }]}
        />
    );
};

export default PreformSizes;
