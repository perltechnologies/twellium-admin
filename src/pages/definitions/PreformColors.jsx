import React from 'react';
import SimpleConfigPage from '../../components/SimpleConfigPage';
import { productionApi } from '../../api/production';

const PreformColors = () => {
    return (
        <SimpleConfigPage
            title="Preform Colors"
            description="Manage preform color options"
            api={{
                list: productionApi.getPreformColors,
                create: productionApi.createPreformColor,
                update: productionApi.updatePreformColor,
                delete: productionApi.deletePreformColor
            }}
            columns={[{ header: 'Color Name', accessor: 'name' }]}
            formFields={[{ name: 'name', label: 'Color Name', required: true, placeholder: 'e.g., Clear, Blue' }]}
        />
    );
};

export default PreformColors;
