import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button, Input, Card } from '../../components/ui';
import { Lock, User, ArrowRight, Eye, EyeOff } from 'lucide-react';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        const result = await login(username, password);

        if (result.success) {
            navigate('/dashboard');
        } else {
            setError(result.message || 'Invalid credentials');
        }
        setIsLoading(false);
    };

    return (
        <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 relative overflow-hidden flex items-center justify-center p-4">
            {/* Abstract Background */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-100/40 dark:from-emerald-900/20 via-slate-50 dark:via-slate-950 to-slate-50 dark:to-slate-950 animate-pulse" />
                <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-emerald-100/20 dark:from-emerald-900/10 to-transparent" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="relative z-10 w-full max-w-md"
            >
                <div className="text-center mb-8">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="inline-block"
                    >
                        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-200">
                            Twellium
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm tracking-wider uppercase">Admin Portal</p>
                    </motion.div>
                </div>

                <Card className="p-8 backdrop-blur-2xl bg-white/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 shadow-2xl shadow-emerald-900/10">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <div className="relative group">
                                <User className="absolute left-3 top-9 h-5 w-5 text-slate-400 dark:text-slate-500 group-focus-within:text-emerald-500 dark:group-focus-within:text-emerald-400 transition-colors" />
                                <Input
                                    label="Username"
                                    placeholder="Enter your username"
                                    className="pl-10 bg-white dark:bg-slate-950/50"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="relative group">
                                <Lock className="absolute left-3 top-9 h-5 w-5 text-slate-400 dark:text-slate-500 group-focus-within:text-emerald-500 dark:group-focus-within:text-emerald-400 transition-colors" />
                                <Input
                                    label="Password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    className="pl-10 pr-10 bg-white dark:bg-slate-950/50"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-9 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20"
                            >
                                {error}
                            </motion.div>
                        )}

                        <div className="pt-2">
                            <Button
                                type="submit"
                                className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border-0"
                                isLoading={isLoading}
                            >
                                {!isLoading && (
                                    <span className="flex items-center gap-2">
                                        Sign In <ArrowRight className="h-5 w-5" />
                                    </span>
                                )}
                            </Button>
                        </div>

                        <div className="text-center pt-4">
                            <a href="#" className="text-sm text-slate-500 hover:text-emerald-400 transition-colors">
                                Forgot your password?
                            </a>
                        </div>
                    </form>
                </Card>

                <div className="text-center mt-8 text-slate-500 dark:text-slate-600 text-xs">
                    &copy; {new Date().getFullYear()} Twellium Company. All rights reserved.
                </div>
            </motion.div>
        </div>
    );
};

export default Login;
