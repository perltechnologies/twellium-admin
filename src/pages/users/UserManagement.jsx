import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PermissionManagement from './PermissionManagement';
import RoleManagement from './RoleManagement';
import UserList from './UserList';

const UserManagement = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const requestedTab = searchParams.get('tab');
    const activeTab = ['users', 'roles', 'permissions'].includes(requestedTab) ? requestedTab : 'users';
    const setActiveTab = (tab) => setSearchParams(tab === 'users' ? {} : { tab });

    return <div className="container-fluid">
        <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
            <div><h4 className="mb-1">Access Management</h4><p className="text-muted mb-0">Manage users, custom roles, and API permissions.</p></div>
            <button className="btn btn-primary" onClick={() => navigate('/dashboard/users/new')}><i className="ti ti-user-plus me-2" />Add New User</button>
        </div>

        <div className="card mb-4"><div className="card-body pb-0"><ul className="nav nav-tabs border-bottom-0" role="tablist" aria-label="Access management sections">
            {[['users', 'ti-users', 'Users'], ['roles', 'ti-user-shield', 'Roles'], ['permissions', 'ti-lock-access', 'Permissions']].map(([tab, icon, label]) => <li className="nav-item" role="presentation" key={tab}>
                <button className={`nav-link ${activeTab === tab ? 'active' : ''}`} type="button" role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)}><i className={`ti ${icon} me-2`} />{label}</button>
            </li>)}
        </ul></div></div>

        <div role="tabpanel" aria-label={activeTab}>
            {activeTab === 'users' && <UserList embedded />}
            {activeTab === 'roles' && <RoleManagement />}
            {activeTab === 'permissions' && <PermissionManagement />}
        </div>
    </div>;
};

export default UserManagement;
