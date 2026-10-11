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
    const [showPassword, setShowPassword] = useState(false);

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

    const togglePet = (petId) => setFormData((current) => {
        const value = String(petId);
        return { ...current, pet_ids: current.pet_ids.includes(value) ? current.pet_ids.filter((item) => item !== value) : [...current.pet_ids, value] };
    });

    const initials = useMemo(() => {
        const parts = (formData.full_name || formData.username || '?').trim().split(/\s+/).filter(Boolean);
        return ((parts[0]?.[0] || '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
    }, [formData.full_name, formData.username]);
    const baseRoleLabel = baseRoles.find((role) => role.value === formData.role)?.label || formData.role;
    const companyName = companies.find((company) => String(company.id) === String(formData.company))?.name;
    const selectedPets = pets.filter((pet) => formData.pet_ids.includes(String(pet.id)));

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

    const goToStep = (step) => { setError(''); setCurrentStep(step); };
    const passwordType = showPassword ? 'text' : 'password';
    const passwordToggle = <button type="button" className="btn btn-outline-secondary" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide passwords' : 'Show passwords'} tabIndex={-1}><i className={`ti ${showPassword ? 'ti-eye-off' : 'ti-eye'}`} /></button>;
    const passwordMismatch = confirmPassword && formData.password !== confirmPassword;

    return <div className="container-fluid user-wizard-page">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4 user-wizard-header">
            <div className="d-flex align-items-center gap-3">
                <button type="button" className="btn btn-light rounded-circle user-wizard-back" onClick={() => navigate('/dashboard/users')} aria-label="Back to users"><i className="ti ti-arrow-left" /></button>
                <div>
                    <div className="text-uppercase text-primary fw-semibold user-wizard-eyebrow">Access Management</div>
                    <h3 className="mb-1">{isEditMode ? 'Edit User' : 'Create New User'}</h3>
                    <p className="text-muted mb-0">Configure identity, base role, custom role, and operational scope.</p>
                </div>
            </div>
            <span className="badge rounded-pill bg-primary-subtle text-primary px-3 py-2">Step {currentStep} of {FORM_STEPS.length}</span>
        </div>

        {isEditMode && <div className="card border-0 shadow-sm user-summary-card mb-3"><div className="card-body py-3 d-flex flex-wrap align-items-center gap-3">
            <span className="user-summary-avatar">{initials}</span>
            <div className="flex-grow-1" style={{ minWidth: 0 }}>
                <div className="fw-semibold fs-5 text-truncate">{formData.full_name || formData.username}</div>
                <div className="text-muted small text-truncate">{formData.username && `@${formData.username}`}{formData.email && ` · ${formData.email}`}</div>
            </div>
            <div className="d-flex flex-wrap gap-2">
                <span className="badge bg-primary-subtle text-primary">{baseRoleLabel}</span>
                {selectedCustomRole && <span className="badge bg-info-subtle text-info">{selectedCustomRole.name}</span>}
                {companyName && <span className="badge bg-light text-dark border">{companyName}</span>}
            </div>
        </div></div>}

        <div className="card user-wizard-card border-0 shadow-sm"><div className="card-body p-4 p-lg-5">
            <div className="d-flex align-items-start mb-4 user-form-steps overflow-auto pb-2">{FORM_STEPS.map((step) => <React.Fragment key={step.number}><button type="button" className={`user-form-step ${currentStep === step.number ? 'active' : ''} ${currentStep > step.number ? 'complete' : ''}`} onClick={() => goToStep(step.number)} aria-current={currentStep === step.number ? 'step' : undefined}><span className="user-form-step-icon"><i className={`ti ${currentStep > step.number ? 'ti-check' : step.icon}`} /></span><span className="user-form-step-label">{step.label}</span></button>{step.number < FORM_STEPS.length && <div className={`user-form-step-line ${currentStep > step.number ? 'complete' : ''}`} />}</React.Fragment>)}</div>
            {error && <div className="alert alert-danger py-2 d-flex align-items-center gap-2"><i className="ti ti-alert-circle" />{error}</div>}

            <form onSubmit={submit}>
                <div className="user-wizard-content" key={currentStep}>
                {currentStep === 1 && <div>
                    <div className="user-step-heading-icon"><i className="ti ti-user" /></div><h4>Account details</h4>
                    <p className="text-muted">Who this person is and how they sign in.</p>
                    <div className="row g-3">
                        <div className="col-md-4"><label className="form-label">Username *</label><div className="input-group"><span className="input-group-text"><i className="ti ti-at" /></span><input className="form-control" name="username" value={formData.username} onChange={change} autoComplete="off" /></div></div>
                        <div className="col-md-4"><label className="form-label">Full name *</label><div className="input-group"><span className="input-group-text"><i className="ti ti-user" /></span><input className="form-control" name="full_name" value={formData.full_name} onChange={change} /></div></div>
                        <div className="col-md-4"><label className="form-label">Email</label><div className="input-group"><span className="input-group-text"><i className="ti ti-mail" /></span><input className="form-control" type="email" name="email" value={formData.email} onChange={change} /></div></div>
                    </div>
                    <div className="user-form-section mt-4">
                        <div className="d-flex align-items-center gap-2 mb-1"><i className="ti ti-key text-primary" /><h6 className="mb-0">Password</h6></div>
                        <p className="text-muted small mb-3">{isEditMode ? 'Leave both fields blank to keep the current password.' : 'Set an initial password for this account.'}</p>
                        <div className="row g-3">
                            <div className="col-md-6"><label className="form-label">{isEditMode ? 'New password' : 'Password *'}</label><div className="input-group"><input className="form-control" type={passwordType} name="password" value={formData.password} onChange={change} autoComplete="new-password" />{passwordToggle}</div></div>
                            <div className="col-md-6"><label className="form-label">{isEditMode ? 'Confirm new password' : 'Confirm password *'}</label><input className={`form-control ${passwordMismatch ? 'is-invalid' : ''}`} type={passwordType} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />{passwordMismatch && <div className="invalid-feedback">Passwords do not match.</div>}</div>
                        </div>
                    </div>
                </div>}

                {currentStep === 2 && <div>
                    <div className="user-step-heading-icon"><i className="ti ti-user-shield" /></div><h4>Role and operational scope</h4>
                    <p className="text-muted">The base role defines the account type; an optional custom role supplies granular permissions.</p>
                    <div className="row g-3">
                        <div className="col-md-6"><label className="form-label">Base role *</label><select className="form-select" name="role" value={formData.role} onChange={change}>{baseRoles.map((role) => <option value={role.value} key={role.value}>{role.label}</option>)}</select></div>
                        <div className="col-md-6"><label className="form-label">Custom role</label><select className="form-select" name="custom_role_id" value={formData.custom_role_id} onChange={change}><option value="">No custom role</option>{customRoles.map((role) => <option value={role.id} key={role.id}>{role.name} ({role.permission_count ?? role.permissions?.length ?? 0} permissions)</option>)}</select></div>
                        <div className="col-12"><label className="form-label">Company *</label><select className="form-select" name="company" value={formData.company} onChange={change}><option value="">Select company</option>{companies.map((company) => <option value={company.id} key={company.id}>{company.name}</option>)}</select></div>
                    </div>

                    <div className="user-form-section mt-4">
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-1">
                            <div className="d-flex align-items-center gap-2"><i className="ti ti-bottle text-primary" /><h6 className="mb-0">PET lines</h6><span className="badge bg-primary-subtle text-primary">{formData.pet_ids.length} selected</span></div>
                            {pets.length > 0 && <div className="small"><button type="button" className="btn btn-link btn-sm p-0" onClick={() => setFormData((current) => ({ ...current, pet_ids: pets.map((pet) => String(pet.id)) }))}>Select all</button><span className="text-muted mx-1">/</span><button type="button" className="btn btn-link btn-sm p-0 text-muted" onClick={() => setFormData((current) => ({ ...current, pet_ids: [] }))}>Clear</button></div>}
                        </div>
                        <p className="text-muted small mb-3">Click a line to toggle it. Leave empty for no line restriction.</p>
                        {pets.length ? <div className="d-flex flex-wrap gap-2">{pets.map((pet) => {
                            const selected = formData.pet_ids.includes(String(pet.id));
                            return <button type="button" key={pet.id} className={`user-chip ${selected ? 'selected' : ''}`} aria-pressed={selected} onClick={() => togglePet(pet.id)}><i className={`ti ${selected ? 'ti-check' : 'ti-plus'}`} />{pet.pet_name || pet.name}</button>;
                        })}</div> : <div className="text-muted small">No PET lines available.</div>}
                    </div>

                    <div className="row g-3 mt-1">
                        <div className="col-md-6"><label className={`user-access-toggle form-check form-switch ${formData.can_access_production ? 'on' : ''}`}><input className="form-check-input" type="checkbox" name="can_access_production" checked={formData.can_access_production} onChange={change} /><span className="form-check-label"><span className="d-block fw-semibold">Production access</span><span className="d-block small text-muted">Can use production dashboards and entries.</span></span></label></div>
                        <div className="col-md-6"><label className={`user-access-toggle form-check form-switch ${formData.can_access_cip ? 'on' : ''}`}><input className="form-check-input" type="checkbox" name="can_access_cip" checked={formData.can_access_cip} onChange={change} /><span className="form-check-label"><span className="d-block fw-semibold">CIP access</span><span className="d-block small text-muted">Can use clean-in-place workflows.</span></span></label></div>
                    </div>
                </div>}

                {currentStep === 3 && <div>
                    <div className="user-step-heading-icon"><i className="ti ti-lock-access" /></div>
                    <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3"><div><h4 className="mb-1">Effective custom-role permissions</h4><p className="text-muted mb-0">Permissions are assigned to the selected custom role and inherited by this user.</p></div><button type="button" className="btn btn-outline-primary btn-sm" onClick={() => navigate('/dashboard/users?tab=roles')}><i className="ti ti-external-link me-1" />Manage roles</button></div>
                    {!selectedCustomRole ? <div className="alert alert-light border d-flex align-items-center gap-2"><i className="ti ti-info-circle" />No custom role selected. The account will use its base-role and access-flag behavior. <button type="button" className="btn btn-link btn-sm p-0 ms-1" onClick={() => goToStep(2)}>Choose a custom role</button></div> : <><div className="alert alert-primary py-2"><strong>{selectedCustomRole.name}</strong> grants {inheritedPermissions.length} permissions.</div><div className="row g-3">{Object.entries(groupedPermissions).map(([moduleName, permissions]) => <div className="col-xl-4 col-md-6" key={moduleName}><div className="permission-group h-100"><div className="d-flex justify-content-between align-items-center mb-2"><h6 className="mb-0">{moduleName}</h6><span className="badge bg-primary-subtle text-primary">{permissions.length}</span></div>{permissions.map((permission) => <div className="small mb-2" key={permission.id}><span className="d-block fw-medium">{permission.display_name || permission.name}</span><code>{permission.codename}</code></div>)}</div></div>)}</div></>}
                </div>}

                {currentStep === 4 && <div>
                    <div className="user-step-heading-icon is-success"><i className="ti ti-checklist" /></div><h4>Review</h4>
                    <p className="text-muted">Check the details below, then {isEditMode ? 'update the user' : 'create the account'}.</p>
                    <div className="row g-3">
                        <div className="col-lg-6"><div className="review-panel p-3 h-100"><div className="d-flex justify-content-between align-items-center mb-2"><h6 className="mb-0">Account</h6><button type="button" className="btn btn-link btn-sm p-0" onClick={() => goToStep(1)}>Edit</button></div><dl className="row mb-0 small"><dt className="col-4">Username</dt><dd className="col-8">{formData.username || '—'}</dd><dt className="col-4">Name</dt><dd className="col-8">{formData.full_name || '—'}</dd><dt className="col-4">Email</dt><dd className="col-8">{formData.email || '—'}</dd><dt className="col-4">Password</dt><dd className="col-8">{formData.password ? (isEditMode ? 'Will be changed' : 'Set') : (isEditMode ? 'Unchanged' : 'Not set')}</dd></dl></div></div>
                        <div className="col-lg-6"><div className="review-panel p-3 h-100"><div className="d-flex justify-content-between align-items-center mb-2"><h6 className="mb-0">Access</h6><button type="button" className="btn btn-link btn-sm p-0" onClick={() => goToStep(2)}>Edit</button></div><dl className="row mb-0 small"><dt className="col-4">Base role</dt><dd className="col-8">{baseRoleLabel}</dd><dt className="col-4">Custom role</dt><dd className="col-8">{selectedCustomRole?.name || 'None'}</dd><dt className="col-4">Permissions</dt><dd className="col-8">{inheritedPermissions.length}</dd><dt className="col-4">Company</dt><dd className="col-8">{companyName || '—'}</dd><dt className="col-4">PET lines</dt><dd className="col-8">{selectedPets.length ? selectedPets.map((pet) => pet.pet_name || pet.name).join(', ') : 'None selected'}</dd><dt className="col-4">Modules</dt><dd className="col-8">{[formData.can_access_production && 'Production', formData.can_access_cip && 'CIP'].filter(Boolean).join(', ') || 'None'}</dd></dl></div></div>
                    </div>
                </div>}
                </div>

                <div className="d-flex flex-wrap justify-content-between gap-2 mt-4 pt-3 border-top user-wizard-actions">
                    <button type="button" className="btn btn-outline-secondary" onClick={() => navigate('/dashboard/users')}>Cancel</button>
                    <div className="d-flex flex-wrap gap-2">
                        {currentStep > 1 && <button type="button" className="btn btn-secondary" onClick={() => goToStep(currentStep - 1)}><i className="ti ti-arrow-left me-1" />Back</button>}
                        {isEditMode && currentStep < FORM_STEPS.length && <button className="btn btn-outline-success" disabled={submitting}>{submitting ? 'Saving…' : <><i className="ti ti-device-floppy me-1" />Save changes</>}</button>}
                        {currentStep < FORM_STEPS.length ? <button type="button" className="btn btn-primary" onClick={() => { if (validate()) setCurrentStep((step) => step + 1); }}>Continue<i className="ti ti-arrow-right ms-1" /></button> : <button className="btn btn-success" disabled={submitting}>{submitting ? 'Saving…' : (isEditMode ? 'Update User' : 'Create User')}</button>}
                    </div>
                </div>
            </form>
        </div></div>
    </div>;
};

export default UserForm;
