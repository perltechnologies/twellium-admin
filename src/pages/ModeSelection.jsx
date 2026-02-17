import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui';
import { Factory, Truck, ArrowRight } from 'lucide-react';

const ModeSelection = () => {
    const navigate = useNavigate();

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.2
            }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: {
                type: "spring",
                stiffness: 100
            }
        }
    };

    return (
        <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-emerald-100/20 dark:from-emerald-900/10 via-slate-50 dark:via-slate-950 to-slate-50 dark:to-slate-950" />
            </div>

            <motion.div
                initial="hidden"
                animate="visible"
                variants={containerVariants}
                className="relative z-10 w-full max-w-4xl"
            >
                <motion.div variants={itemVariants} className="text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-200 mb-4">
                        Select Mode
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-lg">
                        Choose your operational environment to continue
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Pro Production Card */}
                    <motion.div
                        variants={itemVariants}
                        whileHover={{ y: -5, scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="cursor-pointer group"
                        onClick={() => navigate('/dashboard')}
                    >
                        <Card className="h-full p-8 border-2 border-transparent hover:border-emerald-500/30 dark:hover:border-emerald-500/30 transition-all duration-300 bg-white/80 dark:bg-slate-900/60 shadow-xl hover:shadow-2xl hover:shadow-emerald-900/10">
                            <div className="flex flex-col items-center text-center space-y-6">
                                <div className="p-6 rounded-full bg-emerald-100/50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-colors duration-300">
                                    <Factory className="w-12 h-12" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-3">Pro Production</h2>
                                    <p className="text-slate-500 dark:text-slate-400">
                                        Access the main production dashboard, stoppage logs, and reports management.
                                    </p>
                                </div>
                                <div className="flex items-center text-emerald-600 dark:text-emerald-400 font-medium group-hover:translate-x-1 transition-transform duration-300">
                                    Expected Flow <ArrowRight className="ml-2 w-5 h-5" />
                                </div>
                            </div>
                        </Card>
                    </motion.div>

                    {/* Post Production Card */}
                    <motion.div
                        variants={itemVariants}
                        whileHover={{ y: -5, scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="cursor-pointer group"
                        onClick={() => navigate('/post-production/production')}
                    >
                        <Card className="h-full p-8 border-2 border-transparent hover:border-blue-500/30 dark:hover:border-blue-500/30 transition-all duration-300 bg-white/80 dark:bg-slate-900/60 shadow-xl hover:shadow-2xl hover:shadow-blue-900/10">
                            <div className="flex flex-col items-center text-center space-y-6">
                                <div className="p-6 rounded-full bg-blue-100/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors duration-300">
                                    <Truck className="w-12 h-12" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-3">Post Production</h2>
                                    <p className="text-slate-500 dark:text-slate-400">
                                        Manage barcode generation, warehouse scanning, and logistics.
                                    </p>
                                </div>
                                <div className="flex items-center text-blue-600 dark:text-blue-400 font-medium group-hover:translate-x-1 transition-transform duration-300">
                                    New Flow <ArrowRight className="ml-2 w-5 h-5" />
                                </div>
                            </div>
                        </Card>
                    </motion.div>
                </div>
            </motion.div>
        </div>
    );
};

export default ModeSelection;
