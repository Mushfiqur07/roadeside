import React, { useEffect, useState } from 'react';
import { getMyChats } from '../api/chat';

export default function ChatList({ onOpen }) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const list = await getMyChats();
        setChats(list);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="p-4 text-sm">Loading chats...</div>;

  return (
    <div className="divide-y">
      {chats.map(c => (
        <div key={c._id} className="p-3 hover:bg-gray-50 cursor-pointer" onClick={() => onOpen(c)}>
          <div className="text-sm font-medium">Request #{String(c.serviceRequestId).slice(-6)}</div>
          <div className="text-xs text-gray-500">Updated {new Date(c.updatedAt).toLocaleString()}</div>
        </div>
      ))}
      {!chats.length && <div className="p-4 text-sm text-gray-500">No chats</div>}
    </div>
  );
}



