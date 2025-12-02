import api from './index';

export const adminAPI = {
  getDashboard: async () => (await api.get('/admin/dashboard')).data,
  getAnalytics: async (period = '30d') => (await api.get(`/admin/analytics?period=${period}`)).data,
  listUsers: async (params={}) => (await api.get(`/admin/users?${new URLSearchParams(params).toString()}`)).data,
  updateUserStatus: async (userId, isActive) => (await api.put(`/admin/users/${userId}/status`, { isActive })).data,
  listMechanics: async (params={}) => (await api.get(`/admin/mechanics?${new URLSearchParams(params).toString()}`)).data,
  updateMechanicVerification: async (id, verificationStatus, notes) => (await api.put(`/admin/mechanics/${id}/verification`, { verificationStatus, notes })).data,
  listRequests: async (params={}) => (await api.get(`/admin/requests?${new URLSearchParams(params).toString()}`)).data,
  updateRequestStatus: async (id, status) => (await api.put(`/admin/requests/${id}/status`, { status })).data,
  getSettings: async () => (await api.get('/admin/settings')).data,
  updateSettings: async (payload) => (await api.put('/admin/settings', payload)).data,
};

export default adminAPI;


