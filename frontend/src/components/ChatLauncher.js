import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import ChatButton from './ChatButton';
import ChatList from './ChatList';
import ChatWindow from './ChatWindow';
import { getMyChats } from '../api/chat';

export default function ChatLauncher() {
  const { isAuthenticated, user } = useAuth();
  const { chatEvents, on } = useSocket();
  const [isOpen, setIsOpen] = useState(false);
  const [activeChat, setActiveChat] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeChats, setActiveChats] = useState([]);

  // Load current active chats (act as proxy for active accepted/ongoing requests)
  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      try {
        const mine = await getMyChats();
        const open = (mine || []).filter(c => !c.isClosed);
        setActiveChats(open);
      } catch {}
    })();
  }, [isAuthenticated]);

  // When chat_ready arrives, open the launcher and set the active chat
  useEffect(() => {
    if (!chatEvents?.lastChatReady) return;
    const { chatId } = chatEvents.lastChatReady;
    if (chatId) {
      setActiveChat({ _id: chatId });
      setIsOpen(true);
      setActiveChats(prev => {
        if (prev.find(c => c._id === chatId)) return prev;
        return [...prev, { _id: chatId }];
      });
    }
  }, [chatEvents.lastChatReady]);

  // Increase unread count for new messages when closed
  useEffect(() => {
    if (!chatEvents?.lastMessage) return;
    if (!isOpen) setUnreadCount(c => c + 1);
  }, [chatEvents.lastMessage, isOpen]);

  // Handle chat closed/deleted
  useEffect(() => {
    if (!chatEvents?.chatClosed && !chatEvents?.chatDeleted) return;
    const evt = chatEvents.chatClosed || chatEvents.chatDeleted;
    if (!evt?.chatId) return;
    setActiveChats(prev => prev.filter(c => c._id !== evt.chatId));
    if (activeChat?._id === evt.chatId) {
      setActiveChat(null);
      setIsOpen(false);
    }
  }, [chatEvents.chatClosed, chatEvents.chatDeleted, activeChat]);

  // Listen for request status changes and hide when completed/cancelled
  useEffect(() => {
    const off = on('request_status_changed', (payload) => {
      const status = (payload?.status || '').toLowerCase();
      if (['completed', 'cancelled'].includes(status)) {
        // refresh active chats
        getMyChats().then(mine => {
          const open = (mine || []).filter(c => !c.isClosed);
          setActiveChats(open);
          if (!open.length) {
            setIsOpen(false);
            setActiveChat(null);
          }
        }).catch(() => {});
      }
    });
    return () => { if (off) off(); };
  }, [on]);

  const canShow = useMemo(() => {
    const roleOk = (user?.role === 'user' || user?.role === 'mechanic');
    return !!isAuthenticated && roleOk && activeChats.length > 0;
  }, [isAuthenticated, user, activeChats.length]);

  return (
    <>
      {canShow && (
        <>
          <ChatButton onClick={() => { setIsOpen(v => !v); setUnreadCount(0); }} count={unreadCount} />
          {isOpen && (
            <div className="fixed bottom-24 right-4 z-50 flex flex-col md:flex-row gap-3">
              <div className="hidden md:block w-64 h-96 bg-white border rounded-lg shadow overflow-hidden">
                <div className="px-3 py-2 border-b text-sm font-semibold">Conversations</div>
                <ChatList onOpen={(c) => { setActiveChat(c); }} />
              </div>
              <div className="w-[90vw] md:w-[420px] h-[60vh] md:h-96">
                {activeChat ? (
                  <ChatWindow chatId={activeChat._id} onClose={() => setIsOpen(false)} />
                ) : (
                  <div className="h-full w-full bg-white border rounded-lg shadow flex items-center justify-center text-gray-500">
                    Select a chat to start
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}


