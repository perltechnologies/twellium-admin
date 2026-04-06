import React from 'react';
import SimpleConfigPage from '../../components/SimpleConfigPage';
import { productionApi } from '../../api/production';

const LineSpeeds = () => {
    return (
        <SimpleConfigPage
            title="Line Speeds"
            description="Manage production line speed configurations"
            api={{
                list: productionApi.getLineSpeeds,
                create: productionApi.createLineSpeed,
                update: productionApi.updateLineSpeed,
                delete: productionApi.deleteLineSpeed
            }}
            columns={[
                { header: 'Name', accessor: 'name' },
                { header: 'Speed (BPH)', accessor: 'value', align: 'right' }
            ]}
            formFields={[
                { name: 'name', label: 'Speed Name', required: true, placeholder: 'e.g., Standard, High Speed' },
                { name: 'value', label: 'Speed (Bottles Per Hour)', type: 'number', required: true, placeholder: 'e.g., 18000' }
            ]}
            formatValue={(val, key) => {
                if (key === 'value') {
                    return val?.toLocaleString();
                }
                return val;
            }}
        />
    );
};

export default LineSpeeds;
