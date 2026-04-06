import React from 'react';
import SimpleConfigPage from '../../components/SimpleConfigPage';
import { productionApi } from '../../api/production';

const CapTypes = () => {
    return (
        <SimpleConfigPage
            title="Cap Types"
            description="Manage cap type options"
            api={{
                list: productionApi.getCapTypes,
                create: productionApi.createCapType,
                update: productionApi.updateCapType,
                delete: productionApi.deleteCapType
            }}
            columns={[{ header: 'Cap Type', accessor: 'name' }]}
            formFields={[{ name: 'name', label: 'Cap Type Name', required: true, placeholder: 'e.g., Screw Cap, Sport Cap' }]}
        />
    );
};

export default CapTypes;
