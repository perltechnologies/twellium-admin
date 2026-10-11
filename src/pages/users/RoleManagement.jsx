import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usersApi } from '../../api/users';
import { formatAccessApiError, unwrapData, unwrapList } from './accessControlUtils';
import './RoleManagement.css';

const emptyForm = { name: '', description: '', permission_ids: [] };

const RoleManagement = () => {
    const [roles, setRoles] = useState([]);
    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const formRef = useRef(null);
    const [permissionSearch, setPermissionSearch] = useState('');
    const [roleSearch, setRoleSearch] = useState('');
    const [notice, setNotice] = useState('');
    const [roleToDelete, setRoleToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [roleResponse, permissionResponse] = await Promise.all([
                usersApi.getRoles({ page_size: 1000 }),
                usersApi.getPermissions({ page_size: 1000 }),
            ]);
            setRoles(unwrapList(roleResponse));
            setPermissions(unwrapList(permissionResponse));
        } catch (loadError) {
            setError(formatAccessApiError(loadError, 'Roles and permissions could not be loaded.'));
        } finally {
            setLoading(false);
            setHasLoaded(true);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const assignedPermissions = useMemo(
        () => permissions.filter((permission) => form.permission_ids.includes(permission.id)),
        [permissions, form.permission_ids]
    );

    const availableGroups = useMemo(() => {
        const query = permissionSearch.trim().toLowerCase();
        return permissions
            .filter((permission) => !form.permission_ids.includes(permission.id))
            .filter((permission) => !query || [permission.module, permission.resource, permission.name, permission.display_name, permission.codename]
                .filter(Boolean).join(' ').toLowerCase().includes(query))
            .reduce((groups, permission) => {
                const moduleName = permission.module || 'Other';
                (groups[moduleName] = groups[moduleName] || []).push(permission);
                return groups;
            }, {});
    }, [permissions, form.permission_ids, permissionSearch]);

    const filteredRoles = useMemo(() => {
        const query = roleSearch.trim().toLowerCase();
        return roles.filter((role) => !query || [role.name, role.description].filter(Boolean).join(' ').toLowerCase().includes(query));
    }, [roles, roleSearch]);

    const permissionCountOf = (role) => role.permission_count ?? role.permissions?.length ?? 0;
    const moduleSummary = (role) => {
        const counts = {};
        (role.permissions || []).forEach((permission) => {
            if (permission && typeof permission === 'object') counts[permission.module || 'Other'] = (counts[permission.module || 'Other'] || 0) + 1;
        });
        return Object.entries(counts).sort((a, b) => b[1] - a[1]);
    };
    const totalPermissions = permissions.length;

    // Bring the editor into view once it opens (it renders above a potentially long table).
    useEffect(() => {
        if (editingId !== null && formRef.current) formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [editingId]);

    const startDuplicate = async (role) => {
        setEditingId('new');
        setPermissionSearch('');
        setNotice('');
        setError('');
        setForm({ name: `${role.name} (copy)`, description: role.description || '', permission_ids: permissionIdsOf(role) });
        try {
            const detail = unwrapData(await usersApi.getRole(role.id));
            if (detail && Array.isArray(detail.permissions)) {
                setForm((current) => ({ ...current, permission_ids: permissionIdsOf(detail) }));
            }
        } catch (detailError) {
            setError(formatAccessApiError(detailError, 'The source role\'s permissions could not be loaded.'));
        }
    };

    const startCreate = () => {
        setNotice('');
        setEditingId('new');
        setPermissionSearch('');
        setForm(emptyForm);
        setError('');
    };

    const permissionIdsOf = (role) => (role?.permissions || [])
        .map((permission) => (permission !== null && typeof permission === 'object' ? permission.id : permission))
        .filter((id) => id !== undefined && id !== null);

    const startEdit = async (role) => {
        setNotice('');
        setEditingId(role.id);
        setPermissionSearch('');
        setError('');
        setForm({ name: role.name || '', description: role.description || '', permission_ids: permissionIdsOf(role) });
        // The list endpoint may omit the permission list, so load the full role before editing.
        try {
            const detail = unwrapData(await usersApi.getRole(role.id));
            if (detail && typeof detail === 'object' && Array.isArray(detail.permissions)) {
                setForm({ name: detail.name || role.name || '', description: detail.description || '', permission_ids: permissionIdsOf(detail) });
            }
        } catch (detailError) {
            setError(formatAccessApiError(detailError, 'The role\'s current permissions could not be loaded.'));
        }
    };

    const togglePermission = (permissionId) => setForm((current) => ({
        ...current,
        permission_ids: current.permission_ids.includes(permissionId)
            ? current.permission_ids.filter((id) => id !== permissionId)
            : [...current.permission_ids, permissionId],
    }));

    const setModulePermissions = (modulePermissions, selected) => setForm((current) => {
        const moduleIds = modulePermissions.map((permission) => permission.id);
        const rest = current.permission_ids.filter((id) => !moduleIds.includes(id));
        return { ...current, permission_ids: selected ? [...rest, ...moduleIds] : rest };
    });

    const submit = async (event) => {
        event.preventDefault();
        if (!form.name.trim()) return setError('Role name is required.');
        setSaving(true);
        setError('');
        try {
            const payload = { ...form, name: form.name.trim(), description: form.description.trim() || null };
            const wasNew = editingId === 'new';
            if (wasNew) await usersApi.createRole(payload);
            else await usersApi.updateRole(editingId, payload);
            setNotice(`Role “${payload.name}” ${wasNew ? 'created' : 'updated'}.`);
            setEditingId(null);
            setForm(emptyForm);
            await load();
        } catch (saveError) {
            setError(formatAccessApiError(saveError, 'The role could not be saved.'));
        } finally {
            setSaving(false);
        }
    };

    const confirmDelete = async () => {
        if (!roleToDelete) return;
        setDeleting(true);
        setError('');
        try {
            await usersApi.deleteRole(roleToDelete.id);
            setNotice(`Role “${roleToDelete.name}” deleted.`);
            if (editingId === roleToDelete.id) setEditingId(null);
            setRoleToDelete(null);
            await load();
        } catch (deleteError) {
            setRoleToDelete(null);
            setError(formatAccessApiError(deleteError, 'The role could not be deleted.'));
        } finally {
            setDeleting(false);
        }
    };

    if (loading && !hasLoaded) return <div className="text-center py-5"><span className="spinner-border text-primary" role="status" /></div>;

    const permissionRow = (permission, action) => <div className={`role-permission-row ${action === 'remove' ? 'is-assigned' : ''}`} key={permission.id}>
        <span className="role-permission-copy"><span className="d-block fw-medium text-truncate">{permission.display_name || permission.name}</span><code>{permission.codename}</code></span>
        {action === 'remove'
            ? <button className="btn btn-outline-danger btn-sm flex-shrink-0" type="button" onClick={() => togglePermission(permission.id)} title="Remove permission"><i className="ti ti-x me-1" />Remove</button>
            : <button className="btn btn-outline-success btn-sm flex-shrink-0" type="button" onClick={() => togglePermission(permission.id)} title="Add permission"><i className="ti ti-plus me-1" />Add</button>}
    </div>;

    return <div className="role-management">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
            <div><h5 className="fw-bold mb-1">Custom roles</h5><p className="text-muted mb-0">Group API permissions and assign the role to users.</p></div>
            <div className="d-flex gap-2">
                <button className="btn btn-outline-secondary btn-sm" type="button" onClick={load} disabled={loading}><i className={`ti ti-refresh me-1 ${loading ? 'spin' : ''}`} />Refresh</button>
                <button className="btn btn-primary btn-sm" type="button" onClick={startCreate}><i className="ti ti-plus me-1" />New Role</button>
            </div>
        </div>
        {error && <div className="alert alert-danger py-2 d-flex align-items-center gap-2"><i className="ti ti-alert-circle" /><span className="flex-grow-1">{error}</span><button type="button" className="btn-close" onClick={() => setError('')} aria-label="Dismiss" /></div>}
        {notice && <div className="alert alert-success py-2 d-flex align-items-center gap-2"><i className="ti ti-circle-check" /><span className="flex-grow-1">{notice}</span><button type="button" className="btn-close" onClick={() => setNotice('')} aria-label="Dismiss" /></div>}

        {editingId !== null && <form ref={formRef} className="card border-primary shadow-sm mb-4 role-editor" onSubmit={submit}>
            <div className="card-header bg-primary-subtle d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center gap-2"><i className={`ti ${editingId === 'new' ? 'ti-plus' : 'ti-edit'} text-primary`} /><strong>{editingId === 'new' ? 'Create role' : `Edit role: ${roles.find((role) => role.id === editingId)?.name || ''}`}</strong></div>
                <button className="btn-close" type="button" onClick={() => setEditingId(null)} aria-label="Close" />
            </div>
            <div className="card-body">
                <div className="row g-3 mb-4">
                    <div className="col-md-4"><label className="form-label">Name *</label><input className="form-control" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Warehouse Supervisor" required /></div>
                    <div className="col-md-8"><label className="form-label">Description</label><input className="form-control" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="What is this role for?" /></div>
                </div>
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                    <div className="d-flex align-items-center gap-2"><i className="ti ti-lock-access text-primary" /><strong>Permissions</strong></div>
                    <div className="d-flex align-items-center gap-2"><span className="badge bg-primary-subtle text-primary">{form.permission_ids.length}{totalPermissions ? ` of ${totalPermissions}` : ''} assigned</span></div>
                </div>
                {totalPermissions > 0 && <div className="progress mb-3" style={{ height: 6 }}><div className="progress-bar" role="progressbar" style={{ width: `${(form.permission_ids.length / totalPermissions) * 100}%` }} /></div>}
                {permissions.length === 0 ? <div className="alert alert-warning py-2 mb-0">No permissions exist yet. Open the Permissions tab and use “Seed Defaults” or “New Permission”, then come back to assign them.</div> : <div className="row g-3">
                    <div className="col-lg-7">
                        <div className="role-panel">
                            <div className="role-panel-header">
                                <span className="fw-semibold small"><i className="ti ti-list-details me-1" />Available</span>
                                <div className="input-group input-group-sm" style={{ maxWidth: 240 }}>
                                    <span className="input-group-text"><i className="ti ti-search" /></span>
                                    <input className="form-control" placeholder="Search permissions…" value={permissionSearch} onChange={(event) => setPermissionSearch(event.target.value)} />
                                </div>
                            </div>
                            <div className="role-panel-body">
                                {Object.entries(availableGroups).length ? Object.entries(availableGroups).map(([moduleName, modulePermissions]) => <div className="mb-3" key={moduleName}>
                                    <div className="d-flex justify-content-between align-items-center px-1 mb-1">
                                        <span className="small fw-semibold text-uppercase text-muted">{moduleName} <span className="badge bg-light text-muted border ms-1">{modulePermissions.length}</span></span>
                                        <button className="btn btn-link btn-sm p-0" type="button" onClick={() => setModulePermissions(modulePermissions, true)}>Add all</button>
                                    </div>
                                    {modulePermissions.map((permission) => permissionRow(permission, 'add'))}
                                </div>) : <div className="text-muted small text-center py-4">{permissionSearch ? 'No matching permissions.' : 'All permissions are already assigned.'}</div>}
                            </div>
                        </div>
                    </div>
                    <div className="col-lg-5">
                        <div className="role-panel">
                            <div className="role-panel-header">
                                <span className="fw-semibold small"><i className="ti ti-circle-check me-1 text-success" />Assigned <span className="badge bg-success-subtle text-success ms-1">{assignedPermissions.length}</span></span>
                                {assignedPermissions.length > 0 && <button className="btn btn-link btn-sm p-0 text-danger" type="button" onClick={() => setForm({ ...form, permission_ids: [] })}>Remove all</button>}
                            </div>
                            <div className="role-panel-body">
                                {assignedPermissions.length ? assignedPermissions.map((permission) => permissionRow(permission, 'remove')) : <div className="text-muted small text-center py-4">No permissions assigned. Add some from the list on the left.</div>}
                            </div>
                        </div>
                    </div>
                </div>}
            </div>
            <div className="card-footer d-flex justify-content-between align-items-center">
                <span className="small text-muted">{form.permission_ids.length} permission{form.permission_ids.length === 1 ? '' : 's'} will be saved</span>
                <div><button className="btn btn-outline-secondary me-2" type="button" onClick={() => setEditingId(null)}>Cancel</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : <><i className="ti ti-device-floppy me-1" />Save Role</>}</button></div>
            </div>
        </form>}

        <div className="card mb-3"><div className="card-body py-3"><div className="row g-2 align-items-center">
            <div className="col-md-6 col-lg-5"><div className="input-group"><span className="input-group-text"><i className="ti ti-search" /></span><input className="form-control" placeholder="Search roles…" value={roleSearch} onChange={(event) => setRoleSearch(event.target.value)} />{roleSearch && <button className="btn btn-outline-secondary" type="button" onClick={() => setRoleSearch('')} aria-label="Clear search"><i className="ti ti-x" /></button>}</div></div>
            <div className="col-md-6 col-lg-7 text-md-end text-muted small">{roleSearch ? `${filteredRoles.length} of ${roles.length} roles` : `${roles.length} role${roles.length === 1 ? '' : 's'}`} · {totalPermissions} permissions available</div>
        </div></div></div>

        {filteredRoles.length ? <div className="row g-3">{filteredRoles.map((role) => {
            const modules = moduleSummary(role);
            const count = permissionCountOf(role);
            const userCount = role.user_count ?? role.users_count;
            const editing = editingId === role.id;
            return <div className="col-xxl-4 col-lg-6" key={role.id}>
                <div className={`card h-100 role-card ${editing ? 'border-primary' : ''}`}>
                    <div className="card-body d-flex flex-column">
                        <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
                            <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
                                <span className="role-card-icon"><i className="ti ti-user-shield" /></span>
                                <h6 className="fw-bold mb-0 text-truncate">{role.name}</h6>
                            </div>
                            <span className={`badge ${count ? 'bg-primary-subtle text-primary' : 'bg-warning-subtle text-warning'} flex-shrink-0`}>{count} permission{count === 1 ? '' : 's'}</span>
                        </div>
                        <p className="text-muted small mb-3 role-card-description">{role.description || 'No description'}</p>
                        <div className="d-flex flex-wrap gap-1 mb-3">
                            {modules.slice(0, 4).map(([moduleName, moduleCount]) => <span className="badge bg-light text-dark border fw-normal" key={moduleName}>{moduleName} <strong>{moduleCount}</strong></span>)}
                            {modules.length > 4 && <span className="badge bg-light text-muted border fw-normal">+{modules.length - 4} more</span>}
                            {!modules.length && count === 0 && <span className="small text-muted">No permissions assigned yet.</span>}
                        </div>
                        {userCount != null && <div className="small text-muted mb-3"><i className="ti ti-users me-1" />{userCount} user{userCount === 1 ? '' : 's'} assigned</div>}
                        <div className="d-flex flex-wrap gap-2 mt-auto pt-2 border-top">
                            <button className="btn btn-success btn-sm flex-grow-1" type="button" onClick={() => startEdit(role)}><i className="ti ti-lock-plus me-1" />Permissions</button>
                            <div className="btn-group btn-group-sm">
                                <button className="btn btn-outline-primary" type="button" onClick={() => startEdit(role)} title="Edit role" aria-label={`Edit ${role.name}`}><i className="ti ti-edit" /></button>
                                <button className="btn btn-outline-secondary" type="button" onClick={() => startDuplicate(role)} title="Duplicate role" aria-label={`Duplicate ${role.name}`}><i className="ti ti-copy" /></button>
                                <button className="btn btn-outline-danger" type="button" onClick={() => setRoleToDelete(role)} title="Delete role" aria-label={`Delete ${role.name}`}><i className="ti ti-trash" /></button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>;
        })}</div> : <div className="card"><div className="card-body text-center py-5 text-muted">
            <i className="ti ti-user-shield" style={{ fontSize: '3rem', opacity: 0.4 }} />
            <p className="mt-3 mb-3">{roleSearch ? 'No roles match your search.' : 'No custom roles have been created.'}</p>
            {roleSearch ? <button className="btn btn-outline-primary btn-sm" onClick={() => setRoleSearch('')}>Clear search</button> : <button className="btn btn-primary btn-sm" onClick={startCreate}><i className="ti ti-plus me-1" />Create your first role</button>}
        </div></div>}

        {roleToDelete && <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => !deleting && setRoleToDelete(null)}>
            <div className="modal-dialog modal-dialog-centered" onClick={(event) => event.stopPropagation()}><div className="modal-content">
                <div className="modal-header"><h5 className="modal-title">Delete role</h5><button type="button" className="btn-close" onClick={() => setRoleToDelete(null)} aria-label="Close" /></div>
                <div className="modal-body text-center"><i className="ti ti-alert-circle text-danger" style={{ fontSize: '3rem' }} /><p className="mb-0 mt-2">Delete the role <strong>{roleToDelete.name}</strong>? Users assigned to it may lose permissions. This cannot be undone.</p></div>
                <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setRoleToDelete(null)} disabled={deleting}>Cancel</button><button className="btn btn-danger" onClick={confirmDelete} disabled={deleting}>{deleting ? <><span className="spinner-border spinner-border-sm me-2" />Deleting…</> : <><i className="ti ti-trash me-2" />Delete</>}</button></div>
            </div></div>
        </div>}
    </div>;
};

export default RoleManagement;
