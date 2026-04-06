import React from 'react';
import SimpleConfigPage from '../../components/SimpleConfigPage';
import { productionApi } from '../../api/production';

const CageQuantities = () => {
    return (
        <SimpleConfigPage
            title="CageQuantities"
            api={{
                list: productionApi.getCageQuantities,
                create: productionApi.createCageQuantitie,
                update: productionApi.updateCageQuantitie,
                delete: productionApi.deleteCageQuantitie
            }}
            columns={[{ header: 'Name', accessor: 'name' }]}
            formFields={[{ name: 'name', label: 'Name', required: true }]}
        />
    );
};

export default CageQuantities;
