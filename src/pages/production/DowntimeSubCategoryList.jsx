import React, { useState, useEffect } from 'react';
import GenericCrudPage from './GenericCrudPage';
import { productionApi } from '../../api/production';

const DowntimeSubCategoryList = () => {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const res = await productionApi.getDowntimeCategories({ page_size: 1000 }); // Get all categories
                // Handle various response structures:
                // 1. DRF { results: [...] }
                // 2. Wrapped { data: [...] }
                // 3. Wrapped { data: { results: [...] } }
                const responseData = res.data;
                let listData = [];

                if (Array.isArray(responseData)) {
                    listData = responseData;
                } else if (responseData.results && Array.isArray(responseData.results)) {
                    listData = responseData.results;
                } else if (responseData.data && Array.isArray(responseData.data)) {
                    listData = responseData.data;
                } else if (responseData.data?.results && Array.isArray(responseData.data.results)) {
                    listData = responseData.data.results;
                }

                setCategories(listData.map(cat => ({
                    label: cat.name,
                    value: cat.id
                })));
            } catch (err) {
                console.error("Failed to fetch categories", err);
            } finally {
                setLoading(false);
            }
        };

        fetchCategories();
    }, []);

    if (loading) {
        return <div>Loading...</div>;
    }

    return (
        <GenericCrudPage
            title="Downtime Sub-Categories"
            api={{
                list: productionApi.getDowntimeSubCategories,
                create: productionApi.createDowntimeSubCategory,
                update: productionApi.updateDowntimeSubCategory,
                delete: productionApi.deleteDowntimeSubCategory
            }}
            columns={[
                { header: 'ID', accessor: 'id' },
                { header: 'Category', accessor: 'category_name' },
                { header: 'Sub-Category', accessor: 'name' },
                { header: 'Description', accessor: 'description' },
            ]}
            formFields={[
                {
                    name: 'category',
                    label: 'Category',
                    type: 'select',
                    required: true,
                    options: categories
                },
                { name: 'name', label: 'Sub-Category Name', required: true },
                { name: 'description', label: 'Description', type: 'text', required: false }
            ]}
        />
    );
};

export default DowntimeSubCategoryList;
