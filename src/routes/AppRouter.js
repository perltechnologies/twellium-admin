import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth, AuthProvider } from '../context/AuthContext';

import { productionApi } from '../api/production';

// Lazy load pages
const Login = React.lazy(() => import('../pages/auth/Login'));
const DashboardLayout = React.lazy(() => import('../components/layout/DashboardLayout'));
const DashboardOverview = React.lazy(() => import('../pages/dashboard/Overview'));
const ProductionOverview = React.lazy(() => import('../pages/dashboard/ProductionOverview'));
const Formulas = React.lazy(() => import('../pages/dashboard/Formulas'));
const ProductionReports = React.lazy(() => import('../pages/reports/ProductionReports'));
const OeeAnalytics = React.lazy(() => import('../pages/reports/OeeAnalytics'));
const ProductionAnalytics = React.lazy(() => import('../pages/reports/ProductionAnalytics'));
const MaterialReport = React.lazy(() => import('../pages/reports/MaterialReport'));
const SyrupReport = React.lazy(() => import('../pages/reports/SyrupReport'));
const CO2Report = React.lazy(() => import('../pages/reports/CO2Report'));
const ConsumptionReport = React.lazy(() => import('../pages/reports/ConsumptionReport'));
const ProductionList = React.lazy(() => import('../pages/production/ProductionList'));
const ReportForm = React.lazy(() => import('../pages/production/ReportForm'));
const ReportDetails = React.lazy(() => import('../pages/production/ReportDetails'));
const ModeSelection = React.lazy(() => import('../pages/ModeSelection'));
// Post Production Pages
const PostProductionLayout = React.lazy(() => import('../components/layout/PostProductionLayout'));
const PostProduction = React.lazy(() => import('../pages/post-production/Production'));
const PostProductionDashboard = React.lazy(() => import('../pages/inventory/PostProductionDashboard'));
const InventoryOverview = React.lazy(() => import('../pages/inventory/InventoryOverview'));
const ProductionMode = React.lazy(() => import('../pages/inventory/ProductionMode'));
const WarehouseWorkflows = React.lazy(() => import('../pages/inventory/WarehouseWorkflows'));
const BatchScan = React.lazy(() => import('../pages/inventory/BatchScan'));
const ActivityLogs = React.lazy(() => import('../pages/inventory/ActivityLogs'));
const ActivityLogDetails = React.lazy(() => import('../pages/inventory/ActivityLogDetails'));
const ReprintLabels = React.lazy(() => import('../pages/inventory/ReprintLabels'));
const UnitLookup = React.lazy(() => import('../pages/inventory/UnitLookup'));
const StageManagement = React.lazy(() => import('../pages/inventory/StageManagement'));
const FindBarcode = React.lazy(() => import('../pages/inventory/FindBarcode'));
const FindRfid = React.lazy(() => import('../pages/inventory/FindRfid'));
const PalletList = React.lazy(() => import('../pages/inventory/PalletList'));
const PalletDetails = React.lazy(() => import('../pages/inventory/PalletDetails'));
const LoadingDispatch = React.lazy(() => import('../pages/logistics/LoadingDispatch'));
const VehicleList = React.lazy(() => import('../pages/logistics/VehicleList'));
const DriverList = React.lazy(() => import('../pages/logistics/DriverList'));
const StoppageLogList = React.lazy(() => import('../pages/production/stoppages/StoppageLogList'));
const StoppagesTable = React.lazy(() => import('../pages/production/stoppages/StoppagesTable'));
const StoppageLogForm = React.lazy(() => import('../pages/production/stoppages/StoppageLogForm'));
const StoppageLogDetails = React.lazy(() => import('../pages/production/stoppages/StoppageLogDetails'));
const GenericCrudPage = React.lazy(() => import('../pages/production/GenericCrudPage'));
const ProductionRanges = React.lazy(() => import('../pages/production/ProductionRanges'));
const MeasuringUnits = React.lazy(() => import('../pages/production/MeasuringUnits'));
const StandardCO2Levels = React.lazy(() => import('../pages/production/StandardCO2Levels'));
const SyrupDensities = React.lazy(() => import('../pages/production/SyrupDensities'));
const SyrupDilutionRatios = React.lazy(() => import('../pages/production/SyrupDilutionRatios'));
const SyrupConcentrations = React.lazy(() => import('../pages/production/SyrupConcentrations'));
const BottlesPerPack = React.lazy(() => import('../pages/production/BottlesPerPack'));
const LineSpeeds = React.lazy(() => import('../pages/production/LineSpeeds'));
const Suppliers = React.lazy(() => import('../pages/definitions/Suppliers'));
const PreformColors = React.lazy(() => import('../pages/definitions/PreformColors'));
const CapTypes = React.lazy(() => import('../pages/definitions/CapTypes'));
const CapColors = React.lazy(() => import('../pages/definitions/CapColors'));
const LabelProductSizes = React.lazy(() => import('../pages/definitions/LabelProductSizes'));
const LabelNames = React.lazy(() => import('../pages/definitions/LabelNames'));
const ShrinkProductSizes = React.lazy(() => import('../pages/definitions/ShrinkProductSizes'));
const PackSizes = React.lazy(() => import('../pages/definitions/PackSizes'));
const ShrinkNames = React.lazy(() => import('../pages/definitions/ShrinkNames'));
const PreformSizes = React.lazy(() => import('../pages/definitions/PreformSizes'));
const CageQuantities = React.lazy(() => import('../pages/definitions/CageQuantities'));
const CapBoxQuantities = React.lazy(() => import('../pages/definitions/CapBoxQuantities'));
const DowntimeSubCategoryList = React.lazy(() => import('../pages/production/DowntimeSubCategoryList'));
const DowntimeBreakdown = React.lazy(() => import('../pages/production/DowntimeBreakdown'));
const UserList = React.lazy(() => import('../pages/users/UserList'));
const UserForm = React.lazy(() => import('../pages/users/UserForm'));
const ProductList = React.lazy(() => import('../pages/inventory/ProductList'));
const ProductForm = React.lazy(() => import('../pages/inventory/ProductForm'));
const ShiftMetricsByCode = React.lazy(() => import('../pages/production/ShiftMetricsByCode'));
const CreateReport = React.lazy(() => import('../pages/production/CreateReport'));

const ProtectedRoute = ({ children }) => {
    const { user } = useAuth();
    if (!user) {
        return <Navigate to="/login" replace />;
    }
    return children ? children : <Outlet />;
};

export const AppRouter = () => {
    return (
        <BrowserRouter>
            <AuthProvider>
                <React.Suspense fallback={<div className="h-screen w-screen bg-slate-950 flex items-center justify-center text-emerald-500">Loading...</div>}>
                    <Routes>
                        <Route path="/login" element={<Login />} />

                        <Route path="/mode-selection" element={
                            <ProtectedRoute>
                                <ModeSelection />
                            </ProtectedRoute>
                        } />

                        {/* Post Production Routes */}
                        <Route path="/post-production" element={
                            <ProtectedRoute>
                                <PostProductionLayout />
                            </ProtectedRoute>
                        }>
                            <Route index element={<PostProductionDashboard />} />
                            <Route path="overview" element={<InventoryOverview />} />
                            <Route path="production" element={<ProductionMode />} />
                            <Route path="warehouse" element={<WarehouseWorkflows />} />
                            <Route path="lookup" element={<UnitLookup />} />
                            <Route path="manage-stages" element={<StageManagement />} />
                            <Route path="find-barcode" element={<FindBarcode />} />
                            <Route path="find-rfid" element={<FindRfid />} />
                            <Route path="activity-logs" element={<ActivityLogs />} />
                            <Route path="activity-logs/:id" element={<ActivityLogDetails />} />
                            <Route path="pallets/:stage" element={<PalletList />} />
                            <Route path="pallets/details/:identifier" element={<PalletDetails />} />
                            <Route path="reprint" element={<ReprintLabels />} />
                            <Route path="batch-scan" element={<BatchScan />} />
                            <Route path="logistics">
                                <Route index element={<Navigate to="dispatch" replace />} />
                                <Route path="dispatch" element={<LoadingDispatch />} />
                                <Route path="vehicles" element={<VehicleList />} />
                                <Route path="drivers" element={<DriverList />} />
                            </Route>
                        </Route>

                        <Route path="/dashboard" element={
                            <ProtectedRoute>
                                <DashboardLayout />
                            </ProtectedRoute>
                        }>
                            <Route index element={<DashboardOverview />} />
                            <Route path="formulas" element={<Formulas />} />

                            {/* Reporting Routes */}
                            <Route path="reports">
                                <Route path="production" element={<ProductionReports />} />
                            </Route>

                            {/* Analytics Routes */}
                            <Route path="analytics">
                                <Route path="oee-analytics" element={<OeeAnalytics />} />
                                <Route path="production-analytics" element={<ProductionAnalytics />} />
                                <Route path="material-analytics" element={<MaterialReport />} />
                                <Route path="syrup-analytics" element={<SyrupReport />} />
                                <Route path="co2-analytics" element={<CO2Report />} />
                                <Route path="consumption-analytics" element={<ConsumptionReport />} />
                            </Route>

                            {/* Production Routes */}
                            <Route path="production">
                                <Route index element={<ProductionList />} />
                                <Route path="overview" element={<ProductionOverview />} />
                                <Route path="reports" element={<ProductionList />} />
                                <Route path="new" element={<CreateReport />} />
                                <Route path="metrics" element={<ShiftMetricsByCode />} />
                                <Route path=":id" element={<ReportDetails />} />
                                <Route path=":id/edit" element={<CreateReport />} />

                                {/* Stoppage Logs */}
                                <Route path="stoppages" element={<StoppageLogList />} />
                                <Route path="stoppages-table" element={<StoppagesTable />} />
                                <Route path="stoppages/new" element={<StoppageLogForm />} />
                                <Route path="stoppages/:id" element={<StoppageLogDetails />} />
                                <Route path="stoppages/:id/edit" element={<StoppageLogForm />} />

                                <Route
                                    path="incident-categories"
                                    element={
                                        <GenericCrudPage
                                            title="Incident Categories"
                                            subtitle="Organize stoppage incidents with clear, reusable categories."
                                            api={{
                                                list: productionApi.getIncidentCategories,
                                                create: productionApi.createIncidentCategory,
                                                update: productionApi.updateIncidentCategory,
                                                delete: productionApi.deleteIncidentCategory
                                            }}
                                            columns={[
                                                { header: 'ID', accessor: 'id' },
                                                {
                                                    header: 'Category Name',
                                                    accessor: 'category_name',
                                                    render: (row) => (
                                                        <span className="badge bg-soft-primary rounded-full px-3 py-2 text-primary fw-semibold text-capitalize">
                                                            {row.category_name || '-'}
                                                        </span>
                                                    )
                                                },
                                                { 
                                                    header: 'Created', 
                                                    accessor: 'created_at',
                                                    render: (row) => row.created_at ? new Date(row.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
                                                }
                                            ]}
                                            formFields={[
                                                { name: 'category_name', label: 'Category Name', required: true }
                                            ]}
                                            createButtonLabel="Add Incident Category"
                                            tableTitle="Incident Category Directory"
                                            emptyStateTitle="No incident categories yet"
                                            emptyStateDescription="Create a category to standardize incident logging in production stoppages."
                                            showActionsOnHover={false}
                                            showStats={true}
                                        />
                                    }
                                />


                                <Route
                                    path="downtime-categories"
                                    element={
                                        <GenericCrudPage
                                            title="Downtime Categories"
                                            subtitle="Classify and manage downtime types for accurate production tracking."
                                            api={{
                                                list: productionApi.getDowntimeCategories,
                                                create: productionApi.createDowntimeCategory,
                                                update: productionApi.updateDowntimeCategory,
                                                delete: productionApi.deleteDowntimeCategory
                                            }}
                                            columns={[
                                                { header: 'ID', accessor: 'id' },
                                                {
                                                    header: 'Category Name',
                                                    accessor: 'name',
                                                    render: (row) => (
                                                        <span className="badge bg-soft-warning rounded-full px-3 py-2 text-warning fw-semibold text-capitalize">
                                                            {row.name || '-'}
                                                        </span>
                                                    )
                                                },
                                                {
                                                    header: 'Description',
                                                    accessor: 'description',
                                                    render: (row) => (
                                                        <span className="text-slate-500 dark:text-slate-400">
                                                            {row.description || <em className="text-slate-400">No description</em>}
                                                        </span>
                                                    )
                                                },
                                                {
                                                    header: 'Created',
                                                    accessor: 'created_at',
                                                    render: (row) => row.created_at ? new Date(row.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
                                                }
                                            ]}
                                            formFields={[
                                                { name: 'name', label: 'Category Name', required: true },
                                                { name: 'description', label: 'Description', required: false }
                                            ]}
                                            createButtonLabel="Add Downtime Category"
                                            tableTitle="Downtime Category Directory"
                                            emptyStateTitle="No downtime categories yet"
                                            emptyStateDescription="Create a category to classify downtime events in production reports."
                                            showActionsOnHover={false}
                                            showStats={true}
                                        />
                                    }
                                />
                                <Route path="downtime-sub-categories" element={<DowntimeSubCategoryList />} />
                                <Route path="downtime-breakdown" element={<DowntimeBreakdown />} />

                                {/* Production Sub-modules */}
                                <Route
                                    path="materials"
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
                                    path="meters"
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
                                                { header: 'Remarks', accessor: 'remarks' },
                                            ]}
                                            formFields={[
                                                { name: 'name', label: 'Meter Name', required: true },
                                                { name: 'remarks', label: 'Remarks', required: false }
                                            ]}
                                        />
                                    }
                                />
                                <Route
                                    path="pets"
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
                                                { header: 'Speedline', accessor: 'speedline' },
                                            ]}
                                            formFields={[
                                                { name: 'pet_name', label: 'Pet Name', required: true },
                                                { name: 'speedline', label: 'Speedline', type: 'number', step: '0.01', required: true }
                                            ]}
                                            showStats={true}
                                        />
                                    }
                                />
                                <Route
                                    path="shifts"
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
                                    path="batches"
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

                                {/* Configurations */}
                                <Route path="configs">
                                    <Route path="ranges" element={<ProductionRanges />} />
                                    <Route path="units" element={<MeasuringUnits />} />
                                    <Route path="co2" element={<StandardCO2Levels />} />
                                    <Route path="densities" element={<SyrupDensities />} />
                                    <Route path="ratios" element={<SyrupDilutionRatios />} />
                                    <Route path="concentrations" element={<SyrupConcentrations />} />
                                    <Route path="bottles-per-pack" element={<BottlesPerPack />} />
                                    <Route path="line-speeds" element={<LineSpeeds />} />
                                    />
                                </Route>
                            </Route>

                            {/* User Management */}
                            <Route path="users" element={<UserList />} />
                            <Route path="users/new" element={<UserForm />} />
                            <Route path="users/:id/edit" element={<UserForm />} />

                            {/* Inventory - Products */}
                            <Route path="inventory/products" element={<ProductList />} />
                            <Route path="inventory/products/new" element={<ProductForm />} />
                            <Route path="inventory/products/:id/edit" element={<ProductForm />} />

                            {/* Material Definitions */}
                            <Route path="definitions">
                                <Route path="suppliers" element={<Suppliers />} />
                                <Route path="preform-colors" element={<PreformColors />} />
                                <Route path="cap-types" element={<CapTypes />} />
                                <Route path="cap-colors" element={<CapColors />} />
                                <Route path="label-product-sizes" element={<LabelProductSizes />} />
                                <Route path="label-names" element={<LabelNames />} />
                                <Route path="shrink-product-sizes" element={<ShrinkProductSizes />} />
                                <Route path="pack-sizes" element={<PackSizes />} />
                                <Route path="shrink-names" element={<ShrinkNames />} />
                                <Route path="preform-sizes" element={<PreformSizes />} />
                                <Route path="cage-quantities" element={<CageQuantities />} />
                                <Route path="cap-box-quantities" element={<CapBoxQuantities />} />
                            </Route>
                        </Route>

                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                </React.Suspense>
            </AuthProvider>
        </BrowserRouter>
    );
};
