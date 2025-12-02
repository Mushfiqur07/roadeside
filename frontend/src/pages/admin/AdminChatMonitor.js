import React, { useEffect, useState } from 'react';
import axios from 'axios';
import ChatWindow from '../../components/ChatWindow';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5002/api';

export default function AdminChatMonitor() {
  const [chats, setChats] = useState([]);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_BASE}/chat/all`, { headers: { Authorization: `Bearer ${token}` } });
        setChats(res.data.chats || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="border rounded">
        <div className="p-3 font-semibold border-b">Chats</div>
        {loading ? (
          <div className="p-3 text-sm">Loading...</div>
        ) : (
          <div className="divide-y">
            {chats.map(c => (
              <div key={c._id} className={`p-3 cursor-pointer hover:bg-gray-50 ${active?._id===c._id ? 'bg-gray-50' : ''}`} onClick={() => setActive(c)}>
                <div className="text-sm font-medium">Request #{String(c.serviceRequestId).slice(-6)}</div>
                <div className="text-xs text-gray-500">Updated {new Date(c.updatedAt).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="md:col-span-2 min-h-[60vh]">
        {active ? (
          <ChatWindow chatId={active._id} onClose={() => setActive(null)} />
        ) : (
          <div className="p-6 text-gray-500">Select a chat to monitor</div>
        )}
      </div>
    </div>
  );
}



