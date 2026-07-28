import React from 'react';
import SimpleConfigPage from '../../components/SimpleConfigPage';
import { productionApi } from '../../api/production';

const CageQuantities = () => {
    return (
        <SimpleConfigPage
            title="Cage Quantities"
            api={{
                list: productionApi.getCageQuantities,
                create: productionApi.createCageQuantity,
                update: productionApi.updateCageQuantity,
                delete: productionApi.deleteCageQuantity
            }}
            columns={[{ header: 'Quantity (pcs)', accessor: 'value_pcs' }]}
            formFields={[{ name: 'value_pcs', label: 'Quantity per Cage', required: true, type: 'number' }]}
        />
    );
};

export default CageQuantities;
