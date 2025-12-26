import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth, AuthProvider } from '../context/AuthContext';

import { productionApi } from '../api/production';

// Lazy load pages
const Login = React.lazy(() => import('../pages/auth/Login'));
const DashboardLayout = React.lazy(() => import('../components/layout/DashboardLayout'));
const DashboardOverview = React.lazy(() => import('../pages/dashboard/Overview'));
const ProductionList = React.lazy(() => import('../pages/production/ProductionList'));
const ReportForm = React.lazy(() => import('../pages/production/ReportForm'));
const ReportDetails = React.lazy(() => import('../pages/production/ReportDetails'));
const GenericCrudPage = React.lazy(() => import('../pages/production/GenericCrudPage'));
const UserList = React.lazy(() => import('../pages/users/UserList'));
const UserForm = React.lazy(() => import('../pages/users/UserForm'));
const ProductList = React.lazy(() => import('../pages/inventory/ProductList'));
const ProductForm = React.lazy(() => import('../pages/inventory/ProductForm'));

const ProtectedRoute = ({ children }) => {
    const { user } = useAuth();
    if (!user) {
        return <Navigate to="/login" replace />;
    }
    return <Outlet />;
};

export const AppRouter = () => {
    return (
        <BrowserRouter>
            <AuthProvider>
                <React.Suspense fallback={<div className="h-screen w-screen bg-slate-950 flex items-center justify-center text-emerald-500">Loading...</div>}>
                    <Routes>
                        <Route path="/login" element={<Login />} />

                        <Route element={<ProtectedRoute />}>
                            <Route path="/" element={<Navigate to="/dashboard" replace />} />
                            <Route path="/dashboard" element={<DashboardLayout />}>
                                <Route index element={<DashboardOverview />} />
                                <Route path="production" element={<ProductionList />} />
                                <Route path="production/new" element={<ReportForm />} />
                                <Route path="production/:id" element={<ReportDetails />} />
                                <Route path="production/:id/edit" element={<ReportForm />} />

                                {/* Production Sub-modules */}
                                <Route
                                    path="production/materials"
                                    element={
                                        <GenericCrudPage
                                            title="Materials Management"
                                            api={{
                                                list: productionApi.getMaterials,
                                                create: productionApi.createMaterial,
                                                update: productionApi.updateMaterial,
                                                delete: productionApi.deleteMaterial
                                            }}
                                            columns={[
                                                { header: 'ID', accessor: 'id' },
                                                { header: 'Name', accessor: 'name' },
                                                { header: 'Created', accessor: 'date_created', render: (r) => r.date_created?.split('T')[0] }
                                            ]}
                                            formFields={[
                                                { name: 'name', label: 'Material Name', required: true }
                                            ]}
                                        />
                                    }
                                />
                                <Route
                                    path="production/meters"
                                    element={
                                        <GenericCrudPage
                                            title="Meter Readings"
                                            api={{
                                                list: productionApi.getMeters,
                                                create: productionApi.createMeter,
                                                update: productionApi.updateMeter,
                                                delete: productionApi.deleteMeter
                                            }}
                                            columns={[
                                                { header: 'ID', accessor: 'id' },
                                                { header: 'Name', accessor: 'name' },
                                            ]}
                                            formFields={[
                                                { name: 'name', label: 'Meter Name', required: true }
                                            ]}
                                        />
                                    }
                                />
                                <Route
                                    path="production/pets"
                                    element={
                                        <GenericCrudPage
                                            title="Pets / Lines"
                                            api={{
                                                list: productionApi.getPets,
                                                create: productionApi.createPet,
                                                update: productionApi.updatePet,
                                                delete: productionApi.deletePet
                                            }}
                                            columns={[
                                                { header: 'ID', accessor: 'id' },
                                                { header: 'Pet Name', accessor: 'pet_name' },
                                            ]}
                                            formFields={[
                                                { name: 'pet_name', label: 'Pet Name', required: true }
                                            ]}
                                        />
                                    }
                                />
                                <Route
                                    path="production/shifts"
                                    element={
                                        <GenericCrudPage
                                            title="Shift Management"
                                            api={{
                                                list: productionApi.getShifts,
                                                create: productionApi.createShift,
                                                update: productionApi.updateShift,
                                                delete: productionApi.deleteShift
                                            }}
                                            columns={[
                                                { header: 'ID', accessor: 'id' },
                                                { header: 'Name', accessor: 'name' },
                                                { header: 'Start', accessor: 'start_time' },
                                                { header: 'End', accessor: 'end_time' },
                                            ]}
                                            formFields={[
                                                { name: 'name', label: 'Shift Name', required: true },
                                                { name: 'start_time', label: 'Start Time', type: 'time', required: true },
                                                { name: 'end_time', label: 'End Time', type: 'time', required: true },
                                            ]}
                                        />
                                    }
                                />
                                <Route
                                    path="production/batches"
                                    element={
                                        <GenericCrudPage
                                            title="Batches"
                                            api={{
                                                list: productionApi.getBatches, // Used real getBatches endpoint
                                                create: productionApi.createBatch,
                                                update: productionApi.updateBatch,
                                                delete: productionApi.deleteBatch
                                            }}
                                            columns={[
                                                { header: 'ID', accessor: 'id' },
                                                { header: 'Batch Number', accessor: 'batch_number' },
                                            ]}
                                            formFields={[
                                                { name: 'batch_number', label: 'Batch Number', required: true }
                                            ]}
                                        />
                                    }
                                />
                                {/* User Management */}
                                <Route path="users" element={<UserList />} />
                                <Route path="users/new" element={<UserForm />} />
                                <Route path="users/:id/edit" element={<UserForm />} />

                                {/* Inventory - Products */}
                                <Route path="inventory/products" element={<ProductList />} />
                                <Route path="inventory/products/new" element={<ProductForm />} />
                                <Route path="inventory/products/:id/edit" element={<ProductForm />} />
                            </Route>
                        </Route>

                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                </React.Suspense>
            </AuthProvider>
        </BrowserRouter>
    );
};
