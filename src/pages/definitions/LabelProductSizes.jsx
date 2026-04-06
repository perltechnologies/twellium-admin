import React from 'react';
import SimpleConfigPage from '../../components/SimpleConfigPage';
import { productionApi } from '../../api/production';

const LabelProductSizes = () => {
    return (
        <SimpleConfigPage
            title="LabelProductSizes"
            api={{
                list: productionApi.getLabelProductSizes,
                create: productionApi.createLabelProductSize,
                update: productionApi.updateLabelProductSize,
                delete: productionApi.deleteLabelProductSize
            }}
            columns={[{ header: 'Name', accessor: 'name' }]}
            formFields={[{ name: 'name', label: 'Name', required: true }]}
        />
    );
};

export default LabelProductSizes;
