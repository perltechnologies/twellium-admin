import React from 'react';
import SimpleConfigPage from '../../components/SimpleConfigPage';
import { productionApi } from '../../api/production';

const CapBoxQuantities = () => {
    return (
        <SimpleConfigPage
            title="CapBoxQuantities"
            api={{
                list: productionApi.getCapBoxQuantities,
                create: productionApi.createCapBoxQuantitie,
                update: productionApi.updateCapBoxQuantitie,
                delete: productionApi.deleteCapBoxQuantitie
            }}
            columns={[{ header: 'Name', accessor: 'name' }]}
            formFields={[{ name: 'name', label: 'Name', required: true }]}
        />
    );
};

export default CapBoxQuantities;
