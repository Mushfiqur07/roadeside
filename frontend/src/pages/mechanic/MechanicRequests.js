import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { requestsAPI } from '../../api/requests';
import Map, { MechanicRequestMap } from '../../components/Map';
import { mechanicsAPI } from '../../api/mechanics';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  MapPin, 
  Phone, 
  Car,
  Wrench,
  Navigation,
  DollarSign,
  User,
  AlertCircle,
  MessageCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import ChatButton from '../../components/ChatButton';
import ChatWindow from '../../components/ChatWindow';
import { getChatByRequest, createOrGetChatByRequest } from '../../api/chat';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';

const MechanicRequests = () => {
  const { user } = useAuth();
  const { socket, acceptRequestViaSocket, rejectRequestViaSocket } = useSocket();
  const [requests, setRequests] = useState([]);
  const [activeTab, setActiveTab] = useState('pending'); // pending, accepted, completed
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [myLocation, setMyLocation] = useState(null); // { lat, lng }
  const [geoWatchId, setGeoWatchId] = useState(null);
  const [activeLocationSharingRequest, setActiveLocationSharingRequest] = useState(null);
  const [openRequestChat, setOpenRequestChat] = useState({ chatId: null, requestId: null });

  useEffect(() => {
    loadRequests();
    // get mechanic's current location once for map display
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: Date.now() });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
    
    // Check if there's an active location sharing request from localStorage
    const activeRequest = localStorage.getItem('active_location_sharing_request');
    if (activeRequest) {
      setActiveLocationSharingRequest(activeRequest);
      console.log('🔄 Restored active location sharing for request:', activeRequest);
    }
    
    // Listen for new requests via Socket.IO
    if (socket) {
      socket.on('newRequest', handleNewRequest);
      socket.on('requestUpdated', handleRequestUpdate);
      
      return () => {
        socket.off('newRequest');
        socket.off('requestUpdated');
      };
    }
  }, [socket, activeTab]);

  // 🚀 AUTO LOCATION SHARING: Handle automatic start/stop events
  useEffect(() => {
    const handleAutoStartLocationSharing = (event) => {
      const { requestId, message } = event.detail;
      console.log('🚀 Auto-starting location sharing for request:', requestId);
      setActiveLocationSharingRequest(requestId);
      startLocationSharing(requestId);
    };

    const handleAutoStopLocationSharing = (event) => {
      const { requestId, message } = event.detail;
      console.log('🛑 Auto-stopping location sharing for request:', requestId);
      setActiveLocationSharingRequest(null);
      stopLocationSharing(requestId);
    };

    // Add event listeners
    window.addEventListener('autoStartLocationSharing', handleAutoStartLocationSharing);
    window.addEventListener('autoStopLocationSharing', handleAutoStopLocationSharing);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('autoStartLocationSharing', handleAutoStartLocationSharing);
      window.removeEventListener('autoStopLocationSharing', handleAutoStopLocationSharing);
    };
  }, []);

  // Cleanup geolocation watch on unmount
  useEffect(() => {
    return () => {
      if (geoWatchId && navigator.geolocation) {
        navigator.geolocation.clearWatch(geoWatchId);
      }
    };
  }, [geoWatchId]);

  const loadRequests = async () => {
    try {
      setIsLoading(true);
      
      // First get mechanic profile to get mechanic ID using the proper API
      const mechanicResponse = await mechanicsAPI.getMyProfile();
      console.log('Mechanic profile response:', mechanicResponse);
      
      // Handle case where mechanic profile doesn't exist (new mechanic)
      if (!mechanicResponse.success || !mechanicResponse.data.mechanic) {
        console.log('No mechanic profile found - this is normal for new mechanics');
        setRequests([]);
        setIsLoading(false);
        return;
      }
      
      const mechanicId = mechanicResponse.data.mechanic._id;
      console.log('Mechanic ID:', mechanicId);
      
      // Get requests for this mechanic
      const requestsResponse = await requestsAPI.getMechanicRequests(mechanicId, {
        status: activeTab === 'pending' ? 'pending' : 
               activeTab === 'accepted' ? 'accepted,on_way,arrived' : 
               'completed'
      });
      console.log('Requests response:', requestsResponse);
      
      if (requestsResponse.success) {
        setRequests(requestsResponse.data.requests || []);
      } else {
        console.error('Failed to load requests:', requestsResponse.message);
        setRequests([]);
      }
    } catch (error) {
      console.error('Load requests error:', error);
      
      // Handle specific error cases
      if (error.response?.status === 404) {
        console.log('Mechanic profile not found - using empty requests for new mechanic');
        setRequests([]);
      } else {
        toast.error('Failed to load service requests');
        setRequests([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewRequest = (requestData) => {
    if (activeTab === 'pending') {
      setRequests(prev => [requestData, ...prev]);
      toast.success('New service request received!');
    }
  };

  const handleRequestUpdate = (updatedRequest) => {
    setRequests(prev => 
      prev.map(req => 
        req._id === updatedRequest._id ? updatedRequest : req
      )
    );
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      setIsProcessing(true);
      
      const response = await requestsAPI.acceptRequest(requestId, {
        estimatedArrivalTime: new Date(Date.now() + 30 * 60000), // 30 minutes from now
        estimatedCost: 800 // Default estimated cost
      });
      
      if (response.success) {
        toast.success('Request accepted successfully!');
        
        // Start sharing location with user
        await startLocationSharing(requestId);
        
        // Ensure chat exists for this request and open it
        try {
          const chat = await createOrGetChatByRequest(requestId);
          setOpenRequestChat({ chatId: chat._id, requestId });
        } catch {}

        // Refresh requests
        loadRequests();
        // Emit socket status update
        try { acceptRequestViaSocket && acceptRequestViaSocket(requestId); } catch (e) {}
        
        // Show user contact info
        const userPhone = response.data.userPhone;
        if (userPhone) {
          toast.success(`Contact user: ${userPhone}`, { duration: 5000 });
        }
      } else {
        toast.error(response.message || 'Failed to accept request');
      }
    } catch (error) {
      console.error('Accept request error:', error);
      toast.error(error.response?.data?.message || 'Failed to accept request');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      setIsProcessing(true);
      
      const response = await requestsAPI.rejectRequest(requestId, 'Currently unavailable');
      
      if (response.success) {
        toast.success('Request rejected');
        loadRequests();
        // Emit socket status update
        try { rejectRequestViaSocket && rejectRequestViaSocket(requestId); } catch (e) {}
      } else {
        toast.error(response.message || 'Failed to reject request');
      }
    } catch (error) {
      console.error('Reject request error:', error);
      toast.error('Failed to reject request');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateStatus = async (requestId, newStatus) => {
    try {
      setIsProcessing(true);
      
      const response = await requestsAPI.updateRequestStatus(requestId, newStatus);
      
      if (response.success) {
        toast.success(`Status updated to ${newStatus}`);
        loadRequests();
        
        if (newStatus === 'completed') {
          // Stop location sharing
          stopLocationSharing(requestId);
        }
      } else {
        toast.error(response.message || 'Failed to update status');
      }
    } catch (error) {
      console.error('Update status error:', error);
      toast.error('Failed to update status');
    } finally {
      setIsProcessing(false);
    }
  };

  const startLocationSharing = async (requestId) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          try {
            await mechanicsAPI.updateLocation([longitude, latitude]);
            
            // Emit location to user via Socket.IO
            if (socket) {
              socket.emit('mechanic:location_update', {
                requestId,
                location: { lat: latitude, lng: longitude },
                timestamp: new Date()
              });
            }
            
            try { localStorage.setItem('active_location_sharing_request', requestId); } catch {}
            toast.success('Location sharing started');
          } catch (error) {
            console.error('Location sharing error:', error);
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
          toast.error('Failed to get location');
        }
      );
      // Begin watch to stream mechanic movement
      const id = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setMyLocation({ lat: latitude, lng: longitude, timestamp: Date.now() });
          if (socket) {
            socket.emit('mechanic:location_update', {
              requestId,
              location: { lat: latitude, lng: longitude },
              timestamp: new Date()
            });
          }
        },
        () => {},
        { enableHighAccuracy: false, maximumAge: 5000, timeout: 15000 }
      );
      setGeoWatchId(id);
    }
  };

  const stopLocationSharing = (requestId) => {
    if (socket) {
      socket.emit('mechanic:location_stop', { requestId });
    }
    if (geoWatchId && navigator.geolocation) {
      navigator.geolocation.clearWatch(geoWatchId);
      setGeoWatchId(null);
    }
    try { localStorage.removeItem('active_location_sharing_request'); } catch {}
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-purple-100 text-purple-800';
      case 'on_way': return 'bg-orange-100 text-orange-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const renderRequestCard = (request) => (
    <motion.div
      key={request._id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-sm border p-6 mb-4"
    >
      {/* Request Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <User className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">
              {request.userId?.name || 'User'}
            </h3>
            <p className="text-sm text-gray-500">
              {new Date(request.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
          {typeof request.status === 'string' ? request.status.replace('_', ' ').toUpperCase() : request.status}
        </span>
      </div>

      {/* Request Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="flex items-center space-x-2">
          <Car className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-700">
            {request.vehicleType?.toUpperCase() || 'VEHICLE'}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <Wrench className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-700">
            {typeof request.problemType === 'string' ? request.problemType.replace('_', ' ').toUpperCase() : (request.problemType || 'SERVICE')}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <MapPin className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-700">
            {request.pickupLocation?.address || 'Location provided'}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <DollarSign className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-700">
            BDT {request.estimatedCost || 500}
          </span>
        </div>
      </div>

      {/* Description */}
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          {request.description || 'Service assistance needed'}
        </p>
      </div>

      {/* Location Sharing Status Indicator */}
      {activeLocationSharingRequest === request._id && (
        <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-green-700 font-medium">📍 Location sharing active</span>
        </div>
      )}

      {/* Live Map when active */}
      {(['accepted','on_way','arrived'].includes(request.status)) && (
        <div className="mb-4">
          <MechanicRequestMap
            request={request}
            mechanicLocation={myLocation ? {
              coordinates: [myLocation.lng, myLocation.lat],
              timestamp: Date.now()
            } : null}
            showRoute={true}
          />
        </div>
      )}

      {/* Contact Info */}
      {request.userId?.phone && (
        <div className="flex items-center space-x-2 mb-4 p-3 bg-gray-50 rounded-lg">
          <Phone className="w-4 h-4 text-green-600" />
          <span className="text-sm font-medium text-gray-900">
            {request.userId.phone}
          </span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-3">
        {request.status === 'pending' && (
          <>
            <button
              onClick={() => handleAcceptRequest(request._id)}
              disabled={isProcessing}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Accept</span>
            </button>
            <button
              onClick={() => handleRejectRequest(request._id)}
              disabled={isProcessing}
              className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              <XCircle className="w-4 h-4" />
              <span>Reject</span>
            </button>
          </>
        )}
        
        {request.status === 'accepted' && (
          <button
            onClick={async () => {
              try {
                setIsProcessing(true);
                await requestsAPI.startJourney(request._id);
                toast.success('Journey started - Location sharing enabled automatically');
                loadRequests();
              } finally { setIsProcessing(false); }
            }}
            disabled={isProcessing}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            <Navigation className="w-4 h-4" />
            <span>Start Journey</span>
          </button>
        )}
        
        {request.status === 'on_way' && (
          <button
            onClick={async () => {
              try {
                setIsProcessing(true);
                await requestsAPI.markArrived(request._id);
                toast.success('Marked as arrived - Location sharing stopped automatically');
                loadRequests();
              } finally { setIsProcessing(false); }
            }}
            disabled={isProcessing}
            className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            <Wrench className="w-4 h-4" />
            <span>Arrived</span>
          </button>
        )}
        
        {request.status === 'arrived' && (
          <button
            onClick={async () => {
              try {
                setIsProcessing(true);
                await requestsAPI.completeRequest(request._id);
                stopLocationSharing(request._id);
                toast.success('Work completed');
                loadRequests();
              } finally { setIsProcessing(false); }
            }}
            disabled={isProcessing}
            className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Complete Work</span>
          </button>
        )}
      </div>

      {/* Professional Chat Bubble Icon for active states */}
      {(['accepted','on_way','arrived','in_progress'].includes(request.status)) && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={async () => {
              try {
                const chat = await getChatByRequest(request._id).catch(async () => await createOrGetChatByRequest(request._id));
                setOpenRequestChat({ chatId: chat._id, requestId: request._id });
              } catch {}
            }}
            className="group relative bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-full w-14 h-14 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 flex items-center justify-center"
            title="Open Chat"
          >
            <MessageCircle className="w-6 h-6 group-hover:scale-110 transition-transform duration-200" />
            
            {/* Professional pulse animation */}
            <div className="absolute inset-0 bg-blue-400 rounded-full opacity-75 animate-ping"></div>
            
            {/* Subtle glow effect */}
            <div className="absolute inset-0 bg-blue-400 rounded-full opacity-0 group-hover:opacity-30 transition-opacity duration-300"></div>
          </button>
        </div>
      )}
    </motion.div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <>
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <h1 className="text-2xl font-bold text-gray-900">Request Management</h1>
            <p className="text-gray-600 mt-1">Manage your service requests</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6">
          {[
            { key: 'pending', label: 'Pending', icon: Clock },
            { key: 'accepted', label: 'Active', icon: Navigation },
            { key: 'completed', label: 'Completed', icon: CheckCircle }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === key
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Requests List */}
        {requests.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No {activeTab} requests
            </h3>
            <p className="text-gray-500">
              {activeTab === 'pending' 
                ? 'New requests will appear here'
                : `No ${activeTab} requests found`
              }
            </p>
          </div>
        ) : (
          <div>
            {requests.map(renderRequestCard)}
          </div>
        )}
      </div>
    </div>

    {/* Per-request Chat Window (contextual) */}
    {openRequestChat.chatId && (
      <div className="fixed bottom-4 right-4 z-50 w-[90vw] md:w-[420px] h-[60vh] md:h-96">
        <ChatWindow chatId={openRequestChat.chatId} requestId={openRequestChat.requestId} onClose={() => setOpenRequestChat({ chatId: null, requestId: null })} />
      </div>
    )}
    </>
  );
};

export default MechanicRequests;
