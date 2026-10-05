import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { usersApi } from '../../api/users';
import { formatAccessApiError, unwrapList } from './accessControlUtils';

const emptyForm = { name: '', description: '', permission_ids: [] };

const RoleManagement = () => {
    const [roles, setRoles] = useState([]);
    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(emptyForm);

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
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const permissionGroups = useMemo(() => permissions.reduce((groups, permission) => {
        const moduleName = permission.module || 'Other';
        if (!groups[moduleName]) groups[moduleName] = [];
        groups[moduleName].push(permission);
        return groups;
    }, {}), [permissions]);

    const startCreate = () => {
        setEditingId('new');
        setForm(emptyForm);
        setError('');
    };

    const startEdit = (role) => {
        setEditingId(role.id);
        setForm({
            name: role.name || '',
            description: role.description || '',
            permission_ids: (role.permissions || []).map((permission) => permission.id),
        });
        setError('');
    };

    const togglePermission = (permissionId) => setForm((current) => ({
        ...current,
        permission_ids: current.permission_ids.includes(permissionId)
            ? current.permission_ids.filter((id) => id !== permissionId)
            : [...current.permission_ids, permissionId],
    }));

    const submit = async (event) => {
        event.preventDefault();
        if (!form.name.trim()) return setError('Role name is required.');
        setSaving(true);
        setError('');
        try {
            const payload = { ...form, name: form.name.trim(), description: form.description.trim() || null };
            if (editingId === 'new') await usersApi.createRole(payload);
            else await usersApi.updateRole(editingId, payload);
            setEditingId(null);
            setForm(emptyForm);
            await load();
        } catch (saveError) {
            setError(formatAccessApiError(saveError, 'The role could not be saved.'));
        } finally {
            setSaving(false);
        }
    };

    const remove = async (role) => {
        if (!window.confirm(`Delete the role “${role.name}”? Users assigned to it may lose permissions.`)) return;
        setError('');
        try {
            await usersApi.deleteRole(role.id);
            await load();
        } catch (deleteError) {
            setError(formatAccessApiError(deleteError, 'The role could not be deleted.'));
        }
    };

    if (loading) return <div className="text-center py-5"><span className="spinner-border text-primary" role="status" /></div>;

    return <div>
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
            <div><h5 className="mb-1">Custom roles</h5><p className="text-muted mb-0">Group API permissions and assign the role to users.</p></div>
            <div className="d-flex gap-2">
                <button className="btn btn-outline-secondary btn-sm" type="button" onClick={load}><i className="ti ti-refresh me-1" />Refresh</button>
                <button className="btn btn-primary btn-sm" type="button" onClick={startCreate}><i className="ti ti-plus me-1" />New Role</button>
            </div>
        </div>
        {error && <div className="alert alert-danger py-2">{error}</div>}

        {editingId !== null && <form className="card border-primary mb-3" onSubmit={submit}>
            <div className="card-header d-flex justify-content-between align-items-center">
                <strong>{editingId === 'new' ? 'Create role' : 'Edit role'}</strong>
                <button className="btn-close" type="button" onClick={() => setEditingId(null)} aria-label="Close" />
            </div>
            <div className="card-body">
                <div className="row g-3 mb-3">
                    <div className="col-md-4"><label className="form-label">Name</label><input className="form-control" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></div>
                    <div className="col-md-8"><label className="form-label">Description</label><input className="form-control" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></div>
                </div>
                <div className="d-flex justify-content-between align-items-center mb-2"><strong>Permissions</strong><span className="badge bg-primary-subtle text-primary">{form.permission_ids.length} selected</span></div>
                <div className="row g-2">
                    {Object.entries(permissionGroups).map(([moduleName, modulePermissions]) => <div className="col-xl-4 col-md-6" key={moduleName}>
                        <fieldset className="border rounded p-2 h-100"><legend className="float-none w-auto px-1 fs-6">{moduleName}</legend>
                            {modulePermissions.map((permission) => <label className="form-check small mb-1" key={permission.id}>
                                <input className="form-check-input" type="checkbox" checked={form.permission_ids.includes(permission.id)} onChange={() => togglePermission(permission.id)} />
                                <span className="form-check-label"><span className="d-block fw-medium">{permission.display_name || permission.name}</span><code>{permission.codename}</code></span>
                            </label>)}
                        </fieldset>
                    </div>)}
                </div>
            </div>
            <div className="card-footer text-end"><button className="btn btn-outline-secondary me-2" type="button" onClick={() => setEditingId(null)}>Cancel</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Role'}</button></div>
        </form>}

        <div className="card mb-0"><div className="table-responsive"><table className="table table-hover align-middle mb-0">
            <thead className="table-light"><tr><th>Role</th><th>Description</th><th className="text-center">Permissions</th><th className="text-end">Actions</th></tr></thead>
            <tbody>{roles.length ? roles.map((role) => <tr key={role.id}>
                <td className="fw-semibold">{role.name}</td><td>{role.description || '—'}</td><td className="text-center"><span className="badge bg-primary-subtle text-primary">{role.permission_count ?? role.permissions?.length ?? 0}</span></td>
                <td className="text-end"><div className="btn-group btn-group-sm"><button className="btn btn-outline-primary" onClick={() => startEdit(role)} title="Edit"><i className="ti ti-edit" /></button><button className="btn btn-outline-danger" onClick={() => remove(role)} title="Delete"><i className="ti ti-trash" /></button></div></td>
            </tr>) : <tr><td colSpan={4} className="text-center py-4 text-muted">No custom roles have been created.</td></tr>}</tbody>
        </table></div></div>
    </div>;
};

export default RoleManagement;
