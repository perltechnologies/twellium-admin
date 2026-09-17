import {
    canAccessMode,
    canAccessPath,
    canAccessPrivilege,
    getPagePrivileges,
    hasExplicitPagePrivileges,
    isAdministrator,
    firstAccessiblePath,
} from './pagePrivileges';

describe('page privilege authorization', () => {
    test('administrators can access admin pages', () => {
        const user = { role: 'ADMIN', page_privileges: [] };
        expect(isAdministrator(user)).toBe(true);
        expect(canAccessPath(user, '/dashboard/users')).toBe(true);
    });

    test('explicit page privileges deny unassigned navigation and direct routes', () => {
        const user = { role: 'OPERATOR', page_privileges: ['pre.overview'] };
        expect(canAccessPath(user, '/dashboard')).toBe(true);
        expect(canAccessPath(user, '/dashboard/analytics/co2-analytics')).toBe(false);
        expect(canAccessPath(user, '/dashboard/users')).toBe(false);
        expect(canAccessMode(user, 'post-production')).toBe(false);
    });

    test('an explicit empty list means no page access', () => {
        const user = { role: 'VIEWER', page_privileges: [] };
        expect(hasExplicitPagePrivileges(user)).toBe(true);
        expect(getPagePrivileges(user)).toEqual([]);
        expect(canAccessPrivilege(user, 'pre.overview')).toBe(false);
    });

    test('legacy production access flag remains supported before privileges are assigned', () => {
        const permitted = { role: 'OPERATOR', can_access_production: true };
        const denied = { role: 'OPERATOR', can_access_production: false };
        expect(canAccessPath(permitted, '/dashboard/production')).toBe(true);
        expect(canAccessPath(denied, '/dashboard/production')).toBe(false);
    });

    test('supported API aliases are normalized', () => {
        const user = { role: 'VIEWER', allowed_pages: [{ key: 'pre.analytics.co2' }] };
        expect(getPagePrivileges(user)).toEqual(['pre.analytics.co2']);
        expect(canAccessPath(user, '/dashboard/analytics/co2-analytics')).toBe(true);
    });

    test('the fallback link resolves to a usable route', () => {
        const user = { role: 'VIEWER', page_privileges: ['pre.analytics.co2'] };
        expect(firstAccessiblePath(user, 'pre-production')).toBe('/dashboard/analytics/co2-analytics');
    });
});
