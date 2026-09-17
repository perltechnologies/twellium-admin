import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usersApi } from '../../api/users';
import { productionApi } from '../../api/production';
import {
    getPagePrivileges,
    groupPagePrivileges,
    hasExplicitPagePrivileges,
    PAGE_PRIVILEGES,
    PAGE_PRIVILEGE_FIELD,
} from '../../config/pagePrivileges';
import './UserForm.css';

const privilegeGroups = groupPagePrivileges();
const assignablePrivilegeKeys = PAGE_PRIVILEGES.filter((item) => !item.adminOnly).map((item) => item.key);
const FORM_STEPS = [
    { number: 1, label: 'Account', icon: 'ti-user' },
    { number: 2, label: 'Role and Scope', icon: 'ti-user-shield' },
    { number: 3, label: 'Permissions', icon: 'ti-lock-access' },
    { number: 4, label: 'Review', icon: 'ti-checklist' },
];
const ROLE_OPTIONS = [
    { value: 'OPERATOR', label: 'Operator', icon: 'ti-settings-automation', description: 'Daily production entry' },
    { value: 'SUPERVISOR', label: 'Supervisor', icon: 'ti-users-group', description: 'Team oversight' },
    { value: 'QUALITY_CONTROL', label: 'Quality Control', icon: 'ti-shield-check', description: 'Quality review' },
    { value: 'WAREHOUSE_CLERK', label: 'Warehouse Clerk', icon: 'ti-building-warehouse', description: 'Stock and staging' },
    { value: 'DRIVER', label: 'Driver', icon: 'ti-steering-wheel', description: 'Delivery workflow' },
    { value: 'DISPATCHER', label: 'Dispatcher', icon: 'ti-truck-delivery', description: 'Dispatch coordination' },
    { value: 'VIEWER', label: 'Viewer', icon: 'ti-eye', description: 'Read-only usage' },
    { value: 'ADMIN', label: 'Administrator', icon: 'ti-shield-lock', description: 'Complete system control' },
];
const unwrapData = (response) => response?.data?.data ?? response?.data ?? response;
const unwrapList = (response) => {
    const payload = unwrapData(response);
    if (Array.isArray(payload)) return payload;
    return Array.isArray(payload?.results) ? payload.results : [];
};

const formatApiError = (error) => {
    const payload = error.response?.data?.data ?? error.response?.data;
    if (typeof payload?.message === 'string') return payload.message;
    if (typeof payload?.detail === 'string') return payload.detail;
    if (payload && typeof payload === 'object') {
        const messages = Object.entries(payload).flatMap(([field, value]) => {
            if (['status_code', 'message'].includes(field)) return [];
            const detail = Array.isArray(value) ? value.join(' ') : String(value);
            return `${field.replaceAll('_', ' ')}: ${detail}`;
        });
        if (messages.length) return messages.join(' ');
    }
    return 'Failed to save the user. Please check the form and try again.';
};

const UserForm = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = !!id;

    const [formData, setFormData] = useState({
        username: '',
        email: '',
        full_name: '',
        role: 'OPERATOR',
        company: '',
        pet_ids: [],
        password: '',
        can_access_production: true,
        can_access_cip: false,
        [PAGE_PRIVILEGE_FIELD]: []
    });
    const [confirmPassword, setConfirmPassword] = useState('');

    const [companies, setCompanies] = useState([]);
    const [pets, setPets] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [legacyPrivileges, setLegacyPrivileges] = useState(false);
    const [privilegesTouched, setPrivilegesTouched] = useState(false);
    const [privilegeSupport, setPrivilegeSupport] = useState('checking');
    const [dependencyError, setDependencyError] = useState('');
    const [currentStep, setCurrentStep] = useState(1);

    useEffect(() => {
        const loadDependencies = async () => {
            const results = await Promise.allSettled([
                    usersApi.getCompanies(),
                    productionApi.getPets(),
                    usersApi.getUsers({ page: 1, page_size: 1 })
                ]);

            const [companiesResult, petsResult, usersResult] = results;
            if (companiesResult.status === 'fulfilled') {
                setCompanies(unwrapList(companiesResult.value));
            }

            if (petsResult.status === 'fulfilled') {
                setPets(unwrapList(petsResult.value));
            }

            if (usersResult.status === 'fulfilled') {
                const sampleUsers = unwrapList(usersResult.value);
                const detectedSupport = sampleUsers.some(hasExplicitPagePrivileges) ? 'supported' : 'legacy';
                setPrivilegeSupport((current) => current === 'supported' ? current : detectedSupport);
            } else {
                setPrivilegeSupport('legacy');
            }

            if (companiesResult.status === 'rejected' || petsResult.status === 'rejected') {
                console.error('Failed to load user form dependency data', results);
                setDependencyError('Some company or PET options could not be loaded. Refresh before submitting if a required option is missing.');
            }
        };

        const loadUser = async () => {
            if (!isEditMode) return;
            setLoading(true);
            try {
                const res = await usersApi.getUser(id);
                const user = unwrapData(res);
                if (user) {
                    const explicitPrivileges = hasExplicitPagePrivileges(user);
                    if (explicitPrivileges) setPrivilegeSupport('supported');
                    setLegacyPrivileges(!explicitPrivileges);
                    setFormData({
                        username: user.username,
                        email: user.email,
                        full_name: user.full_name,
                        role: user.role,
                        company: user.company || '',
                        pet_ids: (user.pet_ids || user.pets?.map((pet) => pet.id) || []).map(String),
                        password: '',
                        can_access_production: user.can_access_production !== false,
                        can_access_cip: user.can_access_cip === true,
                        [PAGE_PRIVILEGE_FIELD]: explicitPrivileges ? getPagePrivileges(user) : []
                    });
                }
            } catch (err) {
                console.error("Failed to load user", err);
            } finally {
                setLoading(false);
            }
        };

        loadDependencies();
        loadUser();
    }, [id, isEditMode]);

    const handleChange = (e) => {
        const { name, value, type, checked, multiple, options } = e.target;
        const nextValue = multiple
            ? Array.from(options).filter((option) => option.selected).map((option) => option.value)
            : type === 'checkbox' ? checked : value;
        setFormData(prev => ({
            ...prev,
            [name]: nextValue,
            ...(name === 'role' && value === 'ADMIN'
                ? { [PAGE_PRIVILEGE_FIELD]: assignablePrivilegeKeys }
                : {}),
        }));
    };

    const selectRole = (role) => {
        setFormData((current) => ({
            ...current,
            role,
            ...(role === 'ADMIN' ? { [PAGE_PRIVILEGE_FIELD]: assignablePrivilegeKeys } : {}),
        }));
    };

    const togglePrivilege = (privilegeKey) => {
        setLegacyPrivileges(false);
        setPrivilegesTouched(true);
        setFormData((current) => {
            const selected = current[PAGE_PRIVILEGE_FIELD];
            return {
                ...current,
                [PAGE_PRIVILEGE_FIELD]: selected.includes(privilegeKey)
                    ? selected.filter((key) => key !== privilegeKey)
                    : [...selected, privilegeKey],
            };
        });
    };

    const setPrivileges = (keys, enabled) => {
        setLegacyPrivileges(false);
        setPrivilegesTouched(true);
        setFormData((current) => ({
            ...current,
            [PAGE_PRIVILEGE_FIELD]: enabled
                ? [...new Set([...current[PAGE_PRIVILEGE_FIELD], ...keys])]
                : current[PAGE_PRIVILEGE_FIELD].filter((key) => !keys.includes(key)),
        }));
    };

    const validateCurrentStep = () => {
        setSaveError('');
        if (currentStep === 1) {
            if (!formData.username.trim() || !formData.email.trim() || !formData.full_name.trim()) {
                setSaveError('Complete the username, email, and full name fields before continuing.');
                return false;
            }
            if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
                setSaveError('Enter a valid email address before continuing.');
                return false;
            }
            if (!isEditMode && !formData.password) {
                setSaveError('Enter a password for the new user.');
                return false;
            }
            if (formData.password !== confirmPassword) {
                setSaveError('Password and confirmation do not match.');
                return false;
            }
        }
        if (currentStep === 2 && (!formData.role || !formData.company)) {
            setSaveError('Select a role and company before continuing.');
            return false;
        }
        return true;
    };

    const goToNextStep = () => {
        if (validateCurrentStep()) setCurrentStep((step) => Math.min(step + 1, FORM_STEPS.length));
    };

    const goToPreviousStep = () => {
        setSaveError('');
        setCurrentStep((step) => Math.max(step - 1, 1));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setSaveError('');
        try {
            if (formData.password !== confirmPassword) {
                setSaveError('Password and confirmation do not match.');
                return;
            }

            const payload = { ...formData };
            // Optional fields handling
            if (!payload.password) delete payload.password;

            // Int conversion
            if (payload.company) payload.company = parseInt(payload.company);
            payload.pet_ids = payload.pet_ids.map((petId) => parseInt(petId));
            const backendSupportsPrivileges = privilegeSupport === 'supported';
            const preserveLegacyPrivileges = !backendSupportsPrivileges || (isEditMode && legacyPrivileges && !privilegesTouched);
            if (preserveLegacyPrivileges) {
                delete payload[PAGE_PRIVILEGE_FIELD];
            } else {
                payload.can_access_production = payload[PAGE_PRIVILEGE_FIELD].some((key) => key.startsWith('pre.'));
            }

            let response;
            if (isEditMode) {
                response = await usersApi.updateUser(id, payload);
            } else {
                response = await usersApi.createUser(payload);
            }

            const savedUser = unwrapData(response);
            if (!preserveLegacyPrivileges && !hasExplicitPagePrivileges(savedUser)) {
                setSaveError(
                    'The user details were saved, but the API did not persist page privileges. ' +
                    'Deploy the page_privileges backend contract before using this account.'
                );
                return;
            }
            navigate('/dashboard/users');
        } catch (err) {
            console.error("Failed to save user", err);
            setSaveError(formatApiError(err));
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return (
        <div className="container-fluid">
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
                <div className="text-center">
                    <span className="spinner-border text-primary" role="status"></span>
                    <p className="mt-3 text-muted">Loading user details...</p>
                </div>
            </div>
        </div>
    );

    const effectiveProductionAccess = formData.role === 'ADMIN' || (
        privilegeSupport === 'supported'
            ? formData[PAGE_PRIVILEGE_FIELD].some((key) => key.startsWith('pre.'))
            : formData.can_access_production
    );

    return (
        <div className="container-fluid user-wizard-page">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4 user-wizard-header">
                <div className="d-flex align-items-center gap-3">
                    <button className="btn btn-light rounded-circle user-wizard-back" onClick={() => navigate('/dashboard/users')} title="Back to users">
                        <i className="ti ti-arrow-left"></i>
                    </button>
                    <div>
                        <div className="text-uppercase text-primary fw-semibold user-wizard-eyebrow">Access Management</div>
                        <h3 className="mb-1">
                            {isEditMode ? 'Edit User' : 'Create New User'}
                        </h3>
                        <p className="text-muted mb-0">Configure identity, operational scope, and application access.</p>
                    </div>
                </div>
                <span className="badge rounded-pill bg-primary-subtle text-primary px-3 py-2">
                    Step {currentStep} of {FORM_STEPS.length}
                </span>
            </div>

            <div className="card user-wizard-card border-0 shadow-sm">
                <div className="card-body p-4 p-lg-5">
                    <div className="d-flex align-items-start mb-4 user-form-steps overflow-auto pb-2">
                        {FORM_STEPS.map((step, index) => (
                            <React.Fragment key={step.number}>
                                <button
                                    type="button"
                                    className={`btn border-0 bg-transparent p-0 text-center user-step ${step.number === currentStep ? 'is-active' : ''} ${step.number < currentStep ? 'is-complete' : ''}`}
                                    onClick={() => step.number < currentStep && setCurrentStep(step.number)}
                                    disabled={step.number > currentStep}
                                >
                                    <span className="user-step-icon">
                                        {step.number < currentStep ? <i className="ti ti-check"></i> : <i className={`ti ${step.icon}`}></i>}
                                    </span>
                                    <small className="user-step-label">{step.label}</small>
                                </button>
                                {index < FORM_STEPS.length - 1 && <div className={`user-step-line ${step.number < currentStep ? 'is-complete' : ''}`}></div>}
                            </React.Fragment>
                        ))}
                    </div>
                    {saveError && (
                        <div className="alert alert-danger" role="alert">
                            <strong>Unable to save user.</strong> {saveError}
                        </div>
                    )}
                    {dependencyError && <div className="alert alert-warning" role="status">{dependencyError}</div>}
                    {legacyPrivileges && currentStep === 3 && privilegeSupport === 'supported' && (
                        <div className="alert alert-info" role="status">
                            This account uses legacy access rules. Select at least one page or explicitly save an empty list to move it to page-level access.
                        </div>
                    )}
                    <form onSubmit={handleSubmit}>
                        <div className="user-wizard-content">
                        {currentStep === 1 && <div>
                            <div className="user-step-heading-icon"><i className="ti ti-user-plus"></i></div>
                            <h4 className="mb-1">Account details</h4>
                            <p className="text-muted mb-3">Enter the user's identity and sign-in credentials.</p>
                            <div className="row g-3">
                                <div className="col-md-6">
                                    <label className="form-label">Username <span className="text-danger">*</span></label>
                                    <input type="text" className="form-control" name="username" value={formData.username} onChange={handleChange} autoComplete="username" />
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label">Email <span className="text-danger">*</span></label>
                                    <input type="email" className="form-control" name="email" value={formData.email} onChange={handleChange} autoComplete="email" />
                                </div>
                                <div className="col-12">
                                    <label className="form-label">Full Name <span className="text-danger">*</span></label>
                                    <input type="text" className="form-control" name="full_name" value={formData.full_name} onChange={handleChange} autoComplete="name" />
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label">
                                        Password {!isEditMode && <span className="text-danger">*</span>}
                                        {isEditMode && <small className="text-muted"> (leave blank to keep current)</small>}
                                    </label>
                                    <input type="password" className="form-control" name="password" value={formData.password} onChange={handleChange} autoComplete="new-password" />
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label">Confirm Password {!isEditMode && <span className="text-danger">*</span>}</label>
                                    <input type="password" className="form-control" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
                                </div>
                            </div>
                        </div>}

                        {currentStep === 2 && <div>
                            <div className="user-step-heading-icon"><i className="ti ti-user-shield"></i></div>
                            <h4 className="mb-1">Role and operational scope</h4>
                            <p className="text-muted mb-3">Assign responsibility, company, production lines, and system areas.</p>
                            <div className="row g-3">
                                <div className="col-12">
                                    <label className="form-label">Role <span className="text-danger">*</span></label>
                                    <div className="row g-2">
                                        {ROLE_OPTIONS.map((role) => (
                                            <div className="col-xl-3 col-md-4 col-6" key={role.value}>
                                                <button type="button" className={`role-option w-100 ${formData.role === role.value ? 'is-selected' : ''}`} onClick={() => selectRole(role.value)}>
                                                    <i className={`ti ${role.icon}`}></i>
                                                    <span className="role-option-copy"><strong>{role.label}</strong><small>{role.description}</small></span>
                                                    {formData.role === role.value && <i className="ti ti-circle-check role-option-check"></i>}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label">Company <span className="text-danger">*</span></label>
                                    <select name="company" value={formData.company} onChange={handleChange} className="form-select">
                                        <option value="">Select Company</option>
                                        {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                                    </select>
                                </div>
                                <div className="col-12">
                                    <label className="form-label">PET Lines <span className="text-muted">(optional)</span></label>
                                    <select name="pet_ids" value={formData.pet_ids} onChange={handleChange} className="form-select" multiple size={Math.min(Math.max(pets.length, 3), 6)}>
                                        {pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name || pet.pet_name}</option>)}
                                    </select>
                                    <small className="text-muted">Use Ctrl or Command to select multiple PET lines.</small>
                                </div>
                                <div className="col-md-6">
                                    <div className="form-check form-switch border rounded-3 p-3 ps-5 h-100">
                                        <input className="form-check-input" type="checkbox" role="switch" id="can-access-production" name="can_access_production" checked={formData.can_access_production} onChange={handleChange} disabled={privilegeSupport === 'supported'} />
                                        <label className="form-check-label fw-semibold" htmlFor="can-access-production">Production access</label>
                                        <small className="d-block text-muted">Coarse legacy access used when page privileges are unavailable.</small>
                                    </div>
                                </div>
                                <div className="col-md-6">
                                    <div className="form-check form-switch border rounded-3 p-3 ps-5 h-100">
                                        <input className="form-check-input" type="checkbox" role="switch" id="can-access-cip" name="can_access_cip" checked={formData.can_access_cip} onChange={handleChange} />
                                        <label className="form-check-label fw-semibold" htmlFor="can-access-cip">CIP access</label>
                                        <small className="d-block text-muted">Allows access to CIP features supported by the account API.</small>
                                    </div>
                                </div>
                            </div>
                        </div>}

                        {currentStep === 3 && <div>
                            <div className="user-step-heading-icon"><i className="ti ti-lock-access"></i></div>
                            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                                <div>
                                    <h5 className="mb-1">Page privileges</h5>
                                    <p className="text-muted mb-0">Choose the pages this user can see and open directly.</p>
                                </div>
                                {privilegeSupport === 'supported' && <div className="d-flex gap-2">
                                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setPrivileges(assignablePrivilegeKeys, true)} disabled={formData.role === 'ADMIN'}>
                                        Select all
                                    </button>
                                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setPrivileges(assignablePrivilegeKeys, false)} disabled={formData.role === 'ADMIN'}>
                                        Clear all
                                    </button>
                                </div>}
                            </div>

                            {privilegeSupport === 'checking' && (
                                <div className="alert alert-light border py-2">
                                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                    Checking page-privilege support…
                                </div>
                            )}

                            {privilegeSupport === 'legacy' && (
                                <div className="alert alert-warning py-2">
                                    The current API supports only coarse production and CIP access. Page-level assignments will become available when the backend exposes <code>page_privileges</code>.
                                </div>
                            )}

                            {formData.role === 'ADMIN' && privilegeSupport === 'supported' && (
                                <div className="alert alert-warning py-2">Administrators always have access to every page, including user and privilege management.</div>
                            )}

                            {privilegeSupport === 'supported' && <div className="row g-3">
                                {Object.entries(privilegeGroups).map(([section, privileges]) => {
                                    const keys = privileges.map((privilege) => privilege.key);
                                    const selectedCount = keys.filter((key) => formData[PAGE_PRIVILEGE_FIELD].includes(key)).length;
                                    return (
                                        <div className="col-xxl-4 col-lg-6" key={section}>
                                            <fieldset className="permission-group h-100" disabled={formData.role === 'ADMIN'}>
                                                <div className="d-flex align-items-center justify-content-between border-bottom pb-2 mb-2">
                                                    <legend className="fs-6 fw-semibold mb-0 w-auto">{section}</legend>
                                                    <button
                                                        type="button"
                                                        className="btn btn-link btn-sm p-0 text-decoration-none"
                                                        onClick={() => setPrivileges(keys, selectedCount !== keys.length)}
                                                    >
                                                        {selectedCount === keys.length ? 'Clear section' : 'Select section'}
                                                    </button>
                                                </div>
                                                {privileges.map((privilege) => (
                                                    <div className="form-check mb-2" key={privilege.key}>
                                                        <input
                                                            className="form-check-input"
                                                            type="checkbox"
                                                            id={`privilege-${privilege.key}`}
                                                            checked={formData[PAGE_PRIVILEGE_FIELD].includes(privilege.key)}
                                                            onChange={() => togglePrivilege(privilege.key)}
                                                        />
                                                        <label className="form-check-label" htmlFor={`privilege-${privilege.key}`}>
                                                            {privilege.label}
                                                            <span className="d-block text-muted" style={{ fontSize: '0.75rem' }}>{privilege.key}</span>
                                                        </label>
                                                    </div>
                                                ))}
                                            </fieldset>
                                        </div>
                                    );
                                })}
                            </div>}
                        </div>}

                        {currentStep === 4 && <div>
                            <div className="user-step-heading-icon is-success"><i className="ti ti-checklist"></i></div>
                            <h4 className="mb-1">Review user</h4>
                            <p className="text-muted mb-3">Confirm the details below before saving.</p>
                            <div className="row g-3">
                                <div className="col-lg-6">
                                    <div className="review-panel p-3 h-100">
                                        <h6 className="border-bottom pb-2 mb-3">Account</h6>
                                        <dl className="row mb-0 small">
                                            <dt className="col-4 text-muted">Name</dt><dd className="col-8">{formData.full_name}</dd>
                                            <dt className="col-4 text-muted">Username</dt><dd className="col-8">{formData.username}</dd>
                                            <dt className="col-4 text-muted">Email</dt><dd className="col-8">{formData.email}</dd>
                                            <dt className="col-4 text-muted">Password</dt><dd className="col-8">{formData.password ? (isEditMode ? 'Will be changed' : 'Configured') : 'Unchanged'}</dd>
                                        </dl>
                                    </div>
                                </div>
                                <div className="col-lg-6">
                                    <div className="review-panel p-3 h-100">
                                        <h6 className="border-bottom pb-2 mb-3">Role and scope</h6>
                                        <dl className="row mb-0 small">
                                            <dt className="col-4 text-muted">Role</dt><dd className="col-8">{formData.role.replaceAll('_', ' ')}</dd>
                                            <dt className="col-4 text-muted">Company</dt><dd className="col-8">{companies.find((company) => String(company.id) === String(formData.company))?.name || '—'}</dd>
                                            <dt className="col-4 text-muted">PET Lines</dt><dd className="col-8">{formData.pet_ids.length ? pets.filter((pet) => formData.pet_ids.includes(String(pet.id))).map((pet) => pet.name || pet.pet_name).join(', ') : 'All or unassigned'}</dd>
                                            <dt className="col-4 text-muted">Production</dt><dd className="col-8">{effectiveProductionAccess ? 'Allowed' : 'Not allowed'}</dd>
                                            <dt className="col-4 text-muted">CIP</dt><dd className="col-8">{formData.can_access_cip ? 'Allowed' : 'Not allowed'}</dd>
                                        </dl>
                                    </div>
                                </div>
                                <div className="col-12">
                                    <div className="review-panel p-3">
                                        <h6 className="mb-2">Page permissions</h6>
                                        {formData.role === 'ADMIN' ? (
                                            <span className="badge bg-danger-subtle text-danger">All pages through administrator access</span>
                                        ) : privilegeSupport === 'supported' ? (
                                            <><span className="badge bg-primary-subtle text-primary me-2">{formData[PAGE_PRIVILEGE_FIELD].length} assigned</span><small className="text-muted">Page-level access will be enforced.</small></>
                                        ) : (
                                            <span className="badge bg-warning-subtle text-warning">Legacy production and CIP rules</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>}
                        </div>

                        <div className="d-flex align-items-center justify-content-between gap-2 mt-4 pt-3 border-top user-wizard-actions">
                            <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={() => navigate('/dashboard/users')}
                            >
                                Cancel
                            </button>
                            <div className="d-flex gap-2">
                                {currentStep > 1 && <button type="button" className="btn btn-secondary" onClick={goToPreviousStep}><i className="ti ti-arrow-left me-1"></i>Back</button>}
                                {currentStep < FORM_STEPS.length ? (
                                    <button type="button" className="btn btn-primary" onClick={goToNextStep}>Continue<i className="ti ti-arrow-right ms-1"></i></button>
                                ) : (
                                    <button type="submit" className="btn btn-success" disabled={submitting}>
                                        {submitting ? <><span className="spinner-border spinner-border-sm me-2" role="status"></span>Saving...</> : <><i className="ti ti-device-floppy me-2"></i>{isEditMode ? 'Update User' : 'Create User'}</>}
                                    </button>
                                )}
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default UserForm;
