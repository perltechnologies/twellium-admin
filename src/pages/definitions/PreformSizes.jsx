import React from 'react';
import SimpleConfigPage from '../../components/SimpleConfigPage';
import { productionApi } from '../../api/production';

const PreformSizes = () => {
    return (
        <SimpleConfigPage
            title="PreformSizes"
            api={{
                list: productionApi.getPreformSizes,
                create: productionApi.createPreformSize,
                update: productionApi.updatePreformSize,
                delete: productionApi.deletePreformSize
            }}
            columns={[{ header: 'Name', accessor: 'name' }]}
            formFields={[{ name: 'name', label: 'Name', required: true }]}
        />
    );
};

export default PreformSizes;
