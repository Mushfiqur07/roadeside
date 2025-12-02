import api from './index';

export const paymentsAPI = {
  // Create a new payment
  createPayment: async (paymentData) => {
    const response = await api.post('/payment', paymentData);
    return response.data;
  },

  // Get payment details by ID
  getPaymentById: async (paymentId) => {
    const response = await api.get(`/payment/${paymentId}`);
    return response.data;
  },

  // Get payment invoice as PDF
  getPaymentInvoice: async (paymentId) => {
    const response = await api.get(`/payment/${paymentId}/invoice`, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Get user's payment history
  getUserPayments: async (page = 1, limit = 10, filters = {}) => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        params.append(key, filters[key].toString());
      }
    });
    
    const response = await api.get(`/payment/user/history?${params}`);
    return response.data;
  },

  // Get mechanic's payment history
  getMechanicPayments: async (page = 1, limit = 10, filters = {}) => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        params.append(key, filters[key].toString());
      }
    });
    
    const response = await api.get(`/payment/mechanic/history?${params}`);
    return response.data;
  },

  // Process payment (for demo purposes)
  processPayment: async (requestId, paymentData) => {
    const response = await api.post('/payment/process', {
      requestId,
      ...paymentData
    });
    return response.data;
  },

  // Verify payment status
  verifyPayment: async (transactionId) => {
    const response = await api.get(`/payment/verify/${transactionId}`);
    return response.data;
  },

  // Get payment statistics
  getPaymentStats: async (startDate, endDate) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const response = await api.get(`/payment/stats?${params}`);
    return response.data;
  }
};

export default paymentsAPI;
