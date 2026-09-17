import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PageAccessBoundary from './PageAccessBoundary';

let mockCurrentUser;

jest.mock('../../context/AuthContext', () => ({
    useAuth: () => ({ user: mockCurrentUser }),
}));

const renderAt = (path) => render(
    <MemoryRouter initialEntries={[path]}>
        <PageAccessBoundary>
            <div>Restricted page contents</div>
        </PageAccessBoundary>
    </MemoryRouter>
);

describe('PageAccessBoundary', () => {
    test('does not render a restricted route for a non-admin user', () => {
        mockCurrentUser = { role: 'OPERATOR', page_privileges: ['pre.overview'] };
        renderAt('/dashboard/users');
        expect(screen.getByText('Page access restricted')).toBeInTheDocument();
        expect(screen.queryByText('Restricted page contents')).not.toBeInTheDocument();
    });

    test('renders an assigned page', () => {
        mockCurrentUser = { role: 'VIEWER', page_privileges: ['pre.analytics.co2'] };
        renderAt('/dashboard/analytics/co2-analytics');
        expect(screen.getByText('Restricted page contents')).toBeInTheDocument();
    });
});
