import React from 'react';
import SimpleConfigPage from '../../components/SimpleConfigPage';
import { productionApi } from '../../api/production';

const Suppliers = () => {
    return (
        <SimpleConfigPage
            title="Suppliers"
            description="Manage material suppliers"
            api={{
                list: productionApi.getSuppliers,
                create: productionApi.createSupplier,
                update: productionApi.updateSupplier,
                delete: productionApi.deleteSupplier
            }}
            columns={[{ header: 'Name', accessor: 'name' }]}
            formFields={[{ name: 'name', label: 'Supplier Name', required: true, placeholder: 'e.g., ABC Plastics' }]}
        />
    );
};

export default Suppliers;
