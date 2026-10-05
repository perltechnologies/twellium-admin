import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { productionApi } from '../../api/production';
import { usersApi } from '../../api/users';
import { FALLBACK_BASE_ROLES, formatAccessApiError, normalizeBaseRoles, unwrapData, unwrapList } from './accessControlUtils';
import './UserForm.css';

const FORM_STEPS = [
    { number: 1, label: 'Account', icon: 'ti-user' },
    { number: 2, label: 'Role and Scope', icon: 'ti-user-shield' },
    { number: 3, label: 'Permissions', icon: 'ti-lock-access' },
    { number: 4, label: 'Review', icon: 'ti-checklist' },
];

const initialForm = {
    username: '', email: '', full_name: '', role: 'OPERATOR', custom_role_id: '', company: '', pet_ids: [],
    password: '', can_access_production: true, can_access_cip: false,
};

const UserForm = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = Boolean(id);
    const [formData, setFormData] = useState(initialForm);
    const [confirmPassword, setConfirmPassword] = useState('');
    const [companies, setCompanies] = useState([]);
    const [pets, setPets] = useState([]);
    const [baseRoles, setBaseRoles] = useState(FALLBACK_BASE_ROLES);
    const [customRoles, setCustomRoles] = useState([]);
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        const load = async () => {
            setLoading(true);
            setError('');
            const dependencies = await Promise.allSettled([
                usersApi.getCompanies(), productionApi.getPets(), usersApi.getBaseRoles(), usersApi.getRoles({ page_size: 1000 }),
            ]);
            if (!active) return;
            if (dependencies[0].status === 'fulfilled') setCompanies(unwrapList(dependencies[0].value));
            if (dependencies[1].status === 'fulfilled') setPets(unwrapList(dependencies[1].value));
            if (dependencies[2].status === 'fulfilled') setBaseRoles(normalizeBaseRoles(dependencies[2].value));
            if (dependencies[3].status === 'fulfilled') setCustomRoles(unwrapList(dependencies[3].value));
            if (dependencies.some((result) => result.status === 'rejected')) setError('Some role or scope options could not be loaded. Refresh before saving.');

            if (isEditMode) {
                try {
                    const user = unwrapData(await usersApi.getUser(id));
                    if (active && user) setFormData({
                        username: user.username || '', email: user.email || '', full_name: user.full_name || '', role: user.role || 'OPERATOR',
                        custom_role_id: user.custom_role_id ?? user.custom_role ?? '', company: user.company ?? '',
                        pet_ids: (user.pet_ids || user.pets?.map((pet) => pet.id) || []).map(String), password: '',
                        can_access_production: user.can_access_production !== false, can_access_cip: user.can_access_cip === true,
                    });
                } catch (loadError) {
                    if (active) setError(formatAccessApiError(loadError, 'The user could not be loaded.'));
                }
            }
            if (active) setLoading(false);
        };
        load();
        return () => { active = false; };
    }, [id, isEditMode]);

    const selectedCustomRole = useMemo(() => customRoles.find((role) => String(role.id) === String(formData.custom_role_id)), [customRoles, formData.custom_role_id]);
    const inheritedPermissions = useMemo(() => selectedCustomRole?.permissions || [], [selectedCustomRole]);
    const groupedPermissions = useMemo(() => inheritedPermissions.reduce((groups, permission) => {
        const moduleName = permission.module || 'Other';
        if (!groups[moduleName]) groups[moduleName] = [];
        groups[moduleName].push(permission);
        return groups;
    }, {}), [inheritedPermissions]);

    const change = (event) => {
        const { name, value, type, checked, multiple, options } = event.target;
        const nextValue = multiple ? Array.from(options).filter((option) => option.selected).map((option) => option.value) : (type === 'checkbox' ? checked : value);
        setFormData((current) => ({ ...current, [name]: nextValue }));
    };

    const validate = () => {
        setError('');
        if (currentStep === 1) {
            if (!formData.username.trim() || !formData.full_name.trim()) {
                setError('Username and full name are required.');
                return false;
            }
            if (formData.email && !/^\S+@\S+\.\S+$/.test(formData.email)) {
                setError('Enter a valid email address.');
                return false;
            }
            if (!isEditMode && !formData.password) {
                setError('Password is required for a new user.');
                return false;
            }
            if (formData.password !== confirmPassword) {
                setError('Password and confirmation do not match.');
                return false;
            }
        }
        if (currentStep === 2 && (!formData.role || !formData.company)) {
            setError('Select a base role and company.');
            return false;
        }
        return true;
    };

    const submit = async (event) => {
        event.preventDefault();
        if (!formData.username.trim() || !formData.full_name.trim()) {
            setError('Username and full name are required.');
            setCurrentStep(1);
            return;
        }
        if (formData.email && !/^\S+@\S+\.\S+$/.test(formData.email)) {
            setError('Enter a valid email address.');
            setCurrentStep(1);
            return;
        }
        if (!isEditMode && !formData.password) {
            setError('Password is required for a new user.');
            setCurrentStep(1);
            return;
        }
        if (formData.password !== confirmPassword) {
            setError('Password and confirmation do not match.');
            setCurrentStep(1);
            return;
        }
        if (!formData.role || !formData.company) {
            setError('Select a base role and company.');
            setCurrentStep(2);
            return;
        }
        setSubmitting(true);
        setError('');
        try {
            const payload = {
                ...formData,
                company: formData.company ? Number(formData.company) : null,
                custom_role_id: formData.custom_role_id ? Number(formData.custom_role_id) : null,
                pet_ids: formData.pet_ids.map(Number),
            };
            if (!payload.password) delete payload.password;
            if (isEditMode) await usersApi.updateUser(id, payload);
            else await usersApi.createUser(payload);
            navigate('/dashboard/users');
        } catch (saveError) {
            setError(formatAccessApiError(saveError, 'The user could not be saved.'));
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="container-fluid text-center py-5"><span className="spinner-border text-primary" role="status" /><p className="text-muted mt-3">Loading user details…</p></div>;

    return <div className="container-fluid user-wizard-page">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4 user-wizard-header">
            <div className="d-flex align-items-center gap-3"><button className="btn btn-light rounded-circle user-wizard-back" onClick={() => navigate('/dashboard/users')}><i className="ti ti-arrow-left" /></button><div><div className="text-uppercase text-primary fw-semibold user-wizard-eyebrow">Access Management</div><h3 className="mb-1">{isEditMode ? 'Edit User' : 'Create New User'}</h3><p className="text-muted mb-0">Configure identity, base role, custom role, and operational scope.</p></div></div>
            <span className="badge rounded-pill bg-primary-subtle text-primary px-3 py-2">Step {currentStep} of {FORM_STEPS.length}</span>
        </div>

        <div className="card user-wizard-card border-0 shadow-sm"><div className="card-body p-4 p-lg-5">
            <div className="d-flex align-items-start mb-4 user-form-steps overflow-auto pb-2">{FORM_STEPS.map((step) => <React.Fragment key={step.number}><button type="button" className={`user-form-step ${currentStep === step.number ? 'active' : ''} ${currentStep > step.number ? 'complete' : ''}`} onClick={() => setCurrentStep(step.number)}><span className="user-form-step-icon"><i className={`ti ${step.icon}`} /></span><span>{step.label}</span></button>{step.number < FORM_STEPS.length && <div className={`user-form-step-line ${currentStep > step.number ? 'complete' : ''}`} />}</React.Fragment>)}</div>
            {error && <div className="alert alert-danger py-2">{error}</div>}

            <form onSubmit={submit}>
                {currentStep === 1 && <div><div className="user-step-heading-icon"><i className="ti ti-user" /></div><h4>Account details</h4><div className="row g-3">
                    <div className="col-md-4"><label className="form-label">Username *</label><input className="form-control" name="username" value={formData.username} onChange={change} /></div>
                    <div className="col-md-4"><label className="form-label">Full name *</label><input className="form-control" name="full_name" value={formData.full_name} onChange={change} /></div>
                    <div className="col-md-4"><label className="form-label">Email</label><input className="form-control" type="email" name="email" value={formData.email} onChange={change} /></div>
                    <div className="col-md-6"><label className="form-label">Password {!isEditMode && '*'}</label><input className="form-control" type="password" name="password" value={formData.password} onChange={change} autoComplete="new-password" /></div>
                    <div className="col-md-6"><label className="form-label">Confirm password {!isEditMode && '*'}</label><input className="form-control" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" /></div>
                </div></div>}

                {currentStep === 2 && <div><div className="user-step-heading-icon"><i className="ti ti-user-shield" /></div><h4>Role and operational scope</h4><p className="text-muted">The base role defines the account type; an optional custom role supplies granular permissions.</p><div className="row g-3">
                    <div className="col-md-6"><label className="form-label">Base role *</label><select className="form-select" name="role" value={formData.role} onChange={change}>{baseRoles.map((role) => <option value={role.value} key={role.value}>{role.label}</option>)}</select></div>
                    <div className="col-md-6"><label className="form-label">Custom role</label><select className="form-select" name="custom_role_id" value={formData.custom_role_id} onChange={change}><option value="">No custom role</option>{customRoles.map((role) => <option value={role.id} key={role.id}>{role.name} ({role.permission_count ?? role.permissions?.length ?? 0} permissions)</option>)}</select></div>
                    <div className="col-md-6"><label className="form-label">Company *</label><select className="form-select" name="company" value={formData.company} onChange={change}><option value="">Select company</option>{companies.map((company) => <option value={company.id} key={company.id}>{company.name}</option>)}</select></div>
                    <div className="col-md-6"><label className="form-label">PET lines</label><select className="form-select" multiple size={Math.min(Math.max(pets.length, 3), 6)} name="pet_ids" value={formData.pet_ids} onChange={change}>{pets.map((pet) => <option value={pet.id} key={pet.id}>{pet.pet_name || pet.name}</option>)}</select><small className="text-muted">Use Ctrl or Command to select multiple lines.</small></div>
                    <div className="col-md-6"><label className="form-check form-switch border rounded p-3 ps-5"><input className="form-check-input" type="checkbox" name="can_access_production" checked={formData.can_access_production} onChange={change} /><span className="form-check-label fw-semibold">Production access</span></label></div>
                    <div className="col-md-6"><label className="form-check form-switch border rounded p-3 ps-5"><input className="form-check-input" type="checkbox" name="can_access_cip" checked={formData.can_access_cip} onChange={change} /><span className="form-check-label fw-semibold">CIP access</span></label></div>
                </div></div>}

                {currentStep === 3 && <div><div className="user-step-heading-icon"><i className="ti ti-lock-access" /></div><div className="d-flex justify-content-between align-items-start mb-3"><div><h4 className="mb-1">Effective custom-role permissions</h4><p className="text-muted mb-0">Permissions are assigned to the selected custom role and inherited by this user.</p></div><button type="button" className="btn btn-outline-primary btn-sm" onClick={() => navigate('/dashboard/users?tab=roles')}>Manage roles</button></div>
                    {!selectedCustomRole ? <div className="alert alert-light border">No custom role selected. The account will use its base-role and access-flag behavior.</div> : <><div className="alert alert-primary py-2"><strong>{selectedCustomRole.name}</strong> grants {inheritedPermissions.length} permissions.</div><div className="row g-3">{Object.entries(groupedPermissions).map(([moduleName, permissions]) => <div className="col-xl-4 col-md-6" key={moduleName}><div className="border rounded p-3 h-100"><h6>{moduleName}</h6>{permissions.map((permission) => <div className="small mb-2" key={permission.id}><span className="d-block fw-medium">{permission.display_name || permission.name}</span><code>{permission.codename}</code></div>)}</div></div>)}</div></>}
                </div>}

                {currentStep === 4 && <div><div className="user-step-heading-icon"><i className="ti ti-checklist" /></div><h4>Review</h4><div className="row g-3"><div className="col-lg-6"><div className="border rounded p-3 h-100"><h6>Account</h6><dl className="row mb-0"><dt className="col-4">Username</dt><dd className="col-8">{formData.username}</dd><dt className="col-4">Name</dt><dd className="col-8">{formData.full_name}</dd><dt className="col-4">Email</dt><dd className="col-8">{formData.email || '—'}</dd></dl></div></div><div className="col-lg-6"><div className="border rounded p-3 h-100"><h6>Access</h6><dl className="row mb-0"><dt className="col-4">Base role</dt><dd className="col-8">{baseRoles.find((role) => role.value === formData.role)?.label || formData.role}</dd><dt className="col-4">Custom role</dt><dd className="col-8">{selectedCustomRole?.name || 'None'}</dd><dt className="col-4">Permissions</dt><dd className="col-8">{inheritedPermissions.length}</dd><dt className="col-4">PET lines</dt><dd className="col-8">{formData.pet_ids.length || 'All/unassigned'}</dd></dl></div></div></div></div>}

                <div className="d-flex justify-content-between mt-4 pt-3 border-top"><button type="button" className="btn btn-outline-secondary" onClick={() => navigate('/dashboard/users')}>Cancel</button><div className="d-flex gap-2">{currentStep > 1 && <button type="button" className="btn btn-secondary" onClick={() => { setError(''); setCurrentStep((step) => step - 1); }}>Back</button>}{currentStep < FORM_STEPS.length ? <button type="button" className="btn btn-primary" onClick={() => { if (validate()) setCurrentStep((step) => step + 1); }}>Continue</button> : <button className="btn btn-success" disabled={submitting}>{submitting ? 'Saving…' : (isEditMode ? 'Update User' : 'Create User')}</button>}</div></div>
            </form>
        </div></div>
    </div>;
};

export default UserForm;
