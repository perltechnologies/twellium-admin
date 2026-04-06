import React from 'react';
import SimpleConfigPage from '../../components/SimpleConfigPage';
import { productionApi } from '../../api/production';

const CapColors = () => {
    return (
        <SimpleConfigPage
            title="Cap Colors"
            description="Manage cap color options"
            api={{
                list: productionApi.getCapColors,
                create: productionApi.createCapColor,
                update: productionApi.updateCapColor,
                delete: productionApi.deleteCapColor
            }}
            columns={[{ header: 'Color Name', accessor: 'name' }]}
            formFields={[{ name: 'name', label: 'Color Name', required: true, placeholder: 'e.g., Red, Blue, White' }]}
        />
    );
};

export default CapColors;
