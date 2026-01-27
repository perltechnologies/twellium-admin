import React from 'react';
import GenericCrudPage from '../production/GenericCrudPage';
import { inventoryApi } from '../../api/inventory';
import { useNavigate } from 'react-router-dom';

const ProductList = () => {
    const navigate = useNavigate();

    return (
        <GenericCrudPage
            title="Products"
            api={{
                list: inventoryApi.getProducts,
                delete: inventoryApi.deleteProduct,
            }}
            columns={[
                { header: 'ID', accessor: 'id' },
                { header: 'SKU Code', accessor: 'sku_code' },
                { header: 'Name', accessor: 'name' },
                { header: 'Size', accessor: 'size' },
                { header: 'Density', accessor: 'standard_density' },
                { header: 'GV', accessor: 'gv' },
                { header: 'GV Sum', accessor: 'gv_sum' },
                { header: 'Dilution', accessor: 'dilution_ratio' },
            ]}
            onAdd={() => navigate('/dashboard/inventory/products/new')}
            onEdit={(row) => navigate(`/dashboard/inventory/products/${row.id}/edit`)}
        />
    );
};

export default ProductList;
