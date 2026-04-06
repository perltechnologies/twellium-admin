import React from 'react';
import SimpleConfigPage from '../../components/SimpleConfigPage';
import { productionApi } from '../../api/production';

const BottlesPerPack = () => {
    return (
        <SimpleConfigPage
            title="Bottles Per Pack"
            description="Manage bottles per pack configurations"
            api={{
                list: productionApi.getBottlesPerPack,
                create: productionApi.createBottlesPerPack,
                update: productionApi.updateBottlesPerPack,
                delete: productionApi.deleteBottlesPerPack
            }}
            columns={[
                { header: 'Name', accessor: 'name' },
                { header: 'Value', accessor: 'value', align: 'right' }
            ]}
            formFields={[
                { name: 'name', label: 'Pack Name', required: true, placeholder: 'e.g., Standard Pack, Case' },
                { name: 'value', label: 'Bottles Count', type: 'number', required: true, placeholder: 'e.g., 12, 24' }
            ]}
        />
    );
};

export default BottlesPerPack;
