import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children, onNewRequest, onRequestUpdate, onPaymentUpdate }) => {
  const { user, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [mechanicLocation, setMechanicLocation] = useState(null);
  const [chatEvents, setChatEvents] = useState({});

  useEffect(() => {
    if (isAuthenticated && user) {
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.error('No token available for Socket.IO connection');
        return;
      }

      console.log('🔌 Initializing Socket.IO connection...');
      console.log('User:', user.name, 'Role:', user.role);

      // Determine Socket.IO URL
      const envSocketUrl = process.env.REACT_APP_SOCKET_URL;
      let socketUrl = envSocketUrl;

      if (!envSocketUrl) {
        if (process.env.NODE_ENV === 'production') {
          console.error(
            'REACT_APP_SOCKET_URL is not defined in production. Socket.IO connection will not be initialized.'
          );
          return;
        } else {
          // In development, fall back to localhost for convenience
          socketUrl = 'http://localhost:5002';
        }
      }

      console.log('Socket URL:', socketUrl);

      // Create socket connection - use SOCKET_URL not API_URL
      const newSocket = io(socketUrl, {
        auth: {
          token: token
        },
        transports: ['polling', 'websocket'], // Try polling first, then websocket
        timeout: 20000, // Increased timeout
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        maxReconnectionAttempts: 5,
        forceNew: false, // Allow connection reuse
        upgrade: true, // Allow transport upgrades
        rememberUpgrade: true
      });

      // Connection event handlers
      newSocket.on('connect', () => {
        console.log('✅ Socket.IO connected successfully!');
        console.log('Socket ID:', newSocket.id);
        setIsConnected(true);
        setConnectionError(null);

        // If user is a mechanic, join mechanic room
        if (user.role === 'mechanic') {
          console.log('🔧 User is a mechanic - joining mechanic room...');
          newSocket.emit('join_mechanic_room', { userId: user._id });
        }
      });

      newSocket.on('connect_error', (error) => {
        console.error('❌ Socket.IO connection error:', error);
        setIsConnected(false);
        setConnectionError(error.message);
        
        // Only show error toast after multiple failed attempts
        if (newSocket.io.engine.upgradeTimeout) {
          console.log('🔄 Transport upgrade failed, retrying with polling...');
        } else {
          console.log('🔄 Connection failed, will retry automatically...');
        }
      });

      newSocket.on('disconnect', (reason) => {
        console.log('🔌 Socket.IO disconnected:', reason);
        setIsConnected(false);
        
        // Clear joined rooms on disconnect
        setJoinedRooms(new Set());
        
        if (reason === 'io server disconnect') {
          // Server disconnected, try to reconnect
          console.log('🔄 Server disconnected, attempting to reconnect...');
          setTimeout(() => newSocket.connect(), 1000);
        } else if (reason === 'transport close' || reason === 'transport error') {
          console.log('🔄 Transport issue, will reconnect automatically...');
        }
      });

      newSocket.on('reconnect', (attemptNumber) => {
        console.log(`✅ Socket.IO reconnected after ${attemptNumber} attempts`);
        setIsConnected(true);
        setConnectionError(null);
      });

      newSocket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`🔄 Socket.IO reconnection attempt ${attemptNumber}`);
      });

      newSocket.on('reconnect_error', (error) => {
        console.error('❌ Socket.IO reconnection error:', error);
      });

      newSocket.on('reconnect_failed', () => {
        console.error('❌ Socket.IO reconnection failed after maximum attempts');
        toast.error('Connection lost. Please refresh the page.', {
          duration: 10000
        });
      });

      newSocket.on('error', (error) => {
        console.error('Socket.IO error:', error);
        toast.error(`Connection error: ${error.message || 'Unknown error'}`);
      });

      // Joined request room confirmation
      newSocket.on('joined_request_room', (data) => {
        console.log('[Socket] Joined request room confirmation:', data);
        if (data.requestId && data.success) {
          setJoinedRooms(prev => new Set([...prev, data.requestId]));
        }
      });

      // Handle mechanic room join confirmation
      newSocket.on('joined_mechanic_room', (data) => {
        console.log('✅ Successfully joined mechanic room:', data);
        if (data.mechanicId) {
          // Store mechanicId for future use
          localStorage.setItem('mechanicId', data.mechanicId);
          console.log('🔧 Stored mechanicId:', data.mechanicId);
        }
      });

      // Handle new service requests for mechanics
      newSocket.on('new_request_notification', (data) => {
        console.log('🔔 NEW REQUEST NOTIFICATION RECEIVED:', data);
        
        if (user.role === 'mechanic' && data.request) {
          toast.success(`New ${data.request.problemType?.replace('_', ' ')} request available!`, {
            duration: 5000,
            icon: '🔧'
          });
          
          // Call callback if provided
          if (onNewRequest) {
            onNewRequest(data);
          }
        }
      });

      // Handle request status updates (legacy)
      newSocket.on('request_status_update', (data) => {
        console.log('📋 Request status update:', data);
        
        if (data.message) {
          toast.info(data.message);
        }
        
        if (onRequestUpdate) {
          onRequestUpdate(data);
        }
      });

      // Normalized request lifecycle events
      ['request:accepted','request:on_way','request:arrived','request:completed'].forEach(evt => {
        newSocket.on(evt, (payload) => {
          console.log(`[Socket] ${evt}`, payload);
          if (onRequestUpdate) onRequestUpdate({ event: evt, ...payload });
        });
      });

      // Handle request acceptance notifications (legacy)
      newSocket.on('request_accepted', (data) => {
        console.log('✅ Request accepted:', data);
        
        if (user.role === 'user') {
          toast.success('Your request has been accepted by a mechanic!');
        }
        
        if (onRequestUpdate) {
          onRequestUpdate(data);
        }
      });

      // Handle request cancellation
      newSocket.on('request_cancelled', (data) => {
        console.log('❌ Request cancelled:', data);
        toast.info('A request has been cancelled');
        
        if (onRequestUpdate) {
          onRequestUpdate(data);
        }
      });

      // Handle payment notifications
      newSocket.on('payment_received', (data) => {
        console.log('💰 Payment received:', data);
        
        if (user.role === 'mechanic') {
          toast.success(`Payment received: ৳${data.payment.amount}`);
        }
        
        if (onPaymentUpdate) {
          onPaymentUpdate(data);
        }
      });

      // Maintenance events
      newSocket.on('maintenance:started', (payload) => {
        if (user.role !== 'admin') {
          toast('Maintenance will start now', { icon: '🛠️' });
          setTimeout(() => {
            if (user.role === 'mechanic') {
              window.location.href = '/maintenance/mechanic';
            } else {
              window.location.href = '/maintenance';
            }
          }, 500);
        }
      });
      newSocket.on('maintenance:stopped', () => {
        toast.success('Maintenance ended');
      });

      // Real-time review event for mechanics
      newSocket.on('review:new', (payload) => {
        console.log('⭐ New review received via socket', payload);
        // Surface as a toast for mechanics
        if (user.role === 'mechanic' && payload?.review?.rating) {
          toast.success(`New rating: ${payload.review.rating}★`);
        }
        // Also bubble to any listeners using on('review:new', ...)
      });

      // 🚀 AUTO LOCATION SHARING EVENTS
      newSocket.on('auto_start_location_sharing', (payload) => {
        console.log('🚀 Auto-start location sharing:', payload);
        if (user.role === 'mechanic') {
          // Store the requestId for location sharing
          localStorage.setItem('active_location_sharing_request', payload.requestId);
          // Trigger custom event for components to handle
          window.dispatchEvent(new CustomEvent('autoStartLocationSharing', { 
            detail: { requestId: payload.requestId, message: payload.message } 
          }));
          toast.success(payload.message || 'Location sharing started automatically', {
            icon: '📍',
            duration: 3000
          });
        }
      });

      newSocket.on('auto_stop_location_sharing', (payload) => {
        console.log('🛑 Auto-stop location sharing:', payload);
        if (user.role === 'mechanic') {
          // Clear the stored requestId
          localStorage.removeItem('active_location_sharing_request');
          // Trigger custom event for components to handle
          window.dispatchEvent(new CustomEvent('autoStopLocationSharing', { 
            detail: { requestId: payload.requestId, message: payload.message } 
          }));
          toast.success(payload.message || 'Location sharing stopped automatically', {
            icon: '🛑',
            duration: 3000
          });
        }
      });

      // Handle mechanic location updates (normalized)
      newSocket.on('mechanic:location_update', (data) => {
        setMechanicLocation({
          lat: data.location.lat,
          lng: data.location.lng,
          timestamp: data.timestamp
        });
      });

      // Normalized stop event
      newSocket.on('mechanic:location_stop', () => {
        setMechanicLocation(null);
      });
      // Legacy stop event
      newSocket.on('mechanicLocationStop', () => {
        setMechanicLocation(null);
      });

      // Chat events
      newSocket.on('chat_ready', ({ requestId, chatId }) => {
        setChatEvents(prev => ({ ...prev, lastChatReady: { requestId, chatId, at: Date.now() } }));
      });
      newSocket.on('message_received', (payload) => {
        setChatEvents(prev => ({ ...prev, lastMessage: { ...payload, at: Date.now() } }));
      });
      newSocket.on('typing_start', (payload) => {
        setChatEvents(prev => ({ ...prev, typing: { ...payload, isTyping: true } }));
      });
      newSocket.on('typing_stop', (payload) => {
        setChatEvents(prev => ({ ...prev, typing: { ...payload, isTyping: false } }));
      });
      newSocket.on('mark_read', (payload) => {
        setChatEvents(prev => ({ ...prev, lastRead: { ...payload, at: Date.now() } }));
      });
      newSocket.on('chat_closed', (payload) => {
        setChatEvents(prev => ({ ...prev, chatClosed: { ...payload, at: Date.now() } }));
      });
      newSocket.on('chat_deleted', (payload) => {
        setChatEvents(prev => ({ ...prev, chatDeleted: { ...payload, at: Date.now() } }));
      });

      setSocket(newSocket);

      // Cleanup function
      return () => {
        console.log('🔌 Cleaning up Socket.IO connection');
        newSocket.disconnect();
        setSocket(null);
        setIsConnected(false);
      };
    } else {
      // User not authenticated, cleanup any existing connection
      if (socket) {
        console.log('🔌 User not authenticated, disconnecting socket');
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
    }
  }, [isAuthenticated, user, onNewRequest, onRequestUpdate, onPaymentUpdate]);

  // Track joined rooms to prevent duplicates
  const [joinedRooms, setJoinedRooms] = useState(new Set());

  // Helper functions
  const joinRequestRoom = useCallback((requestId) => {
    if (socket && isConnected) {
      // Check if already joined this room
      if (joinedRooms.has(requestId)) {
        console.log(`Already joined request room: ${requestId}`);
        return;
      }
      
      console.log(`Joining request room: ${requestId}`);
      socket.emit('join_request_room', { requestId });
      
      // Track that we've joined this room
      setJoinedRooms(prev => new Set([...prev, requestId]));
    } else {
      console.error('Cannot join request room - socket not connected');
    }
  }, [socket, isConnected, joinedRooms]);

  const joinMechanicRoom = useCallback(() => {
    if (socket && isConnected && user?.role === 'mechanic') {
      console.log('Joining mechanic room');
      socket.emit('join_mechanic_room');
    } else {
      console.error('Cannot join mechanic room - socket not connected or user not mechanic');
    }
  }, [socket, isConnected, user?.role]);

  const on = useCallback((eventName, handler) => {
    if (socket) {
      socket.on(eventName, handler);
      // Return unsubscribe function
      return () => {
        if (socket) {
          socket.off(eventName, handler);
        }
      };
    }
    // Return empty function if no socket
    return () => {};
  }, [socket]);

  const off = useCallback((eventName, handler) => {
    if (socket) {
      socket.off(eventName, handler);
    }
  }, [socket]);

  const emit = useCallback((eventName, data) => {
    if (socket && isConnected) {
      console.log(`Emitting event: ${eventName}`, data);
      socket.emit(eventName, data);
    } else {
      console.error(`Cannot emit ${eventName} - socket not connected`);
    }
  }, [socket, isConnected]);

  // Helpers for mechanic to accept/reject via socket
  const acceptRequestViaSocket = useCallback((requestId, message = 'Mechanic accepted your request') => {
    if (socket && isConnected) {
      socket.emit('request_status_update', { requestId, status: 'accepted', message });
    }
  }, [socket, isConnected]);

  const rejectRequestViaSocket = useCallback((requestId, message = 'Mechanic rejected your request') => {
    if (socket && isConnected) {
      socket.emit('request_status_update', { requestId, status: 'rejected', message });
    }
  }, [socket, isConnected]);

  const updateMechanicLocation = useCallback((requestId, location) => {
    if (socket && user?.role === 'mechanic') {
      socket.emit('mechanic:location_update', {
        requestId,
        location,
        mechanicId: user._id,
        timestamp: new Date()
      });
    }
  }, [socket, user?.role, user?._id]);

  const stopLocationSharing = useCallback((requestId) => {
    if (socket && user?.role === 'mechanic') {
      socket.emit('mechanic:location_stop', {
        requestId,
        mechanicId: user._id
      });
    }
  }, [socket, user?.role, user?._id]);

  const joinChat = useCallback((params, ack) => {
    if (!socket || !isConnected) return;
    socket.emit('join_chat', params, ack);
  }, [socket, isConnected]);

  const sendChatMessage = useCallback((params, ack) => {
    if (!socket || !isConnected) return;
    socket.emit('send_message', params, ack);
  }, [socket, isConnected]);

  const typingStart = useCallback((chatId) => {
    if (!socket || !isConnected) return;
    socket.emit('typing_start', { chatId });
  }, [socket, isConnected]);

  const typingStop = useCallback((chatId) => {
    if (!socket || !isConnected) return;
    socket.emit('typing_stop', { chatId });
  }, [socket, isConnected]);

  const markChatRead = useCallback((chatId, ack) => {
    if (!socket || !isConnected) return;
    socket.emit('mark_read', { chatId }, ack);
  }, [socket, isConnected]);

  const value = useMemo(() => ({
    socket,
    isConnected,
    connectionError,
    mechanicLocation,
    chatEvents,
    joinRequestRoom,
    joinMechanicRoom,
    on,
    off,
    emit,
    updateMechanicLocation,
    stopLocationSharing
    ,acceptRequestViaSocket
    ,rejectRequestViaSocket
    ,joinChat
    ,sendChatMessage
    ,typingStart
    ,typingStop
    ,markChatRead
  }), [socket, isConnected, connectionError, mechanicLocation, chatEvents, joinRequestRoom, joinMechanicRoom, on, off, emit, updateMechanicLocation, stopLocationSharing, acceptRequestViaSocket, rejectRequestViaSocket, joinChat, sendChatMessage, typingStart, typingStop, markChatRead]);

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketContext;
