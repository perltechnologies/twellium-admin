import React from 'react';
import SimpleConfigPage from '../../components/SimpleConfigPage';
import { productionApi } from '../../api/production';

const ShrinkNames = () => {
    return (
        <SimpleConfigPage
            title="ShrinkNames"
            api={{
                list: productionApi.getShrinkNames,
                create: productionApi.createShrinkName,
                update: productionApi.updateShrinkName,
                delete: productionApi.deleteShrinkName
            }}
            columns={[{ header: 'Name', accessor: 'name' }]}
            formFields={[{ name: 'name', label: 'Name', required: true }]}
        />
    );
};

export default ShrinkNames;
