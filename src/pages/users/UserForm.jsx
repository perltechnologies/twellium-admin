import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, User } from 'lucide-react';
import { Button, Input, Card } from '../../components/ui';
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
        company: '', // Will store ID
        pet: '', // Will store ID
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
                // Assuming standard wrapped response, or array. logic from previous implementation
                // If users endpoints returns { data: [...] } or just [...]
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

    if (loading) return <div className="p-8 text-center text-slate-500">Loading user details...</div>;

    return (
        <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => navigate('/dashboard/users')}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                </Button>
                <h1 className="text-2xl font-bold text-slate-100">
                    {isEditMode ? 'Edit User' : 'Create New User'}
                </h1>
            </div>

            <Card className="p-6 border-slate-800 bg-slate-900/50">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 gap-6">

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Input
                                label="Username"
                                name="username"
                                value={formData.username}
                                onChange={handleChange}
                                required
                            />
                            <Input
                                label="Email"
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <Input
                            label="Full Name"
                            name="full_name"
                            value={formData.full_name}
                            onChange={handleChange}
                            required
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-400">Role</label>
                                <select
                                    name="role"
                                    value={formData.role}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 text-slate-200"
                                >
                                    <option value="OPERATOR">OPERATOR</option>
                                    <option value="SUPERVISOR">SUPERVISOR</option>
                                    <option value="QUALITY_CONTROL">QUALITY_CONTROL</option>
                                    <option value="LOGISTICS_MANAGER">LOGISTICS_MANAGER</option>
                                    <option value="ADMIN">ADMIN</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-400">Company</label>
                                <select
                                    name="company"
                                    value={formData.company}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 text-slate-200"
                                >
                                    <option value="">Select Company</option>
                                    {companies.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-400">Pet (Optional)</label>
                                <select
                                    name="pet"
                                    value={formData.pet}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 text-slate-200"
                                >
                                    <option value="">None</option>
                                    {pets.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.name || p.pet_name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <Input
                                label={isEditMode ? "Password (leave blank to keep)" : "Password"}
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                required={!isEditMode}
                            />
                        </div>

                    </div>

                    <div className="flex justify-end gap-4 pt-4 border-t border-slate-800">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => navigate('/dashboard/users')}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-500 text-white min-w-[120px]"
                            disabled={submitting}
                        >
                            {submitting ? <span className="animate-spin mr-2">⟳</span> : <Save className="h-4 w-4 mr-2" />}
                            {isEditMode ? 'Update User' : 'Create User'}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};

export default UserForm;
