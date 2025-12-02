import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LocationProvider } from './context/LocationContext';
import { SocketProvider } from './context/SocketContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Footer from './components/Footer';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import UserDashboard from './pages/user/UserDashboard';
import FindMechanics from './pages/FindMechanics';
import RequestTracking from './pages/RequestTracking';
import RequestHistory from './pages/RequestHistory';
import PaymentHistory from './pages/PaymentHistory';
import MechanicProfile from './pages/MechanicProfile';
import MechanicProfileView from './pages/MechanicProfileView';
import MechanicProfilePage from './pages/mechanic/MechanicProfilePage';
import MechanicHistoryPage from './pages/mechanic/MechanicHistoryPage';
import SimpleMechanicDashboard from './pages/mechanic/SimpleMechanicDashboard';
import MechanicRequests from './pages/mechanic/MechanicRequests';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminPanel from './pages/admin/AdminPanel';
import AdminMechanicManagement from './pages/admin/AdminMechanicManagement';
import Profile from './pages/Profile';
import NotFound from './pages/NotFound';

// Styles
import './index.css';

function App() {
  const RoleAwareHistory = () => {
    const { user, isAuthenticated, isLoading } = useAuth();
    if (isLoading) return null;
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (user?.role === 'mechanic') return <Navigate to="/mechanic/history" replace />;
    return <Navigate to="/user/requests" replace />;
  };
  return (
    <AuthProvider>
      <LocationProvider>
        <SocketProvider>
          <Router>
            <div className="min-h-screen bg-gray-50 flex flex-col">
              <Navbar />
              
              <main className="flex-grow">
                <Routes>
                  {/* Public Routes */}
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  
                  {/* Role-Based Dashboard Routes */}
                  <Route path="/user/dashboard" element={
                    <ProtectedRoute requiredRole="user">
                      <UserDashboard />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="/mechanic/dashboard" element={
                    <ProtectedRoute requiredRole="mechanic">
                      <SimpleMechanicDashboard />
                    </ProtectedRoute>
                  } />
                  
                  {/* Legacy dashboard redirect */}
                  <Route path="/dashboard" element={<Navigate to="/user/dashboard" replace />} />
                  
                  {/* User Routes */}
                  <Route path="/find-mechanics" element={
                    <ProtectedRoute requiredRole="user">
                      <FindMechanics />
                    </ProtectedRoute>
                  } />
                  <Route path="/mechanic/:id" element={
                    <ProtectedRoute requiredRole="user">
                      <MechanicProfile />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="/mechanic-profile/:id" element={
                    <MechanicProfileView />
                  } />
                  
                  <Route path="/user/requests" element={
                    <ProtectedRoute requiredRole="user">
                      <RequestHistory />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="/user/payments" element={
                    <ProtectedRoute requiredRole="user">
                      <PaymentHistory />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="/request/:id" element={
                    <ProtectedRoute>
                      <RequestTracking />
                    </ProtectedRoute>
                  } />
                  
                  {/* Legacy routes for backward compatibility */}
                  <Route path="/mechanics" element={<Navigate to="/find-mechanics" replace />} />
                  {/* Role-aware history redirect */}
                  <Route path="/history" element={<RoleAwareHistory />} />
                  
                  <Route path="/profile" element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  } />
                  
                  {/* Mechanic Routes */}
                  <Route path="/mechanic/requests" element={
                    <ProtectedRoute requiredRole="mechanic">
                      <MechanicRequests />
                    </ProtectedRoute>
                  } />
                  <Route path="/mechanic/history" element={
                    <ProtectedRoute requiredRole="mechanic">
                      <MechanicHistoryPage />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="/mechanic/profile" element={
                    <ProtectedRoute requiredRole="mechanic">
                      <MechanicProfilePage />
                    </ProtectedRoute>
                  } />
                  
                  {/* Admin Routes */}
                  <Route path="/admin/*" element={
                    <ProtectedRoute requiredRole="admin">
                      <AdminDashboard />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin/panel" element={
                    <ProtectedRoute requiredRole="admin">
                      <AdminPanel />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="/admin/mechanics" element={
                    <ProtectedRoute requiredRole="admin">
                      <AdminMechanicManagement />
                    </ProtectedRoute>
                  } />
                  
                  {/* Redirects */}
                  <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
                  
                  {/* 404 Page */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>
              
              <Footer />
              
              {/* Toast Notifications */}
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: '#363636',
                    color: '#fff',
                  },
                  success: {
                    style: {
                      background: '#22c55e',
                    },
                  },
                  error: {
                    style: {
                      background: '#ef4444',
                    },
                  },
                }}
              />
            </div>
          </Router>
        </SocketProvider>
      </LocationProvider>
    </AuthProvider>
  );
}

export default App;
