import api from './index';

export const requestsAPI = {
  // Create new service request
  createRequest: async (requestData) => {
    const response = await api.post('/requests', requestData);
    return response.data;
  },

  // Get request details by ID
  getRequestById: async (requestId) => {
    const response = await api.get(`/requests/${requestId}`);
    return response.data;
  },

  // Get user's request history
  getUserRequests: async (userId, filters = {}) => {
    const params = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        params.append(key, filters[key].toString());
      }
    });
    
    const response = await api.get(`/requests/user/${userId}?${params}`);
    return response.data;
  },
  
  // Get user's request history (paginated)
  getUserHistory: async (page = 1, limit = 10, filters = {}) => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        params.append(key, filters[key].toString());
      }
    });
    
    const response = await api.get(`/requests/user/history?${params}`);
    return response.data;
  },

  // Get mechanic's request history
  getMechanicRequests: async (mechanicId, filters = {}) => {
    const params = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        params.append(key, filters[key].toString());
      }
    });
    
    const response = await api.get(`/requests/mechanic/${mechanicId}?${params}`);
    return response.data;
  },

  // Accept service request (mechanic only)
  acceptRequest: async (requestId, acceptanceData = {}) => {
    const response = await api.put(`/requests/${requestId}/accept`, acceptanceData);
    return response.data;
  },

  // Start journey (mechanic only)
  startJourney: async (requestId) => {
    const response = await api.put(`/requests/${requestId}/start-journey`);
    return response.data;
  },

  // Mark arrived (mechanic only)
  markArrived: async (requestId) => {
    const response = await api.put(`/requests/${requestId}/arrived`);
    return response.data;
  },

  // Complete request (mechanic only)
  completeRequest: async (requestId) => {
    const response = await api.put(`/requests/${requestId}/complete`);
    return response.data;
  },

  // Confirm payment completed (user/admin)
  confirmPayment: async (requestId, { amount, method, transactionId, commissionRate }) => {
    const response = await api.put(`/requests/${requestId}/payment-completed`, {
      amount,
      method,
      transactionId,
      commissionRate
    });
    return response.data;
  },

  // Reject service request (mechanic only)
  rejectRequest: async (requestId, reason = '') => {
    const response = await api.put(`/requests/${requestId}/reject`, { reason });
    return response.data;
  },

  // Update request status
  updateRequestStatus: async (requestId, status, actualCost = null, notes = '') => {
    const data = { status };
    if (actualCost !== null) data.actualCost = actualCost;
    if (notes) data.notes = notes;
    
    const response = await api.put(`/requests/${requestId}/status`, data);
    return response.data;
  },

  // Rate a completed request
  rateRequest: async (requestId, rating, comment = '') => {
    const response = await api.put(`/requests/${requestId}/rate`, { rating, comment });
    return response.data;
  },

  // Get mechanic statistics for dashboard
  getMechanicStats: async () => {
    const response = await api.get('/requests/mechanic/stats');
    return response.data;
  },

  // Cancel request (user only)
  cancelRequest: async (requestId, reason = '') => {
    const response = await api.put(`/requests/${requestId}/status`, { 
      status: 'cancelled', 
      notes: reason 
    });
    return response.data;
  }
};

export default requestsAPI;
