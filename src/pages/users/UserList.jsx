import React from 'react';
import GenericCrudPage from '../production/GenericCrudPage';
import { usersApi } from '../../api/users';
import { useNavigate } from 'react-router-dom';

const UserList = () => {
    const navigate = useNavigate();

    return (
        <GenericCrudPage
            title="User Management"
            api={{
                list: usersApi.getUsers,
                delete: usersApi.deleteUser,
            }}
            columns={[
                { header: 'ID', accessor: 'id' },
                { header: 'Username', accessor: 'username' },
                { header: 'Full Name', accessor: 'full_name' },
                { header: 'Email', accessor: 'email' },
                { header: 'Role', accessor: 'role', render: (row) => <span className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-300">{row.role}</span> },
                { header: 'Company', accessor: 'company_name' },
            ]}
            onAdd={() => navigate('/dashboard/users/new')}
            onEdit={(row) => navigate(`/dashboard/users/${row.id}/edit`)}
        />
    );
};

export default UserList;
