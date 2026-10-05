import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { usersApi } from '../../api/users';
import { formatAccessApiError, unwrapList } from './accessControlUtils';

const emptyForm = { module: '', resource: '', name: '', codename: '', description: '' };

const PermissionManagement = () => {
    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [moduleFilter, setModuleFilter] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(emptyForm);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            setPermissions(unwrapList(await usersApi.getPermissions({ page_size: 1000 })));
        } catch (loadError) {
            setError(formatAccessApiError(loadError, 'Permissions could not be loaded.'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const modules = useMemo(() => [...new Set(permissions.map((permission) => permission.module).filter(Boolean))].sort(), [permissions]);
    const filtered = useMemo(() => permissions.filter((permission) => {
        const matchesModule = !moduleFilter || permission.module === moduleFilter;
        const haystack = [permission.module, permission.resource, permission.name, permission.codename, permission.description].filter(Boolean).join(' ').toLowerCase();
        return matchesModule && (!search.trim() || haystack.includes(search.trim().toLowerCase()));
    }), [moduleFilter, permissions, search]);

    const edit = (permission) => {
        setEditingId(permission.id);
        setForm({ module: permission.module || '', resource: permission.resource || '', name: permission.name || '', codename: permission.codename || '', description: permission.description || '' });
    };

    const submit = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError('');
        try {
            const payload = { ...form, description: form.description.trim() || null };
            if (editingId === 'new') await usersApi.createPermission(payload);
            else await usersApi.updatePermission(editingId, payload);
            setEditingId(null);
            setForm(emptyForm);
            await load();
        } catch (saveError) {
            setError(formatAccessApiError(saveError, 'The permission could not be saved.'));
        } finally {
            setSaving(false);
        }
    };

    const remove = async (permission) => {
        if (!window.confirm(`Delete permission “${permission.codename}”? It will be removed from assigned roles.`)) return;
        try {
            await usersApi.deletePermission(permission.id);
            await load();
        } catch (deleteError) {
            setError(formatAccessApiError(deleteError, 'The permission could not be deleted.'));
        }
    };

    const seed = async () => {
        setError('');
        try {
            await usersApi.seedPermissions({});
            await load();
        } catch (seedError) {
            setError(formatAccessApiError(seedError, 'Default permissions could not be seeded.'));
        }
    };

    return <div>
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
            <div><h5 className="mb-1">Permissions</h5><p className="text-muted mb-0">Manage the API permission directory used by custom roles.</p></div>
            <div className="d-flex gap-2"><button className="btn btn-outline-secondary btn-sm" onClick={seed}><i className="ti ti-database-import me-1" />Seed Defaults</button><button className="btn btn-primary btn-sm" onClick={() => { setEditingId('new'); setForm(emptyForm); }}><i className="ti ti-plus me-1" />New Permission</button></div>
        </div>
        {error && <div className="alert alert-danger py-2">{error}</div>}

        {editingId !== null && <form className="card border-primary mb-3" onSubmit={submit}>
            <div className="card-header"><strong>{editingId === 'new' ? 'Create permission' : 'Edit permission'}</strong></div>
            <div className="card-body"><div className="row g-3">
                <div className="col-md-3"><label className="form-label">Module</label><input className="form-control" value={form.module} onChange={(event) => setForm({ ...form, module: event.target.value })} required /></div>
                <div className="col-md-3"><label className="form-label">Resource</label><input className="form-control" value={form.resource} onChange={(event) => setForm({ ...form, resource: event.target.value })} required /></div>
                <div className="col-md-3"><label className="form-label">Name</label><input className="form-control" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></div>
                <div className="col-md-3"><label className="form-label">Codename</label><input className="form-control" value={form.codename} onChange={(event) => setForm({ ...form, codename: event.target.value })} required /></div>
                <div className="col-12"><label className="form-label">Description</label><textarea className="form-control" rows={2} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></div>
            </div></div>
            <div className="card-footer text-end"><button className="btn btn-outline-secondary me-2" type="button" onClick={() => setEditingId(null)}>Cancel</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Permission'}</button></div>
        </form>}

        <div className="card mb-3"><div className="card-body"><div className="row g-2">
            <div className="col-md-8"><input className="form-control" placeholder="Search permissions…" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
            <div className="col-md-4"><select className="form-select" value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)}><option value="">All modules</option>{modules.map((moduleName) => <option key={moduleName}>{moduleName}</option>)}</select></div>
        </div></div></div>

        <div className="card mb-0"><div className="table-responsive"><table className="table table-hover align-middle mb-0">
            <thead className="table-light"><tr><th>Permission</th><th>Module</th><th>Resource</th><th>Description</th><th className="text-end">Actions</th></tr></thead>
            <tbody>{loading ? <tr><td colSpan={5} className="text-center py-5"><span className="spinner-border text-primary" /></td></tr> : filtered.length ? filtered.map((permission) => <tr key={permission.id}>
                <td><span className="d-block fw-semibold">{permission.display_name || permission.name}</span><code>{permission.codename}</code></td><td>{permission.module}</td><td>{permission.resource}</td><td>{permission.description || '—'}</td>
                <td className="text-end"><div className="btn-group btn-group-sm"><button className="btn btn-outline-primary" onClick={() => edit(permission)}><i className="ti ti-edit" /></button><button className="btn btn-outline-danger" onClick={() => remove(permission)}><i className="ti ti-trash" /></button></div></td>
            </tr>) : <tr><td colSpan={5} className="text-center py-4 text-muted">No permissions found.</td></tr>}</tbody>
        </table></div></div>
    </div>;
};

export default PermissionManagement;
