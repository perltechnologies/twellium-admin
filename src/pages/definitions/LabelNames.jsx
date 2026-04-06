import React from 'react';
import SimpleConfigPage from '../../components/SimpleConfigPage';
import { productionApi } from '../../api/production';

const LabelNames = () => {
    return (
        <SimpleConfigPage
            title="LabelNames"
            api={{
                list: productionApi.getLabelNames,
                create: productionApi.createLabelName,
                update: productionApi.updateLabelName,
                delete: productionApi.deleteLabelName
            }}
            columns={[{ header: 'Name', accessor: 'name' }]}
            formFields={[{ name: 'name', label: 'Name', required: true }]}
        />
    );
};

export default LabelNames;
