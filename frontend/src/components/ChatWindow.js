import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { getMessages, markRead, uploadAttachments } from '../api/chat';
import { 
  X, 
  Send, 
  Paperclip, 
  Image as ImageIcon, 
  FileText, 
  Download,
  Check,
  CheckCheck,
  Clock,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ChatWindow({ chatId, requestId, onClose }) {
  const { user } = useAuth();
  const { joinChat, sendChatMessage, typingStart, typingStop, chatEvents, markChatRead } = useSocket();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimerRef = useRef(null);
  const oldestTsRef = useRef(null);

  const canSend = useMemo(() => !!chatId && input.trim().length > 0 && !isSending, [chatId, input, isSending]);

  // Join chat room and load initial messages
  useEffect(() => {
    if (!chatId) return;
    let unsubTypingStart = null;
    let unsubTypingStop = null;
    (async () => {
      try {
        setLoading(true);
        joinChat({ chatId }, () => {});
        const initial = await getMessages(chatId, { limit: 50 });
        const sorted = (initial || []).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        setMessages(sorted);
        if (initial.length) {
          oldestTsRef.current = initial[0].createdAt;
        } else {
          oldestTsRef.current = null;
        }
        setHasMore((initial || []).length >= 50);
        // Mark read
        try { await markRead(chatId); markChatRead && markChatRead(chatId); } catch {}
      } finally {
        setLoading(false);
        // Focus input after mount
        setTimeout(() => { if (inputRef.current) inputRef.current.focus(); }, 50);
      }
    })();

    return () => {
      if (unsubTypingStart) unsubTypingStart();
      if (unsubTypingStop) unsubTypingStop();
    };
  }, [chatId, joinChat, markChatRead]);

  // Handle incoming messages via SocketContext events
  useEffect(() => {
    const evt = chatEvents?.lastMessage;
    if (!evt || evt.chatId !== chatId) return;
    setMessages(prev => {
      const m = evt.message || {};
      
      // Check for duplicates by sender, text, attachments, and approximate time (within 5 seconds)
      const dupe = prev.find(x => {
        const isSameSender = String(x.senderId) === String(m.senderId);
        const isSameText = String(x.text || '').trim() === String(m.text || '').trim();
        const timeDiff = Math.abs(new Date(x.createdAt).getTime() - new Date(m.createdAt).getTime());
        const isRecentDupe = timeDiff < 5000; // 5 seconds tolerance
        
        // Check if attachments are similar (same count and types)
        const xAttachments = x.attachments || [];
        const mAttachments = m.attachments || [];
        const isSameAttachments = xAttachments.length === mAttachments.length && 
          xAttachments.every((xa, i) => {
            const ma = mAttachments[i];
            return ma && xa.type === ma.type && 
              (xa.metadata?.originalName === ma.metadata?.originalName || 
               xa.metadata?.size === ma.metadata?.size);
          });
        
        return isSameSender && isSameText && isSameAttachments && isRecentDupe;
      });
      
      if (dupe) {
        // Update existing message with server data (keep server version)
        const updated = prev.map(x => 
          x === dupe 
            ? { ...m, status: m.status || 'delivered' }
            : x
        );
        updated.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        return updated;
      } else {
        // Add new message
        const next = [...prev, { ...m, status: m.status || 'delivered' }];
        next.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        return next;
      }
    });
    // mark as read when window is open
    try { markRead(chatId); } catch {}
    // auto scroll
    scrollToBottom();
  }, [chatEvents?.lastMessage, chatId]);

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const handleSend = () => {
    if (!canSend || isSending) return; // Prevent double sending
    
    const messageText = input.trim();
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    
    const optimistic = {
      _id: tempId,
      chatId,
      senderId: user?._id,
      text: messageText,
      createdAt: new Date().toISOString(),
      status: 'sending'
    };
    
    setMessages(prev => [...prev, optimistic]);
    setInput('');
    setIsSending(true);
    typingStop(chatId);
    
    sendChatMessage({ chatId, text: messageText }, (ack) => {
      setIsSending(false);
      if (ack && ack.success) {
        // Mark optimistic message as delivered
        setMessages(prev => 
          prev.map(msg => 
            msg._id === tempId 
              ? { ...msg, status: 'delivered' }
              : msg
          )
        );
      } else {
        // Remove failed message
        setMessages(prev => prev.filter(msg => msg._id !== tempId));
      }
      scrollToBottom();
    });
  };

  const onInputChange = (e) => {
    const value = e.target.value;
    setInput(value);
    if (!chatId) return;
    if (!isTyping) {
      setIsTyping(true);
      typingStart(chatId);
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      setIsTyping(false);
      typingStop(chatId);
    }, 1200);
  };

  const loadMore = async () => {
    if (!hasMore || !chatId || loading) return;
    try {
      setLoading(true);
      const before = oldestTsRef.current;
      const older = await getMessages(chatId, { limit: 50, before });
      if (older && older.length) {
        const merged = [...older, ...messages];
        merged.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        setMessages(merged);
        oldestTsRef.current = older[0].createdAt;
        setHasMore(older.length >= 50);
      } else {
        setHasMore(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (ts) => {
    try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
  };

  const isMine = (msg) => String(msg.senderId || msg.sender?._id || msg.sender) === String(user?._id);

  // File upload handler
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || uploadingFile) return; // Prevent double uploads

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain'];
    if (!allowedTypes.includes(file.type)) {
      alert('Only images, PDFs, and text files are allowed');
      return;
    }

    setUploadingFile(true);
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    try {
      // optimistic preview message with blob URL
      const tempUrl = URL.createObjectURL(file);
      const tempMsg = {
        _id: tempId,
        chatId,
        senderId: user?._id,
        text: '',
        attachments: [{ url: tempUrl, type: file.type, metadata: { originalName: file.name, size: file.size, mimetype: file.type } }],
        createdAt: new Date().toISOString(),
        status: 'uploading'
      };
      setMessages(prev => [...prev, tempMsg]);
      scrollToBottom();

      // upload to backend
      const uploaded = await uploadAttachments(chatId, [file]);
      const attachments = (uploaded || []).map(f => ({ url: f.url, type: f.type, metadata: f.metadata }));

      // send message over socket with uploaded attachments
      await new Promise(resolve => {
        sendChatMessage({ chatId, text: '', attachments }, (ack) => {
          if (ack && ack.success) {
            // Update optimistic message with uploaded attachments
            setMessages(prev => prev.map(m => 
              m._id === tempId 
                ? { ...m, attachments, status: 'delivered' }
                : m
            ));
          } else {
            // Remove failed upload
            setMessages(prev => prev.filter(m => m._id !== tempId));
          }
          resolve();
        });
      });
    } catch (error) {
      console.error('File upload error:', error);
      setMessages(prev => prev.filter(m => m._id !== tempId));
    } finally {
      setUploadingFile(false);
      setShowFileUpload(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Get message status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'sending':
        return <Clock className="w-3 h-3 text-gray-400" />;
      case 'sent':
        return <Check className="w-3 h-3 text-gray-400" />;
      case 'delivered':
        return <CheckCheck className="w-3 h-3 text-blue-500" />;
      case 'uploading':
        return <Clock className="w-3 h-3 text-yellow-500 animate-spin" />;
      default:
        return null;
    }
  };

  // Render attachment(s)
  const renderFileMessage = (msg) => {
    const items = Array.isArray(msg.attachments) ? msg.attachments : [];
    if (!items.length) return null;
    return (
      <div className="mt-2 space-y-2">
        {items.map((att, idx) => {
          const t = att.type || '';
          const isImage = t === 'image' || t.startsWith('image/');
          const name = att?.metadata?.originalName || `file-${idx+1}`;
          const size = att?.metadata?.size;
          return isImage ? (
            <div key={idx} className="max-w-xs">
              <img
                src={att.url}
                alt={name}
                className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => window.open(att.url, '_blank')}
              />
              <p className="text-xs text-gray-500 mt-1">{name}</p>
            </div>
          ) : (
            <div key={idx} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg max-w-xs">
              <FileText className="w-5 h-5 text-gray-500" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                {size ? <p className="text-xs text-gray-500">{(size/1024).toFixed(1)} KB</p> : null}
              </div>
              <button onClick={() => window.open(att.url, '_blank')} className="p-1 text-gray-500 hover:text-gray-700">
                <Download className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="h-full w-full bg-white border border-gray-200 rounded-xl shadow-xl flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
            <span className="text-sm font-bold">💬</span>
          </div>
          <div>
            <div className="font-semibold">Chat {chatId ? `#${String(chatId).slice(-6)}` : ''}</div>
            <div className="text-xs opacity-80">RoadAssist Support</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            <span className="text-sm">{isMinimized ? '⬆️' : '⬇️'}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50" ref={scrollRef}>
            {hasMore && (
              <button 
                onClick={loadMore} 
                className="mx-auto block text-sm text-blue-600 hover:text-blue-800 font-medium py-2 px-4 rounded-lg bg-white border border-blue-200 hover:bg-blue-50 transition-colors"
              >
                {loading ? 'Loading…' : 'Load earlier messages'}
              </button>
            )}

            <AnimatePresence>
              {messages.map((msg, index) => (
                <motion.div
                  key={msg._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className={`flex ${isMine(msg) ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[75%] ${isMine(msg) ? 'order-2' : 'order-1'}`}>
                    {/* Sender name for received messages */}
                    {!isMine(msg) && (
                      <div className="text-xs text-gray-500 mb-1 ml-1">
                        Partner
                      </div>
                    )}
                    
                    {/* Message bubble */}
                    <div className={`relative rounded-2xl px-4 py-3 shadow-sm ${
                      isMine(msg) 
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white' 
                        : 'bg-white text-gray-900 border border-gray-200'
                    }`}>
                      {/* Text content */}
                      {msg.text && !msg.text.startsWith('📎') && (
                        <div className="text-sm leading-relaxed">
                          {msg.text || msg.content}
                        </div>
                      )}
                      
                      {/* File content */}
                      {renderFileMessage(msg)}
                      
                      {/* Message metadata */}
                      <div className={`flex items-center justify-between mt-2 gap-2 ${
                        isMine(msg) ? 'text-blue-100' : 'text-gray-500'
                      }`}>
                        <div className="text-xs">
                          {formatTime(msg.createdAt)}
                        </div>
                        {isMine(msg) && (
                          <div className="flex items-center">
                            {getStatusIcon(msg.status)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Empty state */}
            {messages.length === 0 && !loading && (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">💬</span>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Start a conversation</h3>
                <p className="text-gray-500">Send a message to begin chatting</p>
              </div>
            )}
          </div>

          {/* Typing indicator */}
          <AnimatePresence>
            {chatEvents?.typing?.chatId === chatId && chatEvents?.typing?.isTyping && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="px-4 py-2 bg-gray-50 border-t border-gray-200"
              >
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span>Partner is typing...</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Composer */}
          <div className="p-4 bg-white border-t border-gray-200">
            {/* File upload dropdown */}
            <AnimatePresence>
              {showFileUpload && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingFile}
                      className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      <ImageIcon className="w-4 h-4 text-gray-600" />
                      <span className="text-sm">Image</span>
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingFile}
                      className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      <FileText className="w-4 h-4 text-gray-600" />
                      <span className="text-sm">File</span>
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input area */}
            <div className="flex items-end gap-3">
              <button
                onClick={() => setShowFileUpload(!showFileUpload)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Attach file"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={onInputChange}
                  onKeyDown={(e) => { 
                    if (e.key === 'Enter' && !e.shiftKey && !isSending) { 
                      e.preventDefault(); 
                      handleSend(); 
                    } 
                  }}
                  placeholder="Type a message..."
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  disabled={uploadingFile}
                />
              </div>
              
              <button
                onClick={handleSend}
                disabled={!canSend || uploadingFile}
                className={`p-3 rounded-2xl transition-all duration-200 ${
                  canSend && !uploadingFile
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-lg hover:shadow-xl transform hover:scale-105'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
                title="Send message"
              >
                {uploadingFile ? (
                  <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}


