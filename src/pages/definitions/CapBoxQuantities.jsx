import React from 'react';
import SimpleConfigPage from '../../components/SimpleConfigPage';
import { productionApi } from '../../api/production';

const CapBoxQuantities = () => {
    return (
        <SimpleConfigPage
            title="Cap Box Quantities"
            api={{
                list: productionApi.getCapBoxQuantities,
                create: productionApi.createCapBoxQuantity,
                update: productionApi.updateCapBoxQuantity,
                delete: productionApi.deleteCapBoxQuantity
            }}
            columns={[{ header: 'Quantity (pcs)', accessor: 'value_pcs' }]}
            formFields={[{ name: 'value_pcs', label: 'Quantity per Box', required: true, type: 'number' }]}
        />
    );
};

export default CapBoxQuantities;
