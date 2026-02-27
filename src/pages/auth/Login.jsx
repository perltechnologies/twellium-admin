import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [mounted, setMounted] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        document.body.classList.add('account-page', 'bg-white');
        setMounted(true);
        return () => {
            document.body.classList.remove('account-page', 'bg-white');
        };
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        const result = await login(username, password);

        if (result.success) {
            navigate('/mode-selection');
        } else {
            setError(result.message || 'Invalid credentials');
        }
        setIsLoading(false);
    };

    return (
        <div className="main-wrapper">
            <div className="overflow-hidden p-3 acc-vh">
                <div className="row vh-100 w-100 g-0">

                    {/* Left: Login Form */}
                    <div className="col-lg-6 vh-100 overflow-y-auto overflow-x-hidden">
                        <div className="row">
                            <div className="col-md-10 mx-auto">
                                <form
                                    onSubmit={handleSubmit}
                                    className="vh-100 d-flex justify-content-between flex-column p-4 pb-0"
                                    style={{
                                        opacity: mounted ? 1 : 0,
                                        transform: mounted ? 'translateY(0)' : 'translateY(20px)',
                                        transition: 'all 0.6s ease-out'
                                    }}
                                >
                                    {/* Logo */}
                                    <div className="text-center mb-4 auth-logo" style={{
                                        animation: mounted ? 'fadeInDown 0.8s ease-out' : 'none'
                                    }}>
                                        <img src="/logo.jpeg" className="img-fluid" alt="Logo" style={{ maxWidth: '180px' }} />
                                    </div>

                                    <div>
                                        {/* Heading */}
                                        <div className="mb-4" style={{
                                            animation: mounted ? 'fadeInUp 0.8s ease-out 0.2s both' : 'none'
                                        }}>
                                            <h1 className="mb-2 fw-bold" style={{ fontSize: '2rem' }}>Welcome Back</h1>
                                            <p className="mb-0 text-muted">Access the Twellium admin panel</p>
                                        </div>

                                        {/* Username */}
                                        <div className="mb-3" style={{
                                            animation: mounted ? 'fadeInUp 0.8s ease-out 0.3s both' : 'none'
                                        }}>
                                            <label className="form-label fw-medium">Username</label>
                                            <div className="input-group input-group-flat">
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    placeholder="Enter your username"
                                                    value={username}
                                                    onChange={(e) => setUsername(e.target.value)}
                                                    required
                                                    style={{
                                                        padding: '0.75rem 1rem',
                                                        fontSize: '0.95rem',
                                                        transition: 'all 0.3s ease'
                                                    }}
                                                    onFocus={(e) => e.target.style.boxShadow = '0 0 0 0.2rem rgba(228, 31, 7, 0.15)'}
                                                    onBlur={(e) => e.target.style.boxShadow = 'none'}
                                                />
                                                <span className="input-group-text">
                                                    <i className="ti ti-user"></i>
                                                </span>
                                            </div>
                                        </div>

                                        {/* Password */}
                                        <div className="mb-3" style={{
                                            animation: mounted ? 'fadeInUp 0.8s ease-out 0.4s both' : 'none'
                                        }}>
                                            <label className="form-label fw-medium">Password</label>
                                            <div className="input-group input-group-flat pass-group">
                                                <input
                                                    type={showPassword ? 'text' : 'password'}
                                                    className="form-control pass-input"
                                                    placeholder="Enter your password"
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    required
                                                    style={{
                                                        padding: '0.75rem 1rem',
                                                        fontSize: '0.95rem',
                                                        transition: 'all 0.3s ease'
                                                    }}
                                                    onFocus={(e) => e.target.style.boxShadow = '0 0 0 0.2rem rgba(228, 31, 7, 0.15)'}
                                                    onBlur={(e) => e.target.style.boxShadow = 'none'}
                                                />
                                                <span
                                                    className="input-group-text toggle-password"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    style={{ 
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                >
                                                    <i className={`ti ${showPassword ? 'ti-eye' : 'ti-eye-off'}`}></i>
                                                </span>
                                            </div>
                                        </div>

                                        {/* Remember / Forgot */}
                                        <div className="d-flex align-items-center justify-content-between mb-4" style={{
                                            animation: mounted ? 'fadeInUp 0.8s ease-out 0.5s both' : 'none'
                                        }}>
                                            <div className="form-check form-check-md d-flex align-items-center">
                                                <input
                                                    className="form-check-input mt-0"
                                                    type="checkbox"
                                                    id="rememberMe"
                                                    checked={rememberMe}
                                                    onChange={(e) => setRememberMe(e.target.checked)}
                                                />
                                                <label className="form-check-label text-dark ms-2" htmlFor="rememberMe">
                                                    Remember Me
                                                </label>
                                            </div>
                                            <div className="text-end">
                                                <a href="#" className="link-danger fw-medium" style={{
                                                    textDecoration: 'none',
                                                    transition: 'all 0.2s ease'
                                                }}>Forgot Password?</a>
                                            </div>
                                        </div>

                                        {/* Error Alert */}
                                        {error && (
                                            <div className="alert alert-danger py-3 mb-3" role="alert" style={{
                                                animation: 'shake 0.5s ease-in-out',
                                                borderLeft: '4px solid var(--danger)'
                                            }}>
                                                <i className="ti ti-alert-circle me-2"></i>
                                                {error}
                                            </div>
                                        )}

                                        {/* Submit */}
                                        <div className="mb-3" style={{
                                            animation: mounted ? 'fadeInUp 0.8s ease-out 0.6s both' : 'none'
                                        }}>
                                            <button
                                                type="submit"
                                                className="btn btn-primary w-100"
                                                disabled={isLoading}
                                                style={{
                                                    padding: '0.75rem 1rem',
                                                    fontSize: '1rem',
                                                    fontWeight: '600',
                                                    transition: 'all 0.3s ease',
                                                    transform: isLoading ? 'scale(0.98)' : 'scale(1)'
                                                }}
                                            >
                                                {isLoading ? (
                                                    <>
                                                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                                        Signing In...
                                                    </>
                                                ) : (
                                                    <>
                                                        <i className="ti ti-login me-2"></i>
                                                        Sign In
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="text-center pb-4" style={{
                                        animation: mounted ? 'fadeIn 1s ease-out 0.8s both' : 'none'
                                    }}>
                                        <p className="text-muted mb-0" style={{ fontSize: '0.875rem' }}>
                                            Copyright &copy; {new Date().getFullYear()} - Twellium
                                        </p>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>

                    {/* Right: Background Image */}
                    <div className="col-lg-6 login-bg-01" style={{
                        opacity: mounted ? 1 : 0,
                        transition: 'opacity 1s ease-out 0.3s'
                    }}></div>

                </div>
            </div>
        </div>
    );
};

export default Login;
