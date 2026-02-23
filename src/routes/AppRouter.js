import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth, AuthProvider } from '../context/AuthContext';

import { productionApi } from '../api/production';

// Lazy load pages
const Login = React.lazy(() => import('../pages/auth/Login'));
const DashboardLayout = React.lazy(() => import('../components/layout/DashboardLayout'));
const DashboardOverview = React.lazy(() => import('../pages/dashboard/Overview'));
const Formulas = React.lazy(() => import('../pages/dashboard/Formulas'));
const ProductionList = React.lazy(() => import('../pages/production/ProductionList'));
const ReportForm = React.lazy(() => import('../pages/production/ReportForm'));
const ReportDetails = React.lazy(() => import('../pages/production/ReportDetails'));
const ModeSelection = React.lazy(() => import('../pages/ModeSelection'));
// Post Production Pages
const PostProductionLayout = React.lazy(() => import('../components/layout/PostProductionLayout'));
const PostProduction = React.lazy(() => import('../pages/post-production/Production'));
const StoppageLogList = React.lazy(() => import('../pages/production/stoppages/StoppageLogList'));
const StoppageLogForm = React.lazy(() => import('../pages/production/stoppages/StoppageLogForm'));
const StoppageLogDetails = React.lazy(() => import('../pages/production/stoppages/StoppageLogDetails'));
const GenericCrudPage = React.lazy(() => import('../pages/production/GenericCrudPage'));
const DowntimeSubCategoryList = React.lazy(() => import('../pages/production/DowntimeSubCategoryList'));
const DowntimeBreakdown = React.lazy(() => import('../pages/production/DowntimeBreakdown'));
const UserList = React.lazy(() => import('../pages/users/UserList'));
const UserForm = React.lazy(() => import('../pages/users/UserForm'));
const ProductList = React.lazy(() => import('../pages/inventory/ProductList'));
const ProductForm = React.lazy(() => import('../pages/inventory/ProductForm'));

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
                            <Route path="production" element={<PostProduction />} />
                            {/* Placeholders for now */}
                            <Route path="warehouse" element={<div className="p-8 text-center text-slate-500">Warehouse Scanning Module Coming Soon</div>} />
                            <Route path="loading" element={<div className="p-8 text-center text-slate-500">Loading Module Coming Soon</div>} />
                        </Route>

                        <Route path="/dashboard" element={
                            <ProtectedRoute>
                                <DashboardLayout />
                            </ProtectedRoute>
                        }>
                            <Route index element={<DashboardOverview />} />
                            <Route path="formulas" element={<Formulas />} />

                            {/* Production Routes */}
                            <Route path="production">
                                <Route index element={<ProductionList />} />
                                <Route path="new" element={<ReportForm />} />
                                <Route path=":id" element={<ReportDetails />} />
                                <Route path=":id/edit" element={<ReportForm />} />

                                {/* Stoppage Logs */}
                                <Route path="stoppages" element={<StoppageLogList />} />
                                <Route path="stoppages/new" element={<StoppageLogForm />} />
                                <Route path="stoppages/:id" element={<StoppageLogDetails />} />
                                <Route path="stoppages/:id/edit" element={<StoppageLogForm />} />

                                <Route
                                    path="incident-categories"
                                    element={
                                        <GenericCrudPage
                                            title="Incident Categories"
                                            api={{
                                                list: productionApi.getIncidentCategories,
                                                create: productionApi.createIncidentCategory,
                                                update: productionApi.updateIncidentCategory,
                                                delete: productionApi.deleteIncidentCategory
                                            }}
                                            columns={[
                                                { header: 'ID', accessor: 'id' },
                                                { header: 'Category Name', accessor: 'category_name' },
                                            ]}
                                            formFields={[
                                                { name: 'category_name', label: 'Category Name', required: true }
                                            ]}
                                        />
                                    }
                                />


                                <Route
                                    path="downtime-categories"
                                    element={
                                        <GenericCrudPage
                                            title="Downtime Categories"
                                            api={{
                                                list: productionApi.getDowntimeCategories,
                                                create: productionApi.createDowntimeCategory,
                                                update: productionApi.updateDowntimeCategory,
                                                delete: productionApi.deleteDowntimeCategory
                                            }}
                                            columns={[
                                                { header: 'ID', accessor: 'id' },
                                                { header: 'Name', accessor: 'name' },
                                                { header: 'Description', accessor: 'description' },
                                            ]}
                                            formFields={[
                                                { name: 'name', label: 'Category Name', required: true },
                                                { name: 'description', label: 'Description', required: false }
                                            ]}
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
                                    <Route
                                        path="ranges"
                                        element={
                                            <GenericCrudPage
                                                title="Production Ranges"
                                                api={{
                                                    list: productionApi.getProductionRanges,
                                                    create: productionApi.createProductionRange,
                                                    update: productionApi.updateProductionRange,
                                                    delete: productionApi.deleteProductionRange
                                                }}
                                                columns={[
                                                    { header: 'ID', accessor: 'id' },
                                                    { header: 'Name', accessor: 'name' },
                                                    { header: 'Start', accessor: 'start_value' },
                                                    { header: 'End', accessor: 'end_value' },
                                                ]}
                                                formFields={[
                                                    { name: 'name', label: 'Range Name', required: true },
                                                    { name: 'start_value', label: 'Start Value', type: 'number', step: '0.01', required: true },
                                                    { name: 'end_value', label: 'End Value', type: 'number', step: '0.01', required: true },
                                                ]}
                                            />
                                        }
                                    />
                                    <Route
                                        path="units"
                                        element={
                                            <GenericCrudPage
                                                title="Measuring Units"
                                                api={{
                                                    list: productionApi.getMeasuringUnits,
                                                    create: productionApi.createMeasuringUnit,
                                                    update: productionApi.updateMeasuringUnit,
                                                    delete: productionApi.deleteMeasuringUnit
                                                }}
                                                columns={[
                                                    { header: 'ID', accessor: 'id' },
                                                    { header: 'Name', accessor: 'name' },
                                                    { header: 'Short Name', accessor: 'short_name' },
                                                    { header: 'Value', accessor: 'value' },
                                                ]}
                                                formFields={[
                                                    { name: 'name', label: 'Unit Name', required: true },
                                                    { name: 'short_name', label: 'Short Name', required: true },
                                                    { name: 'value', label: 'Value', type: 'number', step: '0.001', required: true },
                                                ]}
                                            />
                                        }
                                    />
                                    <Route
                                        path="co2"
                                        element={
                                            <GenericCrudPage
                                                title="Standard CO2 Levels"
                                                api={{
                                                    list: productionApi.getStandardCO2s,
                                                    create: productionApi.createStandardCO2,
                                                    update: productionApi.updateStandardCO2,
                                                    delete: productionApi.deleteStandardCO2
                                                }}
                                                columns={[
                                                    { header: 'ID', accessor: 'id' },
                                                    { header: 'Name', accessor: 'name' },
                                                    { header: 'Value', accessor: 'value' },
                                                ]}
                                                formFields={[
                                                    { name: 'name', label: 'Name', required: true },
                                                    { name: 'value', label: 'Value', type: 'number', step: '0.01', required: true },
                                                ]}
                                            />
                                        }
                                    />
                                    <Route
                                        path="densities"
                                        element={
                                            <GenericCrudPage
                                                title="Syrup Densities"
                                                api={{
                                                    list: productionApi.getSyrupDensities,
                                                    create: productionApi.createSyrupDensity,
                                                    update: productionApi.updateSyrupDensity,
                                                    delete: productionApi.deleteSyrupDensity
                                                }}
                                                columns={[
                                                    { header: 'ID', accessor: 'id' },
                                                    { header: 'Name', accessor: 'name' },
                                                    { header: 'Value', accessor: 'value' },
                                                    { header: 'Unit', accessor: 'unit' },
                                                ]}
                                                formFields={[
                                                    { name: 'name', label: 'Name', required: true },
                                                    { name: 'value', label: 'Density Value', type: 'number', step: '0.001', required: true },
                                                    { name: 'unit', label: 'Unit', required: true },
                                                ]}
                                            />
                                        }
                                    />
                                    <Route
                                        path="ratios"
                                        element={
                                            <GenericCrudPage
                                                title="Syrup Dilution Ratios"
                                                api={{
                                                    list: productionApi.getSyrupDilutionRatios,
                                                    create: productionApi.createSyrupDilutionRatio,
                                                    update: productionApi.updateSyrupDilutionRatio,
                                                    delete: productionApi.deleteSyrupDilutionRatio
                                                }}
                                                columns={[
                                                    { header: 'ID', accessor: 'id' },
                                                    { header: 'Name', accessor: 'name' },
                                                    { header: 'Value', accessor: 'value' },
                                                    { header: 'Unit', accessor: 'unit' },
                                                ]}
                                                formFields={[
                                                    { name: 'name', label: 'Name', required: true },
                                                    { name: 'value', label: 'Ratio Value', type: 'number', step: '0.01', required: true },
                                                    { name: 'unit', label: 'Unit', required: true },
                                                ]}
                                            />
                                        }
                                    />
                                    <Route
                                        path="concentrations"
                                        element={
                                            <GenericCrudPage
                                                title="Syrup Concentrations"
                                                api={{
                                                    list: productionApi.getSyrupConcentrations,
                                                    create: productionApi.createSyrupConcentration,
                                                    update: productionApi.updateSyrupConcentration,
                                                    delete: productionApi.deleteSyrupConcentration
                                                }}
                                                columns={[
                                                    { header: 'ID', accessor: 'id' },
                                                    { header: 'Name', accessor: 'name' },
                                                    { header: 'Value', accessor: 'value' },
                                                    { header: 'Unit', accessor: 'unit' },
                                                ]}
                                                formFields={[
                                                    { name: 'name', label: 'Name', required: true },
                                                    { name: 'value', label: 'Concentration Value', type: 'number', step: '0.01', required: true },
                                                    { name: 'unit', label: 'Unit', required: true },
                                                ]}
                                            />
                                        }
                                    />
                                    <Route
                                        path="bottles-per-pack"
                                        element={
                                            <GenericCrudPage
                                                title="Bottles Per Pack"
                                                api={{
                                                    list: productionApi.getBottlesPerPack,
                                                    create: productionApi.createBottlesPerPack,
                                                    update: productionApi.updateBottlesPerPack,
                                                    delete: productionApi.deleteBottlesPerPack
                                                }}
                                                columns={[
                                                    { header: 'ID', accessor: 'id' },
                                                    { header: 'Size', accessor: 'size' },
                                                    { header: 'Quantity', accessor: 'quantity' },
                                                    { header: 'Name', accessor: 'name' },
                                                ]}
                                                formFields={[
                                                    { name: 'size', label: 'Size', type: 'number', step: '0.01', required: true },
                                                    { name: 'quantity', label: 'Quantity', type: 'number', required: true },
                                                ]}
                                            />
                                        }
                                    />
                                    <Route
                                        path="line-speeds"
                                        element={
                                            <GenericCrudPage
                                                title="Line Speeds"
                                                api={{
                                                    list: productionApi.getLineSpeeds,
                                                    create: productionApi.createLineSpeed,
                                                    update: productionApi.updateLineSpeed,
                                                    delete: productionApi.deleteLineSpeed
                                                }}
                                                columns={[
                                                    { header: 'ID', accessor: 'id' },
                                                    { header: 'Name', accessor: 'name' },
                                                    { header: 'Speed', accessor: 'speed' },
                                                ]}
                                                formFields={[
                                                    { name: 'name', label: 'Name', required: true },
                                                    { name: 'speed', label: 'Speed', type: 'number', step: '0.01', required: true },
                                                ]}
                                            />
                                        }
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
                                <Route
                                    path="suppliers"
                                    element={
                                        <GenericCrudPage
                                            title="Suppliers"
                                            api={{
                                                list: productionApi.getSuppliers,
                                                create: productionApi.createSupplier,
                                                update: productionApi.updateSupplier,
                                                delete: productionApi.deleteSupplier
                                            }}
                                            columns={[
                                                { header: 'ID', accessor: 'id' },
                                                { header: 'Name', accessor: 'name' },
                                                { header: 'Created', accessor: 'date_created', render: (r) => r.date_created?.split('T')[0] }
                                            ]}
                                            formFields={[
                                                { name: 'name', label: 'Supplier Name', required: true }
                                            ]}
                                        />
                                    }
                                />
                                <Route
                                    path="preform-colors"
                                    element={
                                        <GenericCrudPage
                                            title="Preform Colors"
                                            api={{
                                                list: productionApi.getPreformColors,
                                                create: productionApi.createPreformColor,
                                                update: productionApi.updatePreformColor,
                                                delete: productionApi.deletePreformColor
                                            }}
                                            columns={[
                                                { header: 'ID', accessor: 'id' },
                                                { header: 'Color Name', accessor: 'name' },
                                            ]}
                                            formFields={[
                                                { name: 'name', label: 'Color Name', required: true }
                                            ]}
                                        />
                                    }
                                />
                                <Route
                                    path="cap-types"
                                    element={
                                        <GenericCrudPage
                                            title="Cap Types"
                                            api={{
                                                list: productionApi.getCapTypes,
                                                create: productionApi.createCapType,
                                                update: productionApi.updateCapType,
                                                delete: productionApi.deleteCapType
                                            }}
                                            columns={[
                                                { header: 'ID', accessor: 'id' },
                                                { header: 'Cap Type', accessor: 'name' },
                                            ]}
                                            formFields={[
                                                { name: 'name', label: 'Cap Type Name', required: true }
                                            ]}
                                        />
                                    }
                                />
                                <Route
                                    path="cap-colors"
                                    element={
                                        <GenericCrudPage
                                            title="Cap Colors"
                                            api={{
                                                list: productionApi.getCapColors,
                                                create: productionApi.createCapColor,
                                                update: productionApi.updateCapColor,
                                                delete: productionApi.deleteCapColor
                                            }}
                                            columns={[
                                                { header: 'ID', accessor: 'id' },
                                                { header: 'Color Name', accessor: 'name' },
                                            ]}
                                            formFields={[
                                                { name: 'name', label: 'Color Name', required: true }
                                            ]}
                                        />
                                    }
                                />
                                <Route
                                    path="label-product-sizes"
                                    element={
                                        <GenericCrudPage
                                            title="Label Product Sizes"
                                            api={{
                                                list: productionApi.getLabelProductSizes,
                                                create: productionApi.createLabelProductSize,
                                                update: productionApi.updateLabelProductSize,
                                                delete: productionApi.deleteLabelProductSize
                                            }}
                                            columns={[
                                                { header: 'ID', accessor: 'id' },
                                                { header: 'Size', accessor: 'name' },
                                            ]}
                                            formFields={[
                                                { name: 'name', label: 'Product Size Name', required: true }
                                            ]}
                                        />
                                    }
                                />
                                <Route
                                    path="label-names"
                                    element={
                                        <GenericCrudPage
                                            title="Label Names"
                                            api={{
                                                list: productionApi.getLabelNames,
                                                create: productionApi.createLabelName,
                                                update: productionApi.updateLabelName,
                                                delete: productionApi.deleteLabelName
                                            }}
                                            columns={[
                                                { header: 'ID', accessor: 'id' },
                                                { header: 'Label Name', accessor: 'name' },
                                            ]}
                                            formFields={[
                                                { name: 'name', label: 'Label Name', required: true }
                                            ]}
                                        />
                                    }
                                />
                                <Route
                                    path="shrink-product-sizes"
                                    element={
                                        <GenericCrudPage
                                            title="Shrink Product Sizes"
                                            api={{
                                                list: productionApi.getShrinkProductSizes,
                                                create: productionApi.createShrinkProductSize,
                                                update: productionApi.updateShrinkProductSize,
                                                delete: productionApi.deleteShrinkProductSize
                                            }}
                                            columns={[
                                                { header: 'ID', accessor: 'id' },
                                                { header: 'Size', accessor: 'name' },
                                            ]}
                                            formFields={[
                                                { name: 'name', label: 'Product Size Name', required: true }
                                            ]}
                                        />
                                    }
                                />
                                <Route
                                    path="pack-sizes"
                                    element={
                                        <GenericCrudPage
                                            title="Pack Sizes"
                                            api={{
                                                list: productionApi.getPackSizes,
                                                create: productionApi.createPackSize,
                                                update: productionApi.updatePackSize,
                                                delete: productionApi.deletePackSize
                                            }}
                                            columns={[
                                                { header: 'ID', accessor: 'id' },
                                                { header: 'Pack Size', accessor: 'name' },
                                            ]}
                                            formFields={[
                                                { name: 'name', label: 'Pack Size Name', required: true }
                                            ]}
                                        />
                                    }
                                />
                                <Route
                                    path="shrink-names"
                                    element={
                                        <GenericCrudPage
                                            title="Shrink Names"
                                            api={{
                                                list: productionApi.getShrinkNames,
                                                create: productionApi.createShrinkName,
                                                update: productionApi.updateShrinkName,
                                                delete: productionApi.deleteShrinkName
                                            }}
                                            columns={[
                                                { header: 'ID', accessor: 'id' },
                                                { header: 'Shrink Name', accessor: 'name' },
                                            ]}
                                            formFields={[
                                                { name: 'name', label: 'Shrink Name', required: true }
                                            ]}
                                        />
                                    }
                                />
                                <Route
                                    path="preform-sizes"
                                    element={
                                        <GenericCrudPage
                                            title="Preform Sizes (Grams)"
                                            api={{
                                                list: productionApi.getPreformSizes,
                                                create: productionApi.createPreformSize,
                                                update: productionApi.updatePreformSize,
                                                delete: productionApi.deletePreformSize
                                            }}
                                            columns={[
                                                { header: 'ID', accessor: 'id' },
                                                { header: 'Value (g)', accessor: 'value_gr' },
                                            ]}
                                            formFields={[
                                                { name: 'value_gr', label: 'Weight (grams)', required: true }
                                            ]}
                                        />
                                    }
                                />
                                <Route
                                    path="cage-quantities"
                                    element={
                                        <GenericCrudPage
                                            title="Cage Quantities"
                                            api={{
                                                list: productionApi.getCageQuantities,
                                                create: productionApi.createCageQuantity,
                                                update: productionApi.updateCageQuantity,
                                                delete: productionApi.deleteCageQuantity
                                            }}
                                            columns={[
                                                { header: 'ID', accessor: 'id' },
                                                { header: 'Quantity (pcs)', accessor: 'value_pcs' },
                                            ]}
                                            formFields={[
                                                { name: 'value_pcs', label: 'Value (Pieces)', type: 'number', required: true }
                                            ]}
                                        />
                                    }
                                />
                                <Route
                                    path="cap-box-quantities"
                                    element={
                                        <GenericCrudPage
                                            title="Cap Box Quantities"
                                            api={{
                                                list: productionApi.getCapBoxQuantities,
                                                create: productionApi.createCapBoxQuantity,
                                                update: productionApi.updateCapBoxQuantity,
                                                delete: productionApi.deleteCapBoxQuantity
                                            }}
                                            columns={[
                                                { header: 'ID', accessor: 'id' },
                                                { header: 'Quantity (pcs)', accessor: 'value_pcs' },
                                            ]}
                                            formFields={[
                                                { name: 'value_pcs', label: 'Value (Pieces)', type: 'number', required: true }
                                            ]}
                                        />
                                    }
                                />
                            </Route>
                        </Route>

                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                </React.Suspense>
            </AuthProvider>
        </BrowserRouter>
    );
};
