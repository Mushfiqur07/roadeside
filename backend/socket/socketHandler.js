const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Mechanic = require('../models/Mechanic');
const Request = require('../models/Request');
const Chat = require('../models/Chat');

// Store active connections
const activeConnections = new Map();

const socketHandler = (io) => {
  // Connection attempt counters for basic rate limiting per IP
  const ipConnectionAttempts = new Map();

  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const ip = socket.handshake.address;

      // Basic connection attempt rate-limit: max 20 attempts per 60s per IP
      const now = Date.now();
      const attempts = ipConnectionAttempts.get(ip) || [];
      const recent = attempts.filter(ts => now - ts < 60000);
      if (recent.length >= 20) {
        return next(new Error('Too many connection attempts'));
      }
      recent.push(now);
      ipConnectionAttempts.set(ip, recent);
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

      // Reject near-expiry tokens (<60s) to force re-auth sooner
      if (decoded && decoded.exp && (decoded.exp * 1000 - Date.now()) < 60000) {
        return next(new Error('Authentication error: Token expiring soon'));
      }
      
      // Get user from database
      const user = await User.findById(decoded.userId).select('-password');
      
      if (!user || !user.isActive) {
        return next(new Error('Authentication error: Invalid user'));
      }

      // Use role from token if available (for backward compatibility)
      if (decoded.role && !user.role) {
        user.role = decoded.role;
      }

      socket.userId = user._id.toString();
      socket.userRole = user.role;
      socket.user = user;
      
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.name} (${socket.user.role}) - Socket ID: ${socket.id}`);
    
    // Store active connection
    activeConnections.set(socket.userId, {
      socketId: socket.id,
      user: socket.user,
      connectedAt: new Date()
    });

    // Track joined chat rooms for presence
    socket.joinedChats = new Set();

    // Join user to their personal room
    socket.join(`user_${socket.userId}`);
    
    // If user is a mechanic, join mechanic room
    if (socket.userRole === 'mechanic') {
      socket.join('mechanics');
    }

    // If user is admin, join admin room
    if (socket.userRole === 'admin') {
      socket.join('admins');
    }

    // Track joined request rooms to prevent duplicate joins
    socket.joinedRequestRooms = new Set();

    // Handle joining request-specific rooms
    socket.on('join_request_room', async (data) => {
      try {
        const { requestId } = data || {};
        if (typeof requestId !== 'string') {
          socket.emit('error', { message: 'Invalid requestId' });
          return;
        }
        
        if (!requestId) {
          socket.emit('error', { message: 'Request ID is required' });
          return;
        }

        // Check if already joined this request room
        const roomKey = `request_${requestId}`;
        if (socket.joinedRequestRooms.has(requestId)) {
          console.log(`User ${socket.user.name} already in request room: ${roomKey}`);
          socket.emit('joined_request_room', { requestId, success: true, alreadyJoined: true });
          return;
        }

        // Verify user has access to this request
        const request = await Request.findById(requestId);
        
        if (!request) {
          socket.emit('error', { message: 'Request not found' });
          return;
        }

        // Check if user is the requester, assigned mechanic, or admin
        const mechanic = await Mechanic.findOne({ userId: socket.userId });
        const isRequester = request.userId.toString() === socket.userId;
        const isAssignedMechanic = mechanic && request.mechanicId && 
                                  request.mechanicId.toString() === mechanic._id.toString();
        const isAdmin = socket.userRole === 'admin';

        if (!isRequester && !isAssignedMechanic && !isAdmin) {
          socket.emit('error', { message: 'Access denied to this request' });
          return;
        }

        // Join the request room
        socket.join(roomKey);
        socket.joinedRequestRooms.add(requestId);
        console.log(`User ${socket.user.name} joined request room: ${roomKey}`);
        socket.emit('joined_request_room', { requestId, success: true });

      } catch (error) {
        console.error('Error joining request room:', error);
        socket.emit('error', { message: 'Failed to join request room' });
      }
    });

    // Handle mechanic joining mechanic room (explicit join)
    socket.on('join_mechanic_room', () => {
      if (socket.userRole === 'mechanic') {
        socket.join('mechanics');
        console.log(`Mechanic ${socket.user.name} explicitly joined mechanics room`);
        socket.emit('joined_mechanic_room', { success: true });
      } else {
        console.log(`Non-mechanic user ${socket.user.name} tried to join mechanics room`);
        socket.emit('error', { message: 'Only mechanics can join mechanic room' });
      }
    });

    // Throttling state: one update per 2s per socket for location
    let lastLocationAt = 0;
    let lastMessageAtByChat = new Map();

    // Internal handler for mechanic location updates
    const handleMechanicLocationUpdate = async (data, sourceEvent = 'location_update') => {
      try {
        if (socket.userRole !== 'mechanic') {
          socket.emit('error', { message: 'Only mechanics can send location updates' });
          return;
        }

        // Throttle: discard bursts, allow min 1 per 2s
        const now = Date.now();
        if (now - lastLocationAt < 2000) {
          return; // silently drop
        }
        lastLocationAt = now;

        // Support both schemas: { coordinates:[lng,lat] } and { location:{lat,lng} }
        const { requestId } = data;
        const coords = Array.isArray(data.coordinates) ? data.coordinates : (data.location ? [data.location.lng, data.location.lat] : null);
        
        if (!coords || !Array.isArray(coords) || coords.length !== 2) {
          socket.emit('error', { message: 'Valid coordinates are required' });
          return;
        }

        const [longitude, latitude] = coords;

        if (isNaN(longitude) || isNaN(latitude)) {
          socket.emit('error', { message: 'Invalid coordinates' });
          return;
        }

        // Update mechanic's current location in database
        const mechanic = await Mechanic.findOne({ userId: socket.userId });
        
        if (!mechanic) {
          socket.emit('error', { message: 'Mechanic profile not found' });
          return;
        }

        mechanic.currentLocation.coordinates = [longitude, latitude];
        mechanic.currentLocation.lastUpdated = new Date();
        await mechanic.save();

        // If requestId is provided, send location to that specific request room
        if (requestId) {
          // Verify mechanic is assigned to this request
          const request = await Request.findById(requestId);
          
          if (request && request.mechanicId && 
              request.mechanicId.toString() === mechanic._id.toString()) {
            
            // Send location update to the request room (both legacy and normalized)
            io.to(`request_${requestId}`).emit('mechanic_location_update', {
              mechanicId: mechanic._id,
              coordinates: [longitude, latitude],
              timestamp: new Date(),
              requestId
            });
            io.to(`request_${requestId}`).emit('mechanic:location_update', {
              mechanicId: mechanic._id,
              location: { lat: latitude, lng: longitude },
              timestamp: new Date(),
              requestId
            });
          }
        }

        // Send location update to all connected users (for nearby mechanics display)
        socket.broadcast.emit('mechanic_location_broadcast', {
          mechanicId: mechanic._id,
          coordinates: [longitude, latitude],
          isAvailable: mechanic.isAvailable,
          timestamp: new Date()
        });

        socket.emit('location_update_success', {
          message: 'Location updated successfully',
          coordinates: [longitude, latitude],
          timestamp: new Date()
        });

      } catch (error) {
        console.error('Location update error:', error);
        socket.emit('error', { message: 'Failed to update location' });
      }
    };

    // Handle mechanic location updates (legacy event name)
    socket.on('location_update', (data) => handleMechanicLocationUpdate(data, 'location_update'));
    // Handle mechanic location updates (normalized event name)
    socket.on('mechanic:location_update', (data) => handleMechanicLocationUpdate(data, 'mechanic:location_update'));

    // Handle mechanic ETA updates to a specific request
    socket.on('mechanic:eta_update', async (data) => {
      try {
        if (socket.userRole !== 'mechanic') {
          socket.emit('error', { message: 'Only mechanics can send ETA updates' });
          return;
        }

        const { requestId, etaMinutes, distanceKm, speedKph } = data || {};
        if (typeof requestId !== 'string') {
          socket.emit('error', { message: 'Invalid requestId' });
          return;
        }
        if (!requestId || (typeof etaMinutes !== 'number' && typeof distanceKm !== 'number')) {
          socket.emit('error', { message: 'requestId and eta/distance are required' });
          return;
        }

        const mechanic = await Mechanic.findOne({ userId: socket.userId });
        if (!mechanic) {
          socket.emit('error', { message: 'Mechanic profile not found' });
          return;
        }

        const request = await Request.findById(requestId).populate('userId', 'name');
        if (!request) {
          socket.emit('error', { message: 'Request not found' });
          return;
        }

        // Ensure this mechanic is assigned to the request
        if (!request.mechanicId || request.mechanicId.toString() !== mechanic._id.toString()) {
          socket.emit('error', { message: 'Only the assigned mechanic can send ETA' });
          return;
        }

        io.to(`request_${requestId}`).emit('request:eta_update', {
          requestId,
          etaMinutes: typeof etaMinutes === 'number' ? Math.max(0, Math.round(etaMinutes)) : undefined,
          distanceKm: typeof distanceKm === 'number' ? Math.max(0, Math.round(distanceKm * 100) / 100) : undefined,
          speedKph: typeof speedKph === 'number' ? Math.max(0, Math.round(speedKph)) : undefined,
          timestamp: new Date()
        });
      } catch (error) {
        console.error('ETA update error:', error);
        socket.emit('error', { message: 'Failed to send ETA update' });
      }
    });

    // Handle mechanic location stop (normalized)
    socket.on('mechanic:location_stop', async (data) => {
      try {
        if (socket.userRole !== 'mechanic') {
          socket.emit('error', { message: 'Only mechanics can stop location sharing' });
          return;
        }
        const { requestId } = data || {};
        if (!requestId) {
          socket.emit('error', { message: 'requestId is required to stop sharing' });
          return;
        }

        // Ensure the mechanic is assigned to this request
        const mechanic = await Mechanic.findOne({ userId: socket.userId });
        const request = await Request.findById(requestId);
        if (!mechanic || !request || !request.mechanicId || request.mechanicId.toString() !== mechanic._id.toString()) {
          socket.emit('error', { message: 'Only the assigned mechanic can stop sharing' });
          return;
        }

        // Notify room (normalized and legacy for compatibility)
        io.to(`request_${requestId}`).emit('mechanic:location_stop', {
          requestId,
          mechanicId: mechanic._id,
          timestamp: new Date()
        });
        io.to(`request_${requestId}`).emit('mechanicLocationStop', { requestId });
      } catch (error) {
        console.error('Location stop error:', error);
        socket.emit('error', { message: 'Failed to stop location sharing' });
      }
    });

    // Handle mechanic location stop (legacy event name)
    socket.on('mechanicLocationStop', (data) => {
      socket.emit('mechanic:location_stop', data);
      // Also broadcast to room via normalized handler
      if (data && data.requestId) {
        io.to(`request_${data.requestId}`).emit('mechanic:location_stop', {
          requestId: data.requestId,
          mechanicId: socket.userId,
          timestamp: new Date()
        });
      }
    });

    // Handle new service requests (broadcast to available mechanics)
    socket.on('new_request', async (data) => {
      try {
        const { requestId } = data || {};
        if (typeof requestId !== 'string') {
          socket.emit('error', { message: 'Invalid requestId' });
          return;
        }
        
        if (!requestId) {
          socket.emit('error', { message: 'Request ID is required' });
          return;
        }

        const request = await Request.findById(requestId)
          .populate('userId', 'name phone profileImage');

        if (!request) {
          socket.emit('error', { message: 'Request not found' });
          return;
        }

        // Verify user owns this request
        if (request.userId._id.toString() !== socket.userId) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        // Find nearby available mechanics
        const [longitude, latitude] = request.pickupLocation.coordinates;
        const nearbyMechanics = await Mechanic.findAvailableNearby(
          longitude, 
          latitude, 
          request.vehicleType, 
          20000 // 20km radius
        );

        // Send request notification to nearby mechanics
        nearbyMechanics.forEach(mechanic => {
          const mechanicUserId = mechanic.userId._id.toString();
          const connection = activeConnections.get(mechanicUserId);
          
          if (connection) {
            io.to(`user_${mechanicUserId}`).emit('new_request_notification', {
              request: {
                _id: request._id,
                vehicleType: request.vehicleType,
                problemType: request.problemType,
                description: request.description,
                pickupLocation: request.pickupLocation,
                priority: request.priority,
                isEmergency: request.isEmergency,
                user: request.userId,
                distance: mechanic.getDistanceFrom(longitude, latitude)
              }
            });
          }
        });

        socket.emit('request_broadcast_success', {
          message: 'Request sent to nearby mechanics',
          mechanicsNotified: nearbyMechanics.length
        });

      } catch (error) {
        console.error('New request broadcast error:', error);
        socket.emit('error', { message: 'Failed to broadcast request' });
      }
    });

    // Handle request creation events (alternative event name for compatibility)
    socket.on('request:create', async (data) => {
      try {
        const { requestId } = data || {};
        if (typeof requestId !== 'string') {
          socket.emit('error', { message: 'Invalid requestId' });
          return;
        }
        
        if (!requestId) {
          socket.emit('error', { message: 'Request ID is required' });
          return;
        }

        // Delegate to the new_request handler
        socket.emit('new_request', { requestId });
      } catch (error) {
        console.error('Request create error:', error);
        socket.emit('error', { message: 'Failed to process request creation' });
      }
    });

    // Handle request status updates
    socket.on('request_status_update', async (data) => {
      try {
        const { requestId, status, message } = data || {};
        if (typeof requestId !== 'string' || typeof status !== 'string') {
          socket.emit('error', { message: 'Invalid payload' });
          return;
        }
        
        if (!requestId || !status) {
          socket.emit('error', { message: 'Request ID and status are required' });
          return;
        }

        const request = await Request.findById(requestId)
          .populate([
            { path: 'userId', select: 'name phone' },
            { path: 'mechanicId', populate: { path: 'userId', select: 'name phone' } }
          ]);

        if (!request) {
          socket.emit('error', { message: 'Request not found' });
          return;
        }

        // Verify user has permission to update this request
        const mechanic = await Mechanic.findOne({ userId: socket.userId });
        const isRequester = request.userId._id.toString() === socket.userId;
        const isAssignedMechanic = mechanic && request.mechanicId && 
                                  request.mechanicId._id.toString() === mechanic._id.toString();
        const isAdmin = socket.userRole === 'admin';

        if (!isRequester && !isAssignedMechanic && !isAdmin) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        // Send status update to request room
        io.to(`request_${requestId}`).emit('request_status_changed', {
          requestId,
          status,
          message: message || `Request status changed to ${status}`,
          updatedBy: socket.user.name,
          timestamp: new Date()
        });

        // Send specific notifications based on status
        if (status === 'accepted' && isAssignedMechanic) {
          // Notify user that mechanic accepted
          io.to(`user_${request.userId._id}`).emit('request_accepted', {
            requestId,
            mechanic: request.mechanicId,
            message: 'A mechanic has accepted your request!'
          });

          // Auto-create chat for this request
          try {
            let chat = await Chat.findOne({ serviceRequestId: requestId });
            if (!chat) {
              const requesterId = request.userId._id;
              const mechanicUserId = request.mechanicId.userId._id;
              chat = await Chat.create({
                serviceRequestId: requestId,
                participants: [
                  { userId: requesterId, role: 'user' },
                  { userId: mechanicUserId, role: 'mechanic' }
                ]
              });
            }
            // Notify participants chat is ready
            io.to(`user_${request.userId._id}`).emit('chat_ready', { requestId, chatId: chat._id });
            io.to(`user_${request.mechanicId.userId._id}`).emit('chat_ready', { requestId, chatId: chat._id });
          } catch (e) {
            console.error('Auto-create chat failed:', e?.message);
          }
        } else if (status === 'arrived' && isAssignedMechanic) {
          // Notify user that mechanic has arrived
          io.to(`user_${request.userId._id}`).emit('mechanic_arrived', {
            requestId,
            message: 'The mechanic has arrived at your location!'
          });
        } else if (status === 'completed') {
          // Notify both parties that service is completed
          io.to(`request_${requestId}`).emit('service_completed', {
            requestId,
            message: 'Service has been completed!'
          });

          // Close chat for this request
          try {
            const chat = await Chat.findOne({ serviceRequestId: requestId });
            if (chat) {
              if (process.env.CHAT_DELETE_ON_COMPLETE === 'true') {
                const deletedId = chat._id;
                await Chat.deleteOne({ _id: deletedId });
                io.to(`chat_${deletedId}`).emit('chat_deleted', { chatId: deletedId, requestId });
              } else if (!chat.isClosed) {
                chat.isClosed = true;
                chat.closedAt = new Date();
                await chat.save();
                io.to(`chat_${chat._id}`).emit('chat_closed', { chatId: chat._id, requestId });
              }
            }
          } catch (e) {
            console.error('Auto-close chat failed:', e?.message);
          }
        }

      } catch (error) {
        console.error('Request status update error:', error);
        socket.emit('error', { message: 'Failed to update request status' });
      }
    });

    // ================= Chat Events =================
    // join_chat: join by chatId or requestId
    socket.on('join_chat', async (payload, ack) => {
      try {
        const { chatId, requestId } = payload || {};
        let chat = null;
        if (chatId) chat = await Chat.findById(chatId);
        if (!chat && requestId) chat = await Chat.findOne({ serviceRequestId: requestId });
        if (!chat) {
          if (ack) ack({ success: false, message: 'Chat not found' });
          return;
        }
        // Auth: must be participant or admin
        const isParticipant = chat.participants.some(p => p.userId.toString() === socket.userId) || socket.userRole === 'admin';
        if (!isParticipant) {
          if (ack) ack({ success: false, message: 'Not authorized' });
          return;
        }
        socket.join(`chat_${chat._id}`);
        socket.joinedChats.add(chat._id.toString());
        if (ack) ack({ success: true, chatId: chat._id });
        // let room know user is online
        socket.to(`chat_${chat._id}`).emit('user_online', { userId: socket.userId, chatId: chat._id });
      } catch (e) {
        if (ack) ack({ success: false, message: 'Failed to join' });
      }
    });

    // send_message with ack for delivery
    socket.on('send_message', async (payload, ack) => {
      try {
        const { chatId, requestId, text, attachments } = payload || {};

        // Basic payload validation and size checks
        if (!chatId && !requestId) return ack && ack({ success: false, message: 'chatId or requestId required' });
        if (typeof text === 'string' && text.length > 2000) {
          return ack && ack({ success: false, message: 'Message too long' });
        }
        if (attachments && Array.isArray(attachments)) {
          if (attachments.length > 5) return ack && ack({ success: false, message: 'Too many attachments' });
          const totalNameSize = attachments.reduce((acc, a) => acc + (a?.name ? String(a.name).length : 0), 0);
          if (totalNameSize > 1000) return ack && ack({ success: false, message: 'Attachments metadata too large' });
        }

        // Per-room simple rate limit: max 5 messages per 5s
        const roomKey = chatId || `req_${requestId}`;
        const now = Date.now();
        const times = lastMessageAtByChat.get(roomKey) || [];
        const recent = times.filter(ts => now - ts < 5000);
        if (recent.length >= 5) {
          return ack && ack({ success: false, message: 'Rate limit exceeded' });
        }
        recent.push(now);
        lastMessageAtByChat.set(roomKey, recent);
        let chat = null;
        if (chatId) chat = await Chat.findById(chatId);
        if (!chat && requestId) chat = await Chat.findOne({ serviceRequestId: requestId });
        if (!chat) return ack && ack({ success: false, message: 'Chat not found' });

        const isParticipant = chat.participants.some(p => p.userId.toString() === socket.userId) || socket.userRole === 'admin';
        if (!isParticipant) return ack && ack({ success: false, message: 'Not authorized' });

        const message = {
          senderId: socket.userId,
          text: text || '',
          attachments: Array.isArray(attachments) ? attachments : [],
          status: 'sent',
          createdAt: new Date()
        };
        chat.messages.push(message);
        chat.updatedAt = new Date();
        await chat.save();

        // Broadcast to room
        io.to(`chat_${chat._id}`).emit('message_received', { chatId: chat._id, message });

        // Mark delivered for others
        message.status = 'delivered';
        await chat.save();

        // Acknowledge to sender
        if (ack) ack({ success: true, chatId: chat._id, status: 'delivered' });
      } catch (e) {
        if (ack) ack({ success: false, message: 'Failed to send' });
      }
    });

    socket.on('typing_start', ({ chatId } = {}) => {
      if (!chatId) return;
      socket.to(`chat_${chatId}`).emit('typing_start', { chatId, userId: socket.userId });
    });
    socket.on('typing_stop', ({ chatId } = {}) => {
      if (!chatId) return;
      socket.to(`chat_${chatId}`).emit('typing_stop', { chatId, userId: socket.userId });
    });
    
    socket.on('mark_read', async ({ chatId } = {}, ack) => {
      try {
        const chat = await Chat.findById(chatId);
        if (!chat) return ack && ack({ success: false });
        const participant = chat.participants.find(p => p.userId.toString() === socket.userId);
        if (!participant) return ack && ack({ success: false });
        participant.lastReadAt = new Date();
        chat.messages.forEach(m => { if (m.senderId.toString() !== socket.userId) m.status = 'read'; });
        await chat.save();
        io.to(`chat_${chat._id}`).emit('mark_read', { chatId: chat._id, userId: socket.userId });
        ack && ack({ success: true });
      } catch {
        ack && ack({ success: false });
      }
    });

    // Demo payment flow events
    socket.on('payment:demo_start', async (data) => {
      try {
        const { requestId, method } = data;
        if (!requestId) return;
        // Update request payment status to processing
        try {
          await Request.findByIdAndUpdate(requestId, {
            $set: { paymentStatus: 'payment_processing', ...(method ? { paymentMethod: method } : {}) }
          });
        } catch (e) {
          console.error('Failed to set payment_processing on request:', e?.message);
        }
        // Broadcast payment processing to request room
        io.to(`request_${requestId}`).emit('request:payment_processing', { requestId });
      } catch (error) {
        console.error('payment:demo_start error:', error);
      }
    });

    socket.on('payment:demo_complete', async (data) => {
      try {
        const { requestId, transactionRef, method } = data;
        if (!requestId) return;
        // Persist completion
        try {
          await Request.findByIdAndUpdate(requestId, {
            $set: { paymentStatus: 'payment_completed', ...(method ? { paymentMethod: method } : {}) }
          });
        } catch (e) {
          console.error('Failed to set payment_completed on request:', e?.message);
        }
        // Notify completion
        io.to(`request_${requestId}`).emit('request:payment_completed', { requestId, transactionRef });
      } catch (error) {
        console.error('payment:demo_complete error:', error);
      }
    });

    // Handle mechanic availability toggle
    socket.on('toggle_availability', async (data) => {
      try {
        if (socket.userRole !== 'mechanic') {
          socket.emit('error', { message: 'Only mechanics can toggle availability' });
          return;
        }

        const { isAvailable } = data;
        
        const mechanic = await Mechanic.findOne({ userId: socket.userId });
        
        if (!mechanic) {
          socket.emit('error', { message: 'Mechanic profile not found' });
          return;
        }

        mechanic.isAvailable = isAvailable;
        await mechanic.save();

        // Notify all users about availability change
        socket.broadcast.emit('mechanic_availability_changed', {
          mechanicId: mechanic._id,
          isAvailable,
          timestamp: new Date()
        });

        socket.emit('availability_updated', {
          isAvailable,
          message: `You are now ${isAvailable ? 'available' : 'unavailable'} for requests`
        });

      } catch (error) {
        console.error('Toggle availability error:', error);
        socket.emit('error', { message: 'Failed to toggle availability' });
      }
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      console.log(`User disconnected: ${socket.user.name} - Reason: ${reason}`);
      
      // Remove from active connections
      activeConnections.delete(socket.userId);

      // Broadcast offline presence to joined chats
      if (socket.joinedChats && socket.joinedChats.size > 0) {
        socket.joinedChats.forEach((cid) => {
          io.to(`chat_${cid}`).emit('user_offline', { userId: socket.userId, chatId: cid });
        });
      }
      
      // If mechanic disconnects, mark as unavailable (optional)
      if (socket.userRole === 'mechanic') {
        Mechanic.findOne({ userId: socket.userId })
          .then(mechanic => {
            if (mechanic) {
              // Optionally set mechanic as unavailable on disconnect
              // mechanic.isAvailable = false;
              // return mechanic.save();
            }
          })
          .catch(error => {
            console.error('Error handling mechanic disconnect:', error);
          });
      }
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  // Utility function to get active connections count
  io.getActiveConnections = () => {
    return {
      total: activeConnections.size,
      users: Array.from(activeConnections.values()).filter(conn => conn.user.role === 'user').length,
      mechanics: Array.from(activeConnections.values()).filter(conn => conn.user.role === 'mechanic').length,
      admins: Array.from(activeConnections.values()).filter(conn => conn.user.role === 'admin').length
    };
  };

  // Utility function to broadcast to all users
  io.broadcastToAll = (event, data) => {
    io.emit(event, data);
  };

  // Utility function to broadcast to specific role
  io.broadcastToRole = (role, event, data) => {
    if (role === 'mechanic') {
      io.to('mechanics').emit(event, data);
    } else if (role === 'admin') {
      io.to('admins').emit(event, data);
    }
  };
};

module.exports = socketHandler;
