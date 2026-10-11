import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usersApi } from '../../api/users';
import { formatAccessApiError, unwrapList } from './accessControlUtils';
import './RoleManagement.css';

const emptyForm = { module: '', resource: '', name: '', codename: '', description: '' };

const PermissionManagement = () => {
    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [saving, setSaving] = useState(false);
    const [seeding, setSeeding] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [search, setSearch] = useState('');
    const [moduleFilter, setModuleFilter] = useState('');
    const [collapsed, setCollapsed] = useState(() => new Set());
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [toDelete, setToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const formRef = useRef(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            setPermissions(unwrapList(await usersApi.getPermissions({ page_size: 1000 })));
        } catch (loadError) {
            setError(formatAccessApiError(loadError, 'Permissions could not be loaded.'));
        } finally {
            setLoading(false);
            setHasLoaded(true);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (editingId !== null && formRef.current) formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [editingId]);

    const moduleCounts = useMemo(() => permissions.reduce((counts, permission) => {
        const moduleName = permission.module || 'Other';
        counts[moduleName] = (counts[moduleName] || 0) + 1;
        return counts;
    }, {}), [permissions]);
    const modules = useMemo(() => Object.keys(moduleCounts).sort(), [moduleCounts]);
    const resources = useMemo(() => [...new Set(permissions.map((permission) => permission.resource).filter(Boolean))].sort(), [permissions]);

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        return permissions.filter((permission) => {
            const matchesModule = !moduleFilter || (permission.module || 'Other') === moduleFilter;
            const haystack = [permission.module, permission.resource, permission.name, permission.display_name, permission.codename, permission.description].filter(Boolean).join(' ').toLowerCase();
            return matchesModule && (!query || haystack.includes(query));
        });
    }, [moduleFilter, permissions, search]);

    const grouped = useMemo(() => {
        const groups = filtered.reduce((acc, permission) => {
            const moduleName = permission.module || 'Other';
            (acc[moduleName] = acc[moduleName] || []).push(permission);
            return acc;
        }, {});
        return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
    }, [filtered]);

    const hasFilters = Boolean(search || moduleFilter);
    const clearFilters = () => { setSearch(''); setModuleFilter(''); };

    const toggleModule = (moduleName) => setCollapsed((current) => {
        const next = new Set(current);
        if (next.has(moduleName)) next.delete(moduleName);
        else next.add(moduleName);
        return next;
    });
    const allCollapsed = grouped.length > 0 && grouped.every(([moduleName]) => collapsed.has(moduleName));
    const toggleAll = () => setCollapsed(allCollapsed ? new Set() : new Set(grouped.map(([moduleName]) => moduleName)));

    const startCreate = () => { setNotice(''); setError(''); setEditingId('new'); setForm(emptyForm); };
    const startEdit = (permission) => {
        setNotice('');
        setError('');
        setEditingId(permission.id);
        setForm({ module: permission.module || '', resource: permission.resource || '', name: permission.name || '', codename: permission.codename || '', description: permission.description || '' });
    };
    const closeEditor = () => { setEditingId(null); setForm(emptyForm); };

    const submit = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError('');
        try {
            const payload = { ...form, description: form.description.trim() || null };
            const wasNew = editingId === 'new';
            if (wasNew) await usersApi.createPermission(payload);
            else await usersApi.updatePermission(editingId, payload);
            setNotice(`Permission “${form.codename}” ${wasNew ? 'created' : 'updated'}.`);
            closeEditor();
            await load();
        } catch (saveError) {
            setError(formatAccessApiError(saveError, 'The permission could not be saved.'));
        } finally {
            setSaving(false);
        }
    };

    const confirmDelete = async () => {
        if (!toDelete) return;
        setDeleting(true);
        setError('');
        try {
            await usersApi.deletePermission(toDelete.id);
            setNotice(`Permission “${toDelete.codename}” deleted.`);
            if (editingId === toDelete.id) closeEditor();
            setToDelete(null);
            await load();
        } catch (deleteError) {
            setToDelete(null);
            setError(formatAccessApiError(deleteError, 'The permission could not be deleted.'));
        } finally {
            setDeleting(false);
        }
    };

    const seed = async () => {
        setError('');
        setNotice('');
        setSeeding(true);
        const before = permissions.length;
        try {
            await usersApi.seedPermissions({});
            const refreshed = unwrapList(await usersApi.getPermissions({ page_size: 1000 }));
            setPermissions(refreshed);
            const added = refreshed.length - before;
            setNotice(added > 0 ? `Seeded ${added} default permission${added === 1 ? '' : 's'}.` : 'Default permissions are already up to date.');
        } catch (seedError) {
            setError(formatAccessApiError(seedError, 'Default permissions could not be seeded.'));
        } finally {
            setSeeding(false);
        }
    };

    const field = (label, name, props = {}) => <div className={props.col || 'col-md-3'}>
        <label className="form-label">{label} *</label>
        <input className="form-control" value={form[name]} onChange={(event) => setForm({ ...form, [name]: event.target.value })} required {...props.input} />
    </div>;

    if (loading && !hasLoaded) return <div className="text-center py-5"><span className="spinner-border text-primary" role="status" /></div>;

    return <div className="role-management">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
            <div><h5 className="fw-bold mb-1">Permissions</h5><p className="text-muted mb-0">Manage the API permission directory used by custom roles.</p></div>
            <div className="d-flex gap-2">
                <button className="btn btn-outline-secondary btn-sm" type="button" onClick={load} disabled={loading}><i className={`ti ti-refresh me-1 ${loading ? 'spin' : ''}`} />Refresh</button>
                <button className="btn btn-outline-secondary btn-sm" type="button" onClick={seed} disabled={seeding} title="Create any missing default permissions"><i className={`ti ti-database-import me-1 ${seeding ? 'spin' : ''}`} />{seeding ? 'Seeding…' : 'Seed Defaults'}</button>
                <button className="btn btn-primary btn-sm" type="button" onClick={startCreate}><i className="ti ti-plus me-1" />New Permission</button>
            </div>
        </div>
        {error && <div className="alert alert-danger py-2 d-flex align-items-center gap-2"><i className="ti ti-alert-circle" /><span className="flex-grow-1">{error}</span><button type="button" className="btn-close" onClick={() => setError('')} aria-label="Dismiss" /></div>}
        {notice && <div className="alert alert-success py-2 d-flex align-items-center gap-2"><i className="ti ti-circle-check" /><span className="flex-grow-1">{notice}</span><button type="button" className="btn-close" onClick={() => setNotice('')} aria-label="Dismiss" /></div>}

        {editingId !== null && <form ref={formRef} className="card border-primary shadow-sm mb-4" onSubmit={submit}>
            <div className="card-header bg-primary-subtle d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center gap-2"><i className={`ti ${editingId === 'new' ? 'ti-plus' : 'ti-edit'} text-primary`} /><strong>{editingId === 'new' ? 'Create permission' : 'Edit permission'}</strong></div>
                <button className="btn-close" type="button" onClick={closeEditor} aria-label="Close" />
            </div>
            <div className="card-body"><div className="row g-3">
                {field('Module', 'module', { input: { list: 'permission-modules', placeholder: 'e.g. inventory' } })}
                {field('Resource', 'resource', { input: { list: 'permission-resources', placeholder: 'e.g. handling_unit' } })}
                {field('Name', 'name', { input: { placeholder: 'e.g. View handling units' } })}
                {field('Codename', 'codename', { input: { placeholder: 'e.g. inventory.view_handling_unit' } })}
                <div className="col-12"><label className="form-label">Description</label><textarea className="form-control" rows={2} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="What does this permission allow?" /></div>
                <datalist id="permission-modules">{modules.map((moduleName) => <option key={moduleName} value={moduleName} />)}</datalist>
                <datalist id="permission-resources">{resources.map((resource) => <option key={resource} value={resource} />)}</datalist>
            </div></div>
            <div className="card-footer text-end"><button className="btn btn-outline-secondary me-2" type="button" onClick={closeEditor}>Cancel</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : <><i className="ti ti-device-floppy me-1" />Save Permission</>}</button></div>
        </form>}

        <div className="row g-3 mb-3">
            <div className="col-sm-4"><div className="card h-100"><div className="card-body py-3 d-flex align-items-center gap-3"><span className="role-card-icon"><i className="ti ti-lock-access" /></span><div><div className="text-muted small text-uppercase fw-semibold">Permissions</div><div className="fs-4 fw-bold lh-1">{permissions.length}</div></div></div></div></div>
            <div className="col-sm-4"><div className="card h-100"><div className="card-body py-3 d-flex align-items-center gap-3"><span className="role-card-icon"><i className="ti ti-packages" /></span><div><div className="text-muted small text-uppercase fw-semibold">Modules</div><div className="fs-4 fw-bold lh-1">{modules.length}</div></div></div></div></div>
            <div className="col-sm-4"><div className="card h-100"><div className="card-body py-3 d-flex align-items-center gap-3"><span className="role-card-icon"><i className="ti ti-box" /></span><div><div className="text-muted small text-uppercase fw-semibold">Resources</div><div className="fs-4 fw-bold lh-1">{resources.length}</div></div></div></div></div>
        </div>

        <div className="card mb-3"><div className="card-body py-3">
            <div className="row g-2 align-items-center">
                <div className="col-lg-6"><div className="input-group"><span className="input-group-text"><i className="ti ti-search" /></span><input className="form-control" placeholder="Search by name, codename, resource or description…" value={search} onChange={(event) => setSearch(event.target.value)} />{search && <button className="btn btn-outline-secondary" type="button" onClick={() => setSearch('')} aria-label="Clear search"><i className="ti ti-x" /></button>}</div></div>
                <div className="col-lg-6 d-flex flex-wrap justify-content-lg-end align-items-center gap-2">
                    <span className="text-muted small">{hasFilters ? `${filtered.length} of ${permissions.length}` : permissions.length} permissions</span>
                    {hasFilters && <button className="btn btn-link btn-sm text-danger text-decoration-none p-0" type="button" onClick={clearFilters}><i className="ti ti-filter-off me-1" />Clear filters</button>}
                    {grouped.length > 1 && <button className="btn btn-outline-secondary btn-sm" type="button" onClick={toggleAll}><i className={`ti ${allCollapsed ? 'ti-arrows-diagonal' : 'ti-arrows-diagonal-minimize-2'} me-1`} />{allCollapsed ? 'Expand all' : 'Collapse all'}</button>}
                </div>
            </div>
            {modules.length > 0 && <div className="d-flex flex-wrap gap-2 mt-3">
                <button type="button" className={`user-chip ${!moduleFilter ? 'selected' : ''}`} onClick={() => setModuleFilter('')}>All <span className="badge bg-light text-dark border">{permissions.length}</span></button>
                {modules.map((moduleName) => <button type="button" key={moduleName} className={`user-chip ${moduleFilter === moduleName ? 'selected' : ''}`} onClick={() => setModuleFilter(moduleFilter === moduleName ? '' : moduleName)} aria-pressed={moduleFilter === moduleName}>{moduleName} <span className="badge bg-light text-dark border">{moduleCounts[moduleName]}</span></button>)}
            </div>}
        </div></div>

        {grouped.length ? grouped.map(([moduleName, items]) => {
            const isCollapsed = collapsed.has(moduleName);
            return <div className="card mb-3" key={moduleName}>
                <button type="button" className="card-header bg-light d-flex align-items-center justify-content-between w-100 text-start border-0" onClick={() => toggleModule(moduleName)} aria-expanded={!isCollapsed}>
                    <span className="d-flex align-items-center gap-2"><i className="ti ti-chevron-down" style={{ transition: 'transform 0.2s', transform: isCollapsed ? 'rotate(-90deg)' : 'none' }} /><strong className="text-uppercase small">{moduleName}</strong><span className="badge bg-primary-subtle text-primary">{items.length}</span></span>
                </button>
                {!isCollapsed && <div className="table-responsive"><table className="table table-hover align-middle mb-0">
                    <thead><tr><th>Permission</th><th>Resource</th><th>Description</th><th className="text-end">Actions</th></tr></thead>
                    <tbody>{items.map((permission) => <tr key={permission.id} className={editingId === permission.id ? 'table-active' : ''}>
                        <td><span className="d-block fw-semibold">{permission.display_name || permission.name}</span><code>{permission.codename}</code></td>
                        <td>{permission.resource ? <span className="badge bg-light text-dark border fw-normal">{permission.resource}</span> : <span className="text-muted">—</span>}</td>
                        <td className="text-muted small" style={{ maxWidth: 360 }}>{permission.description || '—'}</td>
                        <td className="text-end text-nowrap"><div className="btn-group btn-group-sm">
                            <button className="btn btn-outline-primary" type="button" onClick={() => startEdit(permission)} title="Edit" aria-label={`Edit ${permission.codename}`}><i className="ti ti-edit" /></button>
                            <button className="btn btn-outline-danger" type="button" onClick={() => setToDelete(permission)} title="Delete" aria-label={`Delete ${permission.codename}`}><i className="ti ti-trash" /></button>
                        </div></td>
                    </tr>)}</tbody>
                </table></div>}
            </div>;
        }) : <div className="card"><div className="card-body text-center py-5 text-muted">
            <i className="ti ti-lock-access" style={{ fontSize: '3rem', opacity: 0.4 }} />
            <p className="mt-3 mb-3">{hasFilters ? 'No permissions match your filters.' : 'No permissions found.'}</p>
            {hasFilters ? <button className="btn btn-outline-primary btn-sm" onClick={clearFilters}>Clear filters</button> : <div className="d-flex justify-content-center gap-2"><button className="btn btn-outline-secondary btn-sm" onClick={seed} disabled={seeding}><i className="ti ti-database-import me-1" />Seed Defaults</button><button className="btn btn-primary btn-sm" onClick={startCreate}><i className="ti ti-plus me-1" />New Permission</button></div>}
        </div></div>}

        {toDelete && <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => !deleting && setToDelete(null)}>
            <div className="modal-dialog modal-dialog-centered" onClick={(event) => event.stopPropagation()}><div className="modal-content">
                <div className="modal-header"><h5 className="modal-title">Delete permission</h5><button type="button" className="btn-close" onClick={() => setToDelete(null)} aria-label="Close" /></div>
                <div className="modal-body text-center"><i className="ti ti-alert-circle text-danger" style={{ fontSize: '3rem' }} /><p className="mb-0 mt-2">Delete <code>{toDelete.codename}</code>? It will be removed from every role that uses it. This cannot be undone.</p></div>
                <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setToDelete(null)} disabled={deleting}>Cancel</button><button className="btn btn-danger" onClick={confirmDelete} disabled={deleting}>{deleting ? <><span className="spinner-border spinner-border-sm me-2" />Deleting…</> : <><i className="ti ti-trash me-2" />Delete</>}</button></div>
            </div></div>
        </div>}
    </div>;
};

export default PermissionManagement;
