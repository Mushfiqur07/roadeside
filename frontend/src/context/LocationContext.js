import React, { createContext, useContext, useReducer, useEffect } from 'react';
import toast from 'react-hot-toast';

// Initial state
const initialState = {
  currentLocation: null,
  address: '',
  isLoading: false,
  error: null,
  permissionStatus: 'prompt', // 'granted', 'denied', 'prompt'
  watchId: null
};

// Geocoding cache and rate limiting
const geocodingCache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_DELAY = 1000; // 1 second between requests
let lastGeocodingRequest = 0;
let pendingGeocodingRequests = new Map();

// Action types
const LOCATION_ACTIONS = {
  GET_LOCATION_START: 'GET_LOCATION_START',
  GET_LOCATION_SUCCESS: 'GET_LOCATION_SUCCESS',
  GET_LOCATION_FAILURE: 'GET_LOCATION_FAILURE',
  SET_MANUAL_LOCATION: 'SET_MANUAL_LOCATION',
  CLEAR_LOCATION: 'CLEAR_LOCATION',
  SET_PERMISSION_STATUS: 'SET_PERMISSION_STATUS',
  SET_WATCH_ID: 'SET_WATCH_ID',
  CLEAR_ERROR: 'CLEAR_ERROR'
};

// Reducer
const locationReducer = (state, action) => {
  switch (action.type) {
    case LOCATION_ACTIONS.GET_LOCATION_START:
      return {
        ...state,
        isLoading: true,
        error: null
      };

    case LOCATION_ACTIONS.GET_LOCATION_SUCCESS:
      return {
        ...state,
        currentLocation: action.payload.coordinates,
        address: action.payload.address || state.address,
        isLoading: false,
        error: null
      };

    case LOCATION_ACTIONS.GET_LOCATION_FAILURE:
      return {
        ...state,
        isLoading: false,
        error: action.payload
      };

    case LOCATION_ACTIONS.SET_MANUAL_LOCATION:
      return {
        ...state,
        currentLocation: action.payload.coordinates,
        address: action.payload.address,
        error: null
      };

    case LOCATION_ACTIONS.CLEAR_LOCATION:
      return {
        ...state,
        currentLocation: null,
        address: '',
        error: null
      };

    case LOCATION_ACTIONS.SET_PERMISSION_STATUS:
      return {
        ...state,
        permissionStatus: action.payload
      };

    case LOCATION_ACTIONS.SET_WATCH_ID:
      return {
        ...state,
        watchId: action.payload
      };

    case LOCATION_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null
      };

    default:
      return state;
  }
};

// Helper functions for geocoding optimization
const getCacheKey = (coordinates) => {
  const [lon, lat] = coordinates;
  // Round to 4 decimal places (~11m precision) for cache key
  return `${lat.toFixed(4)},${lon.toFixed(4)}`;
};

const getCachedAddress = (coordinates) => {
  const key = getCacheKey(coordinates);
  const cached = geocodingCache.get(key);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('[Geo] Using cached address for:', key);
    return cached.address;
  }
  
  return null;
};

const setCachedAddress = (coordinates, address) => {
  const key = getCacheKey(coordinates);
  geocodingCache.set(key, {
    address,
    timestamp: Date.now()
  });
  
  // Clean old cache entries (keep cache size manageable)
  if (geocodingCache.size > 100) {
    const oldestKey = geocodingCache.keys().next().value;
    geocodingCache.delete(oldestKey);
  }
};

const shouldRateLimit = () => {
  const now = Date.now();
  const timeSinceLastRequest = now - lastGeocodingRequest;
  return timeSinceLastRequest < RATE_LIMIT_DELAY;
};

const waitForRateLimit = async () => {
  const now = Date.now();
  const timeSinceLastRequest = now - lastGeocodingRequest;
  
  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    const waitTime = RATE_LIMIT_DELAY - timeSinceLastRequest;
    console.log(`[Geo] Rate limiting: waiting ${waitTime}ms`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastGeocodingRequest = Date.now();
};

// Create context
const LocationContext = createContext();

// Location provider component
export const LocationProvider = ({ children }) => {
  const [state, dispatch] = useReducer(locationReducer, initialState);

  // Cleanup watch on unmount and clear caches
  useEffect(() => {
    return () => {
      if (state.watchId) {
        navigator.geolocation.clearWatch(state.watchId);
      }
      
      // Clear pending requests on unmount to prevent memory leaks
      pendingGeocodingRequests.clear();
    };
  }, [state.watchId]);

  // Get current location using browser geolocation
  const getCurrentLocation = async (options = {}) => {
    if (!navigator.geolocation) {
      const error = 'Geolocation is not supported by this browser';
      dispatch({
        type: LOCATION_ACTIONS.GET_LOCATION_FAILURE,
        payload: error
      });
      toast.error(error);
      return { success: false, error };
    }

    dispatch({ type: LOCATION_ACTIONS.GET_LOCATION_START });

    const defaultOptions = {
      enableHighAccuracy: false, // Use false for faster response
      timeout: 15000, // Increased timeout to 15 seconds
      maximumAge: 600000, // 10 minutes - allow cached location
      ...options
    };

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const coordinates = [
            position.coords.longitude,
            position.coords.latitude
          ];

          try {
            console.log('[Geo] User coordinates from navigator:', {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
            
            // Try to get address from coordinates, but don't fail if it doesn't work
            let address = '';
            try {
              address = await reverseGeocode(coordinates);
            } catch (geocodeError) {
              console.warn('[Geo] Reverse geocoding failed, continuing without address:', geocodeError.message);
              // Use coordinates as fallback address
              address = `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`;
            }
            
            dispatch({
              type: LOCATION_ACTIONS.GET_LOCATION_SUCCESS,
              payload: { coordinates, address }
            });

            dispatch({
              type: LOCATION_ACTIONS.SET_PERMISSION_STATUS,
              payload: 'granted'
            });

            resolve({ success: true, coordinates, address });
          } catch (error) {
            // This should never happen since we handle geocoding errors above
            console.error('[Geo] Unexpected error in location success handler:', error);
            dispatch({
              type: LOCATION_ACTIONS.GET_LOCATION_SUCCESS,
              payload: { coordinates, address: `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}` }
            });

            dispatch({
              type: LOCATION_ACTIONS.SET_PERMISSION_STATUS,
              payload: 'granted'
            });

            resolve({ success: true, coordinates, address: `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}` });
          }
        },
        (error) => {
          console.warn('[Geo] Geolocation error:', error?.message);
          let errorMessage = 'Failed to get location';
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied by user';
              dispatch({
                type: LOCATION_ACTIONS.SET_PERMISSION_STATUS,
                payload: 'denied'
              });
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information is unavailable';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out - trying with lower accuracy';
              console.log('[Geo] Timeout occurred, retrying with lower accuracy...');
              
              // Retry with lower accuracy settings
              navigator.geolocation.getCurrentPosition(
                async (position) => {
                  const coordinates = [
                    position.coords.longitude,
                    position.coords.latitude
                  ];
                  
                  try {
                    const address = await reverseGeocode(coordinates);
                    dispatch({
                      type: LOCATION_ACTIONS.GET_LOCATION_SUCCESS,
                      payload: { coordinates, address }
                    });
                    dispatch({
                      type: LOCATION_ACTIONS.SET_PERMISSION_STATUS,
                      payload: 'granted'
                    });
                    resolve({ success: true, coordinates, address });
                  } catch (geocodeError) {
                    dispatch({
                      type: LOCATION_ACTIONS.GET_LOCATION_SUCCESS,
                      payload: { coordinates, address: '' }
                    });
                    dispatch({
                      type: LOCATION_ACTIONS.SET_PERMISSION_STATUS,
                      payload: 'granted'
                    });
                    resolve({ success: true, coordinates, address: '' });
                  }
                },
                (retryError) => {
                  console.error('[Geo] Retry also failed:', retryError);
                  dispatch({
                    type: LOCATION_ACTIONS.GET_LOCATION_FAILURE,
                    payload: 'Location timeout - please enable location or try again'
                  });
                  toast.error('Location timeout - please enable location or try again');
                  resolve({ success: false, error: 'Location timeout - please enable location or try again' });
                },
                {
                  enableHighAccuracy: false,
                  timeout: 30000, // 30 seconds for retry
                  maximumAge: 900000 // 15 minutes - very permissive
                }
              );
              return; // Don't continue with original error handling
            default:
              errorMessage = 'An unknown error occurred while getting location';
              break;
          }

          dispatch({
            type: LOCATION_ACTIONS.GET_LOCATION_FAILURE,
            payload: errorMessage
          });

          toast.error(errorMessage);
          resolve({ success: false, error: errorMessage });
        },
        defaultOptions
      );
    });
  };

  // Watch position for real-time updates with optimized geocoding
  const watchPosition = (callback, options = {}) => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by this browser');
      return null;
    }

    const defaultOptions = {
      enableHighAccuracy: false, // Use false for better reliability
      timeout: 20000, // Increased timeout to 20 seconds
      maximumAge: 300000, // 5 minutes - allow cached location for longer
      ...options
    };

    let lastGeocodedPosition = null;
    const GEOCODING_THRESHOLD = 100; // Only geocode if moved more than 100 meters

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const coordinates = [
          position.coords.longitude,
          position.coords.latitude
        ];
        
        console.log('[Geo] Watch position update:', {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });

        // Check if we need to geocode (only if moved significantly)
        let shouldGeocode = true;
        if (lastGeocodedPosition) {
          const distance = calculateDistance(
            [lastGeocodedPosition.longitude, lastGeocodedPosition.latitude],
            coordinates
          );
          shouldGeocode = distance * 1000 > GEOCODING_THRESHOLD; // Convert km to meters
          
          if (!shouldGeocode) {
            console.log(`[Geo] Skipping geocoding - moved only ${Math.round(distance * 1000)}m`);
          }
        }

        try {
          let address = '';
          
          if (shouldGeocode) {
            address = await reverseGeocode(coordinates);
            lastGeocodedPosition = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            };
          } else {
            // Use cached address from state
            address = state.address || '';
          }
          
          dispatch({
            type: LOCATION_ACTIONS.GET_LOCATION_SUCCESS,
            payload: { coordinates, address }
          });

          if (callback) {
            callback({ coordinates, address });
          }
        } catch (error) {
          console.error('[Geo] Geocoding failed in watch position:', error);
          
          dispatch({
            type: LOCATION_ACTIONS.GET_LOCATION_SUCCESS,
            payload: { coordinates, address: state.address || '' }
          });

          if (callback) {
            callback({ coordinates, address: state.address || '' });
          }
        }
      },
      (error) => {
        console.error('Watch position error:', error);
        if (callback) {
          callback({ error: error.message });
        }
      },
      defaultOptions
    );

    dispatch({
      type: LOCATION_ACTIONS.SET_WATCH_ID,
      payload: watchId
    });

    return watchId;
  };

  // Stop watching position
  const stopWatching = () => {
    if (state.watchId) {
      navigator.geolocation.clearWatch(state.watchId);
      dispatch({
        type: LOCATION_ACTIONS.SET_WATCH_ID,
        payload: null
      });
    }
  };

  // Set location manually (from address input or map click)
  const setManualLocation = async (coordinates, address = '') => {
    try {
      let finalAddress = address;
      
      // If no address provided, try to get it from coordinates
      if (!address && coordinates) {
        try {
          finalAddress = await reverseGeocode(coordinates);
        } catch (error) {
          console.warn('Failed to get address from coordinates:', error);
        }
      }

      dispatch({
        type: LOCATION_ACTIONS.SET_MANUAL_LOCATION,
        payload: { coordinates, address: finalAddress }
      });

      return { success: true, coordinates, address: finalAddress };
    } catch (error) {
      const errorMessage = 'Failed to set location';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // Geocode address to coordinates
  const geocodeAddress = async (address) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=bd&limit=1`
      );
      
      const data = await response.json();
      
      if (data && data.length > 0) {
        const result = data[0];
        const coordinates = [parseFloat(result.lon), parseFloat(result.lat)];
        
        return {
          success: true,
          coordinates,
          address: result.display_name,
          boundingBox: result.boundingbox
        };
      } else {
        throw new Error('Address not found');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      return {
        success: false,
        error: 'Failed to find address'
      };
    }
  };

  // Reverse geocode coordinates to address with multiple fallbacks
  const reverseGeocode = async (coordinates) => {
    const [longitude, latitude] = coordinates;
    const cacheKey = getCacheKey(coordinates);
    
    // Check cache first
    const cachedAddress = getCachedAddress(coordinates);
    if (cachedAddress) {
      return cachedAddress;
    }
    
    // Check if there's already a pending request for this location
    if (pendingGeocodingRequests.has(cacheKey)) {
      console.log('[Geo] Waiting for existing request for:', cacheKey);
      return await pendingGeocodingRequests.get(cacheKey);
    }
    
    // Create the geocoding promise
    const geocodingPromise = (async () => {
      try {
        // Apply rate limiting
        await waitForRateLimit();
        
        // List of geocoding services to try
        const geocodingServices = [
          {
            name: 'Nominatim-BD',
            url: `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&countrycodes=bd&addressdetails=1&zoom=18`,
            headers: {
              'User-Agent': 'RoadAssist-BD/1.0'
            }
          },
          {
            name: 'Nominatim-Global',
            url: `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&zoom=16`,
            headers: {
              'User-Agent': 'RoadAssist-BD/1.0'
            }
          }
        ];

        for (const service of geocodingServices) {
          try {
            console.log(`[Geo] Trying ${service.name} for reverse geocoding...`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
              controller.abort();
            }, 5000); // Reduced timeout to 5 seconds
            
            const response = await fetch(service.url, {
              headers: service.headers,
              signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            let address = null;
            
            if (data && data.display_name) {
              address = data.display_name;
              console.log(`[Geo] Successfully geocoded with ${service.name}`);
            } else if (data && data.address) {
              // Construct address from components
              const addressParts = [];
              if (data.address.house_number) addressParts.push(data.address.house_number);
              if (data.address.road) addressParts.push(data.address.road);
              if (data.address.neighbourhood) addressParts.push(data.address.neighbourhood);
              if (data.address.suburb) addressParts.push(data.address.suburb);
              if (data.address.city) addressParts.push(data.address.city);
              if (data.address.state) addressParts.push(data.address.state);
              if (data.address.country) addressParts.push(data.address.country);
              
              if (addressParts.length > 0) {
                address = addressParts.join(', ');
                console.log(`[Geo] Constructed address with ${service.name}: ${address}`);
              }
            }
            
            if (address) {
              // Cache the successful result
              setCachedAddress(coordinates, address);
              return address;
            }
            
            console.warn(`[Geo] ${service.name} returned no usable address data`);
            
          } catch (error) {
            console.warn(`[Geo] ${service.name} failed:`, error.message);
            
            if (error.name === 'AbortError') {
              console.warn(`[Geo] ${service.name} request timed out`);
            }
            
            // Continue to next service
            continue;
          }
        }
        
        // All services failed, return a generic location description
        console.warn('[Geo] All geocoding services failed, using coordinate-based description');
        const fallbackAddress = `Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        
        // Cache the fallback result for a shorter time
        geocodingCache.set(cacheKey, {
          address: fallbackAddress,
          timestamp: Date.now() - (CACHE_DURATION - 60000) // Cache for only 1 minute
        });
        
        return fallbackAddress;
        
      } finally {
        // Remove from pending requests
        pendingGeocodingRequests.delete(cacheKey);
      }
    })();
    
    // Store the promise to prevent duplicate requests
    pendingGeocodingRequests.set(cacheKey, geocodingPromise);
    
    return geocodingPromise;
  };

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = (coords1, coords2) => {
    const [lon1, lat1] = coords1;
    const [lon2, lat2] = coords2;
    
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    return Math.round(distance * 100) / 100; // Round to 2 decimal places
  };

  // Clear location data
  const clearLocation = () => {
    dispatch({ type: LOCATION_ACTIONS.CLEAR_LOCATION });
  };

  // Clear error
  const clearError = () => {
    dispatch({ type: LOCATION_ACTIONS.CLEAR_ERROR });
  };

  // Clear geocoding cache (useful for debugging or memory management)
  const clearGeocodingCache = () => {
    console.log('[Geo] Clearing geocoding cache');
    geocodingCache.clear();
    pendingGeocodingRequests.clear();
  };

  // Check if location is available
  const hasLocation = () => {
    return state.currentLocation !== null;
  };

  // Get formatted coordinates string
  const getFormattedCoordinates = () => {
    if (!state.currentLocation) return '';
    const [lon, lat] = state.currentLocation;
    return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
  };

  const value = {
    // State
    ...state,
    
    // Actions
    getCurrentLocation,
    watchPosition,
    stopWatching,
    setManualLocation,
    geocodeAddress,
    reverseGeocode,
    calculateDistance,
    clearLocation,
    clearError,
    clearGeocodingCache,
    
    // Helpers
    hasLocation,
    getFormattedCoordinates
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
};

// Custom hook to use location context
export const useLocation = () => {
  const context = useContext(LocationContext);
  
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  
  return context;
};

export default LocationContext;
