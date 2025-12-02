import axios from 'axios';
import toast from 'react-hot-toast';

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Helper function to create delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to determine if error is retryable
const isRetryableError = (error) => {
  if (!error.response) {
    // Network errors, timeouts, etc.
    return true;
  }
  
  const status = error.response.status;
  // Retry on 5xx server errors and 429 rate limiting
  return status >= 500 || status === 429;
};

// Create axios instance
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5002/api',
  timeout: 60000, // Increased to 60 seconds
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false
});

// Request interceptor to add auth token and retry logic
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Add retry metadata
    config.retryCount = config.retryCount || 0;
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors with retry logic
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const config = error.config;
    
    console.error('[API] Request failed:', {
      url: config?.url,
      method: config?.method,
      status: error.response?.status,
      message: error.message,
      data: error.response?.data,
      retryCount: config?.retryCount || 0
    });

    // Check if we should retry
    if (config && isRetryableError(error) && config.retryCount < MAX_RETRIES) {
      config.retryCount += 1;
      
      console.log(`[API] Retrying request (${config.retryCount}/${MAX_RETRIES}):`, config.url);
      
      // Wait before retrying with exponential backoff
      await delay(RETRY_DELAY * Math.pow(2, config.retryCount - 1));
      
      // Retry the request
      return api(config);
    }

    // Handle different error scenarios
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      
      switch (status) {
        case 401:
          // Unauthorized - clear token and redirect to login
          localStorage.removeItem('token');
          if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
            toast.error('Session expired. Please login again.');
            setTimeout(() => {
              window.location.href = '/login';
            }, 1000);
          }
          break;
          
        case 403:
          toast.error('Access denied. You don\'t have permission to perform this action.');
          break;
          
        case 404:
          // Don't show toast for 404s as they might be expected
          console.warn('[API] Resource not found:', error.config?.url);
          break;
          
        case 422:
          // Validation errors
          if (data.errors && Array.isArray(data.errors)) {
            data.errors.forEach(err => toast.error(err));
          } else if (data.message) {
            toast.error(data.message);
          }
          break;
          
        case 429:
          toast.error('Too many requests. Please try again later.');
          break;
          
        case 500:
        case 502:
        case 503:
        case 504:
          console.error('[API] Server error:', status, data);
          toast.error('Server temporarily unavailable. Please try again.');
          break;
          
        default:
          if (data && data.message) {
            toast.error(data.message);
          } else {
            console.error('[API] Unexpected error status:', status);
          }
      }
    } else if (error.request) {
      // Network error - no response received
      console.error('[API] Network error:', {
        url: error.config?.url,
        code: error.code,
        message: error.message
      });
      
      if (error.code === 'ECONNABORTED') {
        if (config?.retryCount >= MAX_RETRIES) {
          toast.error('Request timeout after multiple attempts. Please check your connection and try again.');
        } else {
          toast.error('Request timeout. Retrying...');
        }
      } else if (error.code === 'ERR_NETWORK') {
        if (config?.retryCount >= MAX_RETRIES) {
          toast.error('Network error after multiple attempts. Please check your connection and server status.');
        } else {
          toast.error('Network error. Retrying...');
        }
      } else {
        if (config?.retryCount >= MAX_RETRIES) {
          toast.error('Unable to connect to server after multiple attempts. Please try again later.');
        } else {
          toast.error('Connection issue. Retrying...');
        }
      }
    } else {
      // Other error (request setup, etc.)
      console.error('[API] Request setup error:', error.message);
      toast.error('Request failed. Please try again.');
    }
    
    return Promise.reject(error);
  }
);

export default api;

// Promotions
export const promotionsAPI = {
  listActive: async () => (await api.get('/user/promotions/active')).data,
};

// Subscriptions
export const subscriptionAPI = {
  get: async () => (await api.get('/user/subscription')).data,
  create: async (payload) => (await api.post('/user/subscription', payload)).data,
  cancel: async () => (await api.delete('/user/subscription')).data,
};

// Maintenance helper API
export const maintenanceAPI = {
  async status() {
    const res = await api.get('/status/maintenance');
    return res.data;
  },
  async start(reason) {
    const res = await api.post('/admin/maintenance/start', { reason });
    return res.data;
  },
  async stop() {
    const res = await api.post('/admin/maintenance/stop');
    return res.data;
  }
};
