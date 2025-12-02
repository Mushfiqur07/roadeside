import api from './index';

export const historyAPI = {
  getUserHistory: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await api.get(`/history/user?${query}`);
    return res.data;
  },
  exportUserHistory: async (format = 'csv') => {
    const res = await api.get(`/history/user/export?format=${format}`, { responseType: 'blob' });
    return res;
  },
  getUserRatings: async () => {
    const res = await api.get(`/history/user/ratings`);
    return res.data;
  },
  getUserAnalytics: async (period = '12months') => {
    const res = await api.get(`/history/user/analytics?period=${period}`);
    return res.data;
  },
  getMechanicHistory: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await api.get(`/history/mechanic?${query}`);
    return res.data;
  },
  getMechanicSummary: async () => {
    const res = await api.get(`/history/mechanic/summary`);
    return res.data;
  }
};

export default historyAPI;


