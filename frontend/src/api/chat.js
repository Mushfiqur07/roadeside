import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5002/api';

export const createOrGetChatByRequest = async (requestId) => {
  const token = localStorage.getItem('token');
  const res = await axios.post(`${API_BASE}/chat/create`, { requestId }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data.chat;
};

export const getChatByRequest = async (requestId) => {
  const token = localStorage.getItem('token');
  const res = await axios.get(`${API_BASE}/chat/by-request/${requestId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data.chat;
};

export const getMyChats = async () => {
  const token = localStorage.getItem('token');
  const res = await axios.get(`${API_BASE}/chat/mine`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data.chats;
};

export const getMessages = async (chatId, { before, limit = 50 } = {}) => {
  const token = localStorage.getItem('token');
  const params = {};
  if (before) params.before = before;
  if (limit) params.limit = limit;
  const res = await axios.get(`${API_BASE}/chat/${chatId}/messages`, {
    params,
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data.messages;
};

export const uploadAttachments = async (chatId, files) => {
  const token = localStorage.getItem('token');
  const form = new FormData();
  files.forEach(f => form.append('files', f));
  const res = await axios.post(`${API_BASE}/chat/${chatId}/upload`, form, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data.files;
};

export const markRead = async (chatId) => {
  const token = localStorage.getItem('token');
  await axios.post(`${API_BASE}/chat/${chatId}/mark-read`, {}, {
    headers: { Authorization: `Bearer ${token}` }
  });
};



