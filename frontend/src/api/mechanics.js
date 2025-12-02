import api from './index';

export const mechanicsAPI = {
  // Get nearby mechanics
  getNearbyMechanics: async (longitude, latitude, vehicleType = null, maxDistance = 10000, includeUnavailable = false) => {
    const params = new URLSearchParams({
      longitude: longitude.toString(),
      latitude: latitude.toString(),
      maxDistance: maxDistance.toString(),
      includeUnavailable: includeUnavailable ? 'true' : 'false'
    });
    
    if (vehicleType) {
      params.append('vehicleType', vehicleType);
    }
    
    const response = await api.get(`/mechanics/nearby?${params}`);
    return response.data;
  },

  // Get mechanic details by ID (public profile)
  getMechanicById: async (mechanicId) => {
    const response = await api.get(`/mechanics/${mechanicId}/profile`);
    return response.data;
  },

  // Get mechanic analytics/history
  getMechanicAnalytics: async (mechanicId) => {
    const response = await api.get(`/mechanics/${mechanicId}/history`);
    return response.data;
  },

  // Get all mechanics with filters
  getAllMechanics: async (filters = {}) => {
    const params = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        params.append(key, filters[key].toString());
      }
    });
    
    const response = await api.get(`/mechanics?${params}`);
    return response.data;
  },

  // Toggle mechanic availability (mechanic only)
  toggleAvailability: async (isAvailable, currentLocation = null) => {
    const data = { isAvailable };
    if (currentLocation) {
      data.currentLocation = currentLocation;
    }
    
    const response = await api.put('/mechanics/availability', data);
    return response.data;
  },

  // Update mechanic location (mechanic only)
  updateLocation: async (coordinates) => {
    const response = await api.put('/mechanics/location', { coordinates });
    return response.data;
  },

  // Update mechanic profile (mechanic only)
  updateProfile: async (profileData) => {
    const response = await api.put('/mechanics/profile', profileData);
    return response.data;
  },

  // Get mechanic's own profile (mechanic only)
  getMyProfile: async () => {
    const response = await api.get('/mechanics/profile/me');
    return response.data;
  }
};

export default mechanicsAPI;
