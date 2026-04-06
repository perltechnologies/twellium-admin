import React from 'react';
import SimpleConfigPage from '../../components/SimpleConfigPage';
import { productionApi } from '../../api/production';

const ShrinkProductSizes = () => {
    return (
        <SimpleConfigPage
            title="ShrinkProductSizes"
            api={{
                list: productionApi.getShrinkProductSizes,
                create: productionApi.createShrinkProductSize,
                update: productionApi.updateShrinkProductSize,
                delete: productionApi.deleteShrinkProductSize
            }}
            columns={[{ header: 'Name', accessor: 'name' }]}
            formFields={[{ name: 'name', label: 'Name', required: true }]}
        />
    );
};

export default ShrinkProductSizes;
