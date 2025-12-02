import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';
import { maintenanceAPI } from '../api';

const ProtectedRoute = ({ children, requiredRole = null }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();
  const [maintenance, setMaintenance] = useState(false);

  useEffect(() => {
    let mounted = true;
    maintenanceAPI.status().then((d)=>{ if (mounted) setMaintenance(!!d.maintenance); }).catch(()=>{});
    return () => { mounted = false; };
  }, []);

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Maintenance block: only admins can pass
  if (maintenance && user?.role !== 'admin') {
    return <Navigate to={user?.role === 'mechanic' ? '/maintenance/mechanic' : '/maintenance'} replace />;
  }

  // Check role-based access
  if (requiredRole && user?.role !== requiredRole) {
    // Redirect based on user role
    switch (user?.role) {
      case 'admin':
        return <Navigate to="/admin/dashboard" replace />;
      case 'mechanic':
        return <Navigate to="/mechanic/dashboard" replace />;
      case 'user':
      default:
        return <Navigate to="/user/dashboard" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
