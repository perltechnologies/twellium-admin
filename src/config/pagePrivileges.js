const exact = (path) => new RegExp(`^${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?$`);

export const PAGE_PRIVILEGES = [
    { key: 'pre.overview', label: 'Overview', section: 'Pre Production Main', mode: 'pre-production', paths: [exact('/dashboard'), exact('/dashboard/production/overview')] },
    { key: 'pre.formulas', label: 'Formulas', section: 'Pre Production Main', mode: 'pre-production', paths: [exact('/dashboard/formulas')] },
    { key: 'pre.production.reports', label: 'Production Reports', section: 'Pre Production', mode: 'pre-production', paths: [/^\/dashboard\/production(?:\/(?:reports|new|metrics|\d+(?:\/edit)?))?\/?$/] },
    { key: 'pre.production.stoppages', label: 'Stoppage Logs', section: 'Pre Production', mode: 'pre-production', paths: [/^\/dashboard\/production\/stoppages(?:-table|\/.*)?\/?$/, exact('/dashboard/production/downtime-breakdown')] },
    { key: 'pre.production.incident-categories', label: 'Incident Categories', section: 'Pre Production', mode: 'pre-production', paths: [exact('/dashboard/production/incident-categories')] },
    { key: 'pre.production.downtime-categories', label: 'Downtime Categories', section: 'Pre Production', mode: 'pre-production', paths: [exact('/dashboard/production/downtime-categories')] },
    { key: 'pre.production.downtime-sub-categories', label: 'Downtime Sub Categories', section: 'Pre Production', mode: 'pre-production', paths: [exact('/dashboard/production/downtime-sub-categories')] },
    { key: 'pre.production.meters', label: 'Meter Readings', section: 'Pre Production', mode: 'pre-production', paths: [exact('/dashboard/production/meters')] },
    { key: 'pre.production.pets', label: 'PET Lines', section: 'Pre Production', mode: 'pre-production', paths: [exact('/dashboard/production/pets')] },
    { key: 'pre.production.shifts', label: 'Shifts', section: 'Pre Production', mode: 'pre-production', paths: [exact('/dashboard/production/shifts')] },
    { key: 'pre.production.materials', label: 'Materials', section: 'Pre Production', mode: 'pre-production', paths: [exact('/dashboard/production/materials')] },
    { key: 'pre.production.batches', label: 'Batches', section: 'Pre Production', mode: 'pre-production', paths: [exact('/dashboard/production/batches')] },
    { key: 'pre.production.workers', label: 'Workers', section: 'Pre Production', mode: 'pre-production', paths: [exact('/dashboard/production/workers')] },
    { key: 'pre.reports.production', label: 'Production Report Summary', section: 'Pre Production Analytics', mode: 'pre-production', paths: [exact('/dashboard/reports/production')] },
    { key: 'pre.analytics.oee', label: 'OEE Analytics', section: 'Pre Production Analytics', mode: 'pre-production', paths: [exact('/dashboard/analytics/oee-analytics')] },
    { key: 'pre.analytics.production', label: 'Production Analytics', section: 'Pre Production Analytics', mode: 'pre-production', paths: [exact('/dashboard/analytics/production-analytics')] },
    { key: 'pre.analytics.material', label: 'Material Analytics', section: 'Pre Production Analytics', mode: 'pre-production', paths: [exact('/dashboard/analytics/material-analytics')] },
    { key: 'pre.analytics.syrup', label: 'Syrup Analytics', section: 'Pre Production Analytics', mode: 'pre-production', paths: [exact('/dashboard/analytics/syrup-analytics')] },
    { key: 'pre.analytics.co2', label: 'CO2 Analytics', section: 'Pre Production Analytics', mode: 'pre-production', paths: [exact('/dashboard/analytics/co2-analytics')] },
    { key: 'pre.analytics.consumption', label: 'Consumption Analytics', section: 'Pre Production Analytics', mode: 'pre-production', paths: [exact('/dashboard/analytics/consumption-analytics')] },
    { key: 'pre.config.ranges', label: 'Production Ranges', section: 'Pre Production Configuration', mode: 'pre-production', paths: [exact('/dashboard/production/configs/ranges')] },
    { key: 'pre.config.units', label: 'Measuring Units', section: 'Pre Production Configuration', mode: 'pre-production', paths: [exact('/dashboard/production/configs/units')] },
    { key: 'pre.config.co2', label: 'Standard CO2', section: 'Pre Production Configuration', mode: 'pre-production', paths: [exact('/dashboard/production/configs/co2')] },
    { key: 'pre.config.densities', label: 'Syrup Densities', section: 'Pre Production Configuration', mode: 'pre-production', paths: [exact('/dashboard/production/configs/densities')] },
    { key: 'pre.config.ratios', label: 'Dilution Ratios', section: 'Pre Production Configuration', mode: 'pre-production', paths: [exact('/dashboard/production/configs/ratios')] },
    { key: 'pre.config.concentrations', label: 'Syrup Concentrations', section: 'Pre Production Configuration', mode: 'pre-production', paths: [exact('/dashboard/production/configs/concentrations')] },
    { key: 'pre.config.bottles-per-pack', label: 'Bottles Per Pack', section: 'Pre Production Configuration', mode: 'pre-production', paths: [exact('/dashboard/production/configs/bottles-per-pack')] },
    { key: 'pre.config.line-speeds', label: 'Line Speeds', section: 'Pre Production Configuration', mode: 'pre-production', paths: [exact('/dashboard/production/configs/line-speeds')] },
    { key: 'pre.inventory.products', label: 'Products', section: 'Pre Production Inventory', mode: 'pre-production', paths: [/^\/dashboard\/inventory\/products(?:\/new|\/\d+\/edit)?\/?$/] },
    { key: 'pre.signoff.production', label: 'Production Sign Off', section: 'Pre Production Sign Off', mode: 'pre-production', paths: [exact('/dashboard/sign-off-forms/production-report')] },
    { key: 'pre.signoff.product', label: 'Product Sign Off', section: 'Pre Production Sign Off', mode: 'pre-production', paths: [exact('/dashboard/sign-off-forms/product-report')] },
    { key: 'pre.signoff.batch', label: 'Batch Sign Off', section: 'Pre Production Sign Off', mode: 'pre-production', paths: [exact('/dashboard/sign-off-forms/batch-report')] },
    { key: 'pre.signoff-v2.production', label: 'Production Sign Off V2', section: 'Pre Production Sign Off V2', mode: 'pre-production', paths: [exact('/dashboard/sign-off-forms-v2/production-report')] },
    { key: 'pre.signoff-v2.product', label: 'Product Sign Off V2', section: 'Pre Production Sign Off V2', mode: 'pre-production', paths: [exact('/dashboard/sign-off-forms-v2/product-report')] },
    { key: 'pre.signoff-v2.batch', label: 'Batch Sign Off V2', section: 'Pre Production Sign Off V2', mode: 'pre-production', paths: [exact('/dashboard/sign-off-forms-v2/batch-report')] },
    { key: 'pre.definitions.suppliers', label: 'Suppliers', section: 'Pre Production Material Lookups', mode: 'pre-production', paths: [exact('/dashboard/definitions/suppliers')] },
    { key: 'pre.definitions.preform-colors', label: 'Preform Colors', section: 'Pre Production Material Lookups', mode: 'pre-production', paths: [exact('/dashboard/definitions/preform-colors')] },
    { key: 'pre.definitions.cap-types', label: 'Cap Types', section: 'Pre Production Material Lookups', mode: 'pre-production', paths: [exact('/dashboard/definitions/cap-types')] },
    { key: 'pre.definitions.cap-colors', label: 'Cap Colors', section: 'Pre Production Material Lookups', mode: 'pre-production', paths: [exact('/dashboard/definitions/cap-colors')] },
    { key: 'pre.definitions.label-sizes', label: 'Label Sizes', section: 'Pre Production Material Lookups', mode: 'pre-production', paths: [exact('/dashboard/definitions/label-product-sizes')] },
    { key: 'pre.definitions.label-names', label: 'Label Names', section: 'Pre Production Material Lookups', mode: 'pre-production', paths: [exact('/dashboard/definitions/label-names')] },
    { key: 'pre.definitions.shrink-sizes', label: 'Shrink Sizes', section: 'Pre Production Material Lookups', mode: 'pre-production', paths: [exact('/dashboard/definitions/shrink-product-sizes')] },
    { key: 'pre.definitions.pack-sizes', label: 'Pack Sizes', section: 'Pre Production Material Lookups', mode: 'pre-production', paths: [exact('/dashboard/definitions/pack-sizes')] },
    { key: 'pre.definitions.shrink-names', label: 'Shrink Names', section: 'Pre Production Material Lookups', mode: 'pre-production', paths: [exact('/dashboard/definitions/shrink-names')] },
    { key: 'pre.definitions.preform-sizes', label: 'Preform Sizes', section: 'Pre Production Material Lookups', mode: 'pre-production', paths: [exact('/dashboard/definitions/preform-sizes')] },
    { key: 'pre.definitions.cage-quantities', label: 'Cage Quantities', section: 'Pre Production Material Lookups', mode: 'pre-production', paths: [exact('/dashboard/definitions/cage-quantities')] },
    { key: 'pre.definitions.cap-box-quantities', label: 'Cap Box Quantities', section: 'Pre Production Material Lookups', mode: 'pre-production', paths: [exact('/dashboard/definitions/cap-box-quantities')] },
    { key: 'admin.users', label: 'Manage Users and Privileges', section: 'Administration', mode: 'pre-production', adminOnly: true, paths: [/^\/dashboard\/users(?:\/new|\/\d+\/edit)?\/?$/] },

    { key: 'post.dashboard', label: 'Dashboard', section: 'Post Production Main', mode: 'post-production', paths: [exact('/post-production')] },
    { key: 'post.plant-overview', label: 'Plant Overview', section: 'Post Production Main', mode: 'post-production', paths: [exact('/post-production/analytics/plant-overview')] },
    { key: 'post.inventory-overview', label: 'Inventory Overview', section: 'Post Production Main', mode: 'post-production', paths: [exact('/post-production/overview')] },
    { key: 'post.production-mode', label: 'Production Mode', section: 'Post Production', mode: 'post-production', paths: [exact('/post-production/production')] },
    { key: 'post.bulk-barcodes', label: 'Bulk Barcodes', section: 'Post Production', mode: 'post-production', paths: [exact('/post-production/analytics/bulk-barcodes'), exact('/post-production/batch-print-transfer')] },
    { key: 'post.production-transfer', label: 'Production Transfer', section: 'Post Production', mode: 'post-production', paths: [exact('/post-production/transfer-execution')] },
    { key: 'post.staging-warehouse', label: 'Staging Warehouse', section: 'Post Production', mode: 'post-production', paths: [exact('/post-production/staging-warehouse')] },
    { key: 'post.warehouse-flow', label: 'Warehouse Flow', section: 'Post Production', mode: 'post-production', paths: [exact('/post-production/warehouse'), /^\/post-production\/pallets(?:\/.*)?$/] },
    { key: 'post.batch-traceability', label: 'Batch Traceability', section: 'Post Production Analytics', mode: 'post-production', paths: [exact('/post-production/analytics/batch-traceability')] },
    { key: 'post.product-analysis', label: 'Product Analysis', section: 'Post Production Analytics', mode: 'post-production', paths: [exact('/post-production/analytics/product-analysis')] },
    { key: 'post.pet-performance', label: 'PET Performance', section: 'Post Production Analytics', mode: 'post-production', paths: [exact('/post-production/analytics/pet-performance')] },
    { key: 'post.trends', label: 'Trend Analysis', section: 'Post Production Analytics', mode: 'post-production', paths: [exact('/post-production/analytics/trends')] },
    { key: 'post.live-dashboard', label: 'Live Dashboard', section: 'Post Production Analytics', mode: 'post-production', paths: [exact('/post-production/analytics/live-dashboard')] },
    { key: 'post.dispatch', label: 'Loading and Dispatch', section: 'Post Production Logistics', mode: 'post-production', paths: [exact('/post-production/logistics/dispatch')] },
    { key: 'post.vehicle-dispatch', label: 'Vehicle Dispatch', section: 'Post Production Logistics', mode: 'post-production', paths: [exact('/post-production/analytics/vehicle-dispatch')] },
    { key: 'post.vehicles', label: 'Vehicles', section: 'Post Production Logistics', mode: 'post-production', paths: [exact('/post-production/logistics/vehicles')] },
    { key: 'post.drivers', label: 'Drivers', section: 'Post Production Logistics', mode: 'post-production', paths: [exact('/post-production/logistics/drivers')] },
    { key: 'post.activity-logs', label: 'Activity Logs', section: 'Post Production Tools', mode: 'post-production', paths: [/^\/post-production\/activity-logs(?:\/\d+)?\/?$/] },
    { key: 'post.reprint', label: 'Reprint Labels', section: 'Post Production Tools', mode: 'post-production', paths: [exact('/post-production/reprint')] },
    { key: 'post.batch-scan', label: 'Batch Scan', section: 'Post Production Tools', mode: 'post-production', paths: [exact('/post-production/batch-scan')] },
    { key: 'post.lookup', label: 'Unit Lookup', section: 'Post Production Tools', mode: 'post-production', paths: [exact('/post-production/lookup'), exact('/post-production/find-barcode'), exact('/post-production/find-rfid')] },
    { key: 'post.manage-stages', label: 'Manage Stages', section: 'Post Production Tools', mode: 'post-production', paths: [exact('/post-production/manage-stages')] },
];

export const PAGE_PRIVILEGE_FIELD = 'page_privileges';
const PAGE_PRIVILEGE_FIELD_NAMES = [PAGE_PRIVILEGE_FIELD, 'allowed_pages', 'page_permissions'];

export const isAdministrator = (user) => Boolean(
    user && (user.role === 'ADMIN' || user.is_superuser === true)
);

const extractToken = (value) => {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return null;
    return value.key || value.code || value.slug || value.permission || null;
};

export const getPagePrivileges = (user) => {
    if (!user) return [];

    for (const field of PAGE_PRIVILEGE_FIELD_NAMES) {
        if (Array.isArray(user[field])) return user[field].map(extractToken).filter(Boolean);
    }

    if (Array.isArray(user.permissions?.pages)) {
        return user.permissions.pages.map(extractToken).filter(Boolean);
    }

    return [];
};

export const hasExplicitPagePrivileges = (user) => Boolean(user) && (
    PAGE_PRIVILEGE_FIELD_NAMES.some((field) => Array.isArray(user[field])) ||
    Array.isArray(user.permissions?.pages)
);

export const getPrivilegeForPath = (pathname) => PAGE_PRIVILEGES.find((privilege) =>
    privilege.paths.some((pattern) => pattern.test(pathname))
);

export const canAccessPrivilege = (user, privilegeKey) => {
    if (!user) return false;
    if (isAdministrator(user)) return true;

    const privilege = PAGE_PRIVILEGES.find((item) => item.key === privilegeKey);
    if (!privilege || privilege.adminOnly) return false;

    if (hasExplicitPagePrivileges(user)) {
        return getPagePrivileges(user).includes(privilegeKey);
    }

    // Compatibility for accounts created before page privileges existed.
    // The backend's current coarse production flag remains authoritative until
    // an administrator saves an explicit page list for the account.
    if (privilege.mode === 'pre-production' && user.can_access_production === false) {
        return false;
    }
    return true;
};

export const canAccessPath = (user, pathname) => {
    const privilege = getPrivilegeForPath(pathname);
    return privilege ? canAccessPrivilege(user, privilege.key) : true;
};

export const canAccessMode = (user, mode) => PAGE_PRIVILEGES.some(
    (privilege) => privilege.mode === mode && canAccessPrivilege(user, privilege.key)
);

export const firstAccessiblePath = (user, mode) => {
    const privilege = PAGE_PRIVILEGES.find(
        (item) => (!mode || item.mode === mode) && canAccessPrivilege(user, item.key)
    );
    if (!privilege) return '/mode-selection';

    const source = privilege.paths[0].source;
    const simplePath = source
        .replace(/^\^/, '')
        .replace(/\$$/, '')
        .replace(/\\\//g, '/')
        .replace(/\\-/g, '-')
        .replace(/\(.*$/, '')
        .replace(/\/\?$/, '');
    return simplePath || '/mode-selection';
};

export const groupPagePrivileges = () => PAGE_PRIVILEGES.reduce((groups, privilege) => {
    if (privilege.adminOnly) return groups;
    if (!groups[privilege.section]) groups[privilege.section] = [];
    groups[privilege.section].push(privilege);
    return groups;
}, {});
