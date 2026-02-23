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
        <div className="min-h-screen w-full bg-[#f8f9fa] dark:bg-[#030318] flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <motion.div
                initial="hidden"
                animate="visible"
                variants={containerVariants}
                className="relative z-10 w-full max-w-4xl"
            >
                <motion.div variants={itemVariants} className="text-center mb-10">
                    <div className="inline-flex items-center justify-center h-14 w-14 rounded-xl bg-blue-600 text-white font-bold text-xl mb-4">
                        T
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold text-[#1f2020] dark:text-[#d9dcff] mb-3">
                        Select Mode
                    </h1>
                    <p className="text-[#707070] dark:text-[#828997] text-base">
                        Choose your operational environment to continue
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Pre Production Card */}
                    <motion.div
                        variants={itemVariants}
                        whileHover={{ y: -4 }}
                        whileTap={{ scale: 0.98 }}
                        className="cursor-pointer group"
                        onClick={() => navigate('/dashboard')}
                    >
                        <Card className="h-full p-8 hover:border-blue-300 dark:hover:border-blue-800 transition-all duration-300 shadow-crm hover:shadow-crm-lg">
                            <div className="flex flex-col items-center text-center space-y-5">
                                <div className="p-5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-colors duration-300">
                                    <Factory className="w-10 h-10" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-[#1f2020] dark:text-[#d9dcff] mb-2">Pre Production</h2>
                                    <p className="text-sm text-[#707070] dark:text-[#828997]">
                                        Access the main production dashboard, stoppage logs, and reports management.
                                    </p>
                                </div>
                                <div className="flex items-center text-blue-600 dark:text-blue-400 text-sm font-medium group-hover:translate-x-1 transition-transform duration-300">
                                    Enter Dashboard <ArrowRight className="ml-2 w-4 h-4" />
                                </div>
                            </div>
                        </Card>
                    </motion.div>

                    {/* Post Production Card */}
                    <motion.div
                        variants={itemVariants}
                        whileHover={{ y: -4 }}
                        whileTap={{ scale: 0.98 }}
                        className="cursor-pointer group"
                        onClick={() => navigate('/post-production/production')}
                    >
                        <Card className="h-full p-8 hover:border-green-300 dark:hover:border-green-800 transition-all duration-300 shadow-crm hover:shadow-crm-lg">
                            <div className="flex flex-col items-center text-center space-y-5">
                                <div className="p-5 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800 group-hover:bg-green-600 group-hover:text-white group-hover:border-green-600 transition-colors duration-300">
                                    <Truck className="w-10 h-10" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-[#1f2020] dark:text-[#d9dcff] mb-2">Post Production</h2>
                                    <p className="text-sm text-[#707070] dark:text-[#828997]">
                                        Manage barcode generation, warehouse scanning, and logistics.
                                    </p>
                                </div>
                                <div className="flex items-center text-green-600 dark:text-green-400 text-sm font-medium group-hover:translate-x-1 transition-transform duration-300">
                                    Enter Module <ArrowRight className="ml-2 w-4 h-4" />
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
