import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usersApi } from '../../api/users';
import { productionApi } from '../../api/production';

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
        pet: '',
        password: ''
    });

    const [companies, setCompanies] = useState([]);
    const [pets, setPets] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const loadDependencies = async () => {
            try {
                const [companiesRes, petsRes] = await Promise.all([
                    usersApi.getCompanies(),
                    productionApi.getPets()
                ]);

                // Handle companies response
                if (companiesRes.data && Array.isArray(companiesRes.data.data)) {
                    setCompanies(companiesRes.data.data);
                } else if (Array.isArray(companiesRes.data)) {
                    setCompanies(companiesRes.data);
                }

                // Handle pets response
                if (petsRes.data && Array.isArray(petsRes.data.data)) {
                    setPets(petsRes.data.data);
                } else if (Array.isArray(petsRes.data)) {
                    setPets(petsRes.data);
                } else if (petsRes.data && Array.isArray(petsRes.data.results)) {
                    setPets(petsRes.data.results);
                }

            } catch (err) {
                console.error("Failed to load dependency data", err);
            }
        };

        const loadUser = async () => {
            if (!isEditMode) return;
            setLoading(true);
            try {
                const res = await usersApi.getUsers();

                let userList = [];
                if (res.data.data) userList = res.data.data;
                else if (Array.isArray(res.data)) userList = res.data;

                const user = userList.find(u => u.id === parseInt(id));
                if (user) {
                    setFormData({
                        username: user.username,
                        email: user.email,
                        full_name: user.full_name,
                        role: user.role,
                        company: user.company || '',
                        pet: user.pet || '',
                        password: ''
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
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload = { ...formData };
            // Optional fields handling
            if (payload.pet === '') payload.pet = null;
            if (!payload.password) delete payload.password;

            // Int conversion
            if (payload.company) payload.company = parseInt(payload.company);
            if (payload.pet) payload.pet = parseInt(payload.pet);

            if (isEditMode) {
                await usersApi.updateUser(id, payload);
            } else {
                await usersApi.createUser(payload);
            }
            navigate('/dashboard/users');
        } catch (err) {
            console.error("Failed to save user", err);
            // Basic error alert
            alert("Failed to save user. Please check your inputs.");
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

    return (
        <div className="container-fluid">
            <div className="d-flex align-items-center gap-3 mb-4">
                <button className="btn btn-outline-secondary" onClick={() => navigate('/dashboard/users')}>
                    <i className="ti ti-arrow-left me-2"></i>
                    Back
                </button>
                <h4 className="mb-0">
                    {isEditMode ? 'Edit User' : 'Create New User'}
                </h4>
            </div>

            <div className="card">
                <div className="card-body">
                    <form onSubmit={handleSubmit}>
                        <div className="row g-3">
                            <div className="col-md-6">
                                <label className="form-label">Username <span className="text-danger">*</span></label>
                                <input
                                    type="text"
                                    className="form-control"
                                    name="username"
                                    value={formData.username}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="col-md-6">
                                <label className="form-label">Email <span className="text-danger">*</span></label>
                                <input
                                    type="email"
                                    className="form-control"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <div className="col-12">
                                <label className="form-label">Full Name <span className="text-danger">*</span></label>
                                <input
                                    type="text"
                                    className="form-control"
                                    name="full_name"
                                    value={formData.full_name}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <div className="col-md-6">
                                <label className="form-label">Role <span className="text-danger">*</span></label>
                                <select
                                    name="role"
                                    value={formData.role}
                                    onChange={handleChange}
                                    className="form-select"
                                    required
                                >
                                    <option value="OPERATOR">Operator</option>
                                    <option value="SUPERVISOR">Supervisor</option>
                                    <option value="QUALITY_CONTROL">Quality Control</option>
                                    <option value="LOGISTICS_MANAGER">Logistics Manager</option>
                                    <option value="ADMIN">Admin</option>
                                </select>
                            </div>

                            <div className="col-md-6">
                                <label className="form-label">Company <span className="text-danger">*</span></label>
                                <select
                                    name="company"
                                    value={formData.company}
                                    onChange={handleChange}
                                    className="form-select"
                                    required
                                >
                                    <option value="">Select Company</option>
                                    {companies.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="col-md-6">
                                <label className="form-label">PET Line (Optional)</label>
                                <select
                                    name="pet"
                                    value={formData.pet}
                                    onChange={handleChange}
                                    className="form-select"
                                >
                                    <option value="">None</option>
                                    {pets.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.name || p.pet_name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="col-md-6">
                                <label className="form-label">
                                    Password {!isEditMode && <span className="text-danger">*</span>}
                                    {isEditMode && <small className="text-muted"> (leave blank to keep current)</small>}
                                </label>
                                <input
                                    type="password"
                                    className="form-control"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    required={!isEditMode}
                                />
                            </div>
                        </div>

                        <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => navigate('/dashboard/users')}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={submitting}
                            >
                                {submitting ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <i className="ti ti-device-floppy me-2"></i>
                                        {isEditMode ? 'Update User' : 'Create User'}
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default UserForm;
