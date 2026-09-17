import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { canAccessPath, firstAccessiblePath, getPrivilegeForPath } from '../../config/pagePrivileges';

const PageAccessBoundary = ({ children }) => {
    const { user } = useAuth();
    const location = useLocation();
    const privilege = getPrivilegeForPath(location.pathname);

    if (!privilege || canAccessPath(user, location.pathname)) return children;

    const returnPath = firstAccessiblePath(user, privilege.mode);

    return (
        <div className="container-fluid py-5">
            <div className="card border-0 shadow-sm mx-auto" style={{ maxWidth: 620 }}>
                <div className="card-body text-center p-5">
                    <span className="d-inline-flex align-items-center justify-content-center rounded-circle bg-danger-subtle text-danger mb-3" style={{ width: 64, height: 64 }}>
                        <i className="ti ti-lock-access fs-2" aria-hidden="true"></i>
                    </span>
                    <h3>Page access restricted</h3>
                    <p className="text-muted mb-4">
                        Your account does not have the <strong>{privilege.label}</strong> privilege.
                        Contact an administrator if you need access.
                    </p>
                    <Link className="btn btn-primary" to={returnPath}>Go to an available page</Link>
                </div>
            </div>
        </div>
    );
};

export default PageAccessBoundary;
