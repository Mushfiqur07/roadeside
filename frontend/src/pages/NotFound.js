import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, Wrench, Search } from 'lucide-react';
import { motion } from 'framer-motion';

import { useAuth } from '../context/AuthContext';

const NotFound = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  // Returns dashboard link based on user role
  const getDashboardLink = () => {
    if (!isAuthenticated) return '/';
    if (user?.role === 'admin') return '/admin/dashboard';
    if (user?.role === 'mechanic') return '/mechanic/dashboard';
    return '/dashboard';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        {/* Animated 404 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="relative">
            <h1 className="text-9xl font-bold text-blue-200 select-none">404</h1>
            <motion.div
              initial={{ rotate: 0 }}
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
            >
              <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center">
                <Wrench className="w-8 h-8 text-white" />
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Page Not Found</h2>
          <p className="text-gray-600 mb-8 leading-relaxed">
            Sorry, we couldn't find the page you're looking for. It might
            have been moved, deleted, or you entered the wrong URL.
          </p>
        </motion.div>
        
        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="space-y-4"
        >
          <Link
            to={getDashboardLink()}
            className="inline-flex items-center justify-center w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 transform hover:scale-105 shadow-lg"
          >
            <Home className="w-5 h-5 mr-2" />
            {isAuthenticated ? 'Go to Dashboard' : 'Go Home'}
          </Link>
          
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center justify-center w-full px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Go Back
          </button>

          {isAuthenticated && (
            <Link
              to="/find-mechanics"
              className="inline-flex items-center justify-center w-full px-6 py-3 border-2 border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 hover:border-blue-400 transition-all duration-200"
            >
              <Search className="w-5 h-5 mr-2" />
              Find Mechanics
            </Link>
          )}
        </motion.div>
        
        {/* Support Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-12 pt-8 border-t border-gray-200"
        >
          <p className="text-sm text-gray-500 mb-2">
            Need help? Contact our support team
          </p>
          <div className="space-y-1">
            <a
              href="mailto:support@roadassistbd.com"
              className="text-blue-600 hover:text-blue-500 text-sm font-medium transition-colors"
            >
              support@roadassistbd.com
            </a>
            <br />
            <a
              href="tel:+88016263"
              className="text-blue-600 hover:text-blue-500 text-sm font-medium transition-colors"
            >
              Emergency: 16263
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default NotFound;
