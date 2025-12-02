import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5002/api';

// Upload profile picture
export const uploadProfilePicture = async (file) => {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('profileImage', file);

  const response = await axios.post(`${API_BASE}/upload/profile-picture`, formData, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'multipart/form-data'
    }
  });

  return response.data;
};

// Delete profile picture
export const deleteProfilePicture = async () => {
  const token = localStorage.getItem('token');
  const response = await axios.delete(`${API_BASE}/upload/profile-picture`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  return response.data;
};


