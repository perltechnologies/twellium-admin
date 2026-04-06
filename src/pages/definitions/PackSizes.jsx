import React from 'react';
import SimpleConfigPage from '../../components/SimpleConfigPage';
import { productionApi } from '../../api/production';

const PackSizes = () => {
    return (
        <SimpleConfigPage
            title="PackSizes"
            api={{
                list: productionApi.getPackSizes,
                create: productionApi.createPackSize,
                update: productionApi.updatePackSize,
                delete: productionApi.deletePackSize
            }}
            columns={[{ header: 'Name', accessor: 'name' }]}
            formFields={[{ name: 'name', label: 'Name', required: true }]}
        />
    );
};

export default PackSizes;
