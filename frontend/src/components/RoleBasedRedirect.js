import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const RoleBasedRedirect = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      // Redirect based on user role
      if (user.role === 'mechanic') {
        navigate('/mechanic/dashboard', { replace: true });
      } else if (user.role === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        // Default to user dashboard
        navigate('/user/dashboard', { replace: true });
      }
    } else if (!isLoading && !isAuthenticated) {
      // Redirect to login if not authenticated
      navigate('/login', { replace: true });
    }
  }, [user, isAuthenticated, isLoading, navigate]);

  return null; // This component doesn't render anything
};

export default RoleBasedRedirect;
