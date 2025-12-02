import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import { useLocation } from '../context/LocationContext';
import { 
  MapPin, 
  Navigation, 
  Crosshair, 
  Loader,
  AlertCircle 
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Professional custom icons
const createCustomIcon = (color = '#3B82F6', size = 'medium', type = 'default') => {
  const sizes = {
    small: [24, 32],
    medium: [32, 42],
    large: [40, 52]
  };
  
  const iconTypes = {
    user: '👤',
    mechanic: '🔧',
    garage: '🏪',
    default: '📍'
  };
  
  const icon = iconTypes[type] || iconTypes.default;
  
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: ${sizes[size][0]}px;
        height: ${sizes[size][1]}px;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));
      ">
        <!-- Pin body -->
        <div style="
          width: ${sizes[size][0]}px;
          height: ${sizes[size][0]}px;
          background: linear-gradient(135deg, ${color} 0%, ${color}dd 100%);
          border: 3px solid white;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          position: absolute;
          top: 0;
        "></div>
        <!-- Icon -->
        <div style="
          font-size: ${size === 'small' ? '12px' : size === 'medium' ? '14px' : '16px'};
          z-index: 1;
          transform: rotate(0deg);
          margin-top: -4px;
        ">${icon}</div>
      </div>
    `,
    iconSize: sizes[size],
    iconAnchor: [sizes[size][0] / 2, sizes[size][1] - 4]
  });
};

// Create mechanic icon specifically
const createMechanicIcon = (isAvailable = true, size = 'medium') => {
  const color = isAvailable ? '#10B981' : '#6B7280';
  return createCustomIcon(color, size, 'mechanic');
};

// Create user icon specifically  
const createUserIcon = (size = 'medium') => {
  return createCustomIcon('#3B82F6', size, 'user');
};

// Map event handler component
const MapEventHandler = ({ onLocationSelect, onMapReady }) => {
  const map = useMap();

  useMapEvents({
    click: (e) => {
      if (onLocationSelect) {
        onLocationSelect(e.latlng);
      }
    }
  });

  useEffect(() => {
    if (onMapReady) {
      onMapReady(map);
    }
  }, [map, onMapReady]);

  return null;
};

// Center updater to react to center changes after mount
const CenterUpdater = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (center && Array.isArray(center) && center.length === 2) {
      map.setView(center, zoom || map.getZoom());
    }
  }, [center, zoom, map]);
  return null;
};

// Location control component
const LocationControl = ({ onLocationFound, isLoading }) => {
  const map = useMap();

  const handleGetLocation = () => {
    if (isLoading) return;
    
    map.locate({
      setView: true,
      maxZoom: 16,
      enableHighAccuracy: false,
      timeout: 15000
    });
  };

  useEffect(() => {
    const handleLocationFoundEvent = (e) => {
      if (onLocationFound) {
        onLocationFound(e.latlng, e.accuracy);
      }
    };

    const onLocationError = (e) => {
      console.error('Location error:', e.message);
    };

    map.on('locationfound', handleLocationFoundEvent);
    map.on('locationerror', onLocationError);

    return () => {
      map.off('locationfound', handleLocationFoundEvent);
      map.off('locationerror', onLocationError);
    };
  }, [map, onLocationFound]);

  return (
    <div className="leaflet-top leaflet-right">
      <div className="leaflet-control leaflet-bar">
        <button
          onClick={handleGetLocation}
          disabled={isLoading}
          className="bg-white hover:bg-gray-50 border-0 w-8 h-8 flex items-center justify-center cursor-pointer disabled:opacity-50"
          title="Get current location"
        >
          {isLoading ? (
            <Loader className="w-4 h-4 animate-spin text-gray-600" />
          ) : (
            <Crosshair className="w-4 h-4 text-gray-600" />
          )}
        </button>
      </div>
    </div>
  );
};

const Map = ({
  center,
  zoom = 13,
  height = '400px',
  markers = [],
  onLocationSelect,
  onMapReady,
  showLocationControl = true,
  showUserLocation = true,
  clickable = false,
  className = '',
  polylinePositions = null
}) => {
  const { currentLocation, getCurrentLocation, reverseGeocode, address } = useLocation();
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [mapCenter, setMapCenter] = useState(center || null);
  const [mapZoom, setMapZoom] = useState(zoom);
  const [locationDenied, setLocationDenied] = useState(false);

  // Keep internal center/zoom in sync with props so map can mount immediately and recenter later
  useEffect(() => {
    if (Array.isArray(center) && center.length === 2 && Number.isFinite(center[0]) && Number.isFinite(center[1])) {
      setMapCenter(center);
    }
  }, [center]);

  useEffect(() => {
    if (typeof zoom === 'number' && Number.isFinite(zoom)) {
      setMapZoom(zoom);
    }
  }, [zoom]);

  useEffect(() => {
    // Support both { coordinates: [lng,lat] } and raw [lng,lat]
    const coords = currentLocation && (currentLocation.coordinates || currentLocation);
    if (coords && showUserLocation && Array.isArray(coords) && coords.length >= 2) {
      setMapCenter([coords[1], coords[0]]);
      setMapZoom(15);
    }
  }, [currentLocation, showUserLocation]);

  // On mount: try to get geolocation if no explicit center provided
  useEffect(() => {
    if (!center && showUserLocation && !mapCenter) {
      if ('geolocation' in navigator) {
        setIsGettingLocation(true);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setIsGettingLocation(false);
            setLocationDenied(false);
            const { latitude, longitude } = pos.coords;
            setMapCenter([latitude, longitude]);
            setMapZoom(15);
          },
          (err) => {
            setIsGettingLocation(false);
            setLocationDenied(true);
            console.warn('Geolocation denied or failed:', err.message);
          },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
        );
      } else {
        setLocationDenied(true);
      }
    }
  }, [center, showUserLocation, mapCenter]);

  const handleLocationFound = async (latlng, accuracy) => {
    try {
      setIsGettingLocation(true);
      await getCurrentLocation();
      setMapCenter([latlng.lat, latlng.lng]);
      setMapZoom(16);
    } catch (error) {
      console.error('Failed to get location:', error);
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleLocationSelect = async (latlng) => {
    if (onLocationSelect) {
      try {
        let address;
        
        if (reverseGeocode) {
          // Use the optimized reverseGeocode from LocationContext
          address = await reverseGeocode([latlng.lng, latlng.lat]);
        } else {
          // Fallback to direct API call with timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}&zoom=18&addressdetails=1`,
            { signal: controller.signal }
          );
          
          clearTimeout(timeoutId);
          const data = await response.json();
          address = data.display_name || `${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`;
        }
        
        onLocationSelect({
          coordinates: [latlng.lng, latlng.lat],
          address,
          latlng
        });
      } catch (error) {
        console.error('Reverse geocoding failed:', error);
        onLocationSelect({
          coordinates: [latlng.lng, latlng.lat],
          address: `${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`,
          latlng
        });
      }
    }
  };

  return (
    <div className={`relative ${className}`} style={{ height }}>
      <MapContainer
        center={mapCenter || [23.8103, 90.4125]}
        zoom={mapZoom}
        style={{ height: '100%', width: '100%' }}
        className="rounded-lg"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {/* Map event handler */}
        <MapEventHandler
          onLocationSelect={clickable ? handleLocationSelect : null}
          onMapReady={onMapReady}
        />
        <CenterUpdater center={mapCenter} zoom={mapZoom} />

        {/* Location control */}
        {showLocationControl && (
          <LocationControl
            onLocationFound={handleLocationFound}
            isLoading={isGettingLocation}
          />
        )}

        {/* User's current location marker */}
        {(() => {
          const coords = currentLocation && (currentLocation.coordinates || currentLocation);
          return coords && showUserLocation && coords.length >= 2;
        })() && (
          <Marker
            position={(() => {
              const coords = currentLocation.coordinates || currentLocation;
              return [coords[1], coords[0]];
            })()}
            icon={createUserIcon('large')}
          >
            <Popup>
              <div className="text-center">
                <div className="flex items-center space-x-2 mb-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <span className="font-medium">Your Location</span>
                </div>
                {address && (
                  <p className="text-sm text-gray-600">{address}</p>
                )}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Custom markers */}
        {markers.map((marker, index) => {
          const MarkerIcon = marker.icon || createCustomIcon(marker.color || '#3B82F6', marker.size || 'medium');
          
          return (
            <Marker
              key={marker.id || index}
              position={[marker.lat, marker.lng]}
              icon={MarkerIcon}
              eventHandlers={marker.onClick ? { click: marker.onClick } : undefined}
            >
              {marker.popup && (
                <Popup>
                  {typeof marker.popup === 'string' ? (
                    <div>{marker.popup}</div>
                  ) : (
                    marker.popup
                  )}
                </Popup>
              )}
            </Marker>
          );
        })}

        {/* Optional polyline between two points */}
        {Array.isArray(polylinePositions) && polylinePositions.length === 2 && (
          <Polyline positions={polylinePositions} color="#2563EB" />
        )}
      </MapContainer>

      {/* Click instruction overlay */}
      {clickable && (
        <div className="absolute top-4 left-4 bg-white bg-opacity-90 backdrop-blur-sm rounded-lg p-3 shadow-lg z-[1000]">
          <div className="flex items-center space-x-2 text-sm text-gray-700">
            <Navigation className="w-4 h-4" />
            <span>Click on the map to select a location</span>
          </div>
        </div>
      )}

      {/* Geolocation denied overlay */}
      {locationDenied && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-[1000] rounded-lg">
          <div className="bg-white rounded-lg p-4 flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-sm text-gray-700">Please allow location access</span>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {isGettingLocation && (
        <div className="absolute inset-0 bg-black bg-opacity-25 flex items-center justify-center z-[1000] rounded-lg">
          <div className="bg-white rounded-lg p-4 flex items-center space-x-3">
            <Loader className="w-5 h-5 animate-spin text-primary-600" />
            <span className="text-sm text-gray-700">Getting your location...</span>
          </div>
        </div>
      )}
    </div>
  );
};

// Specialized map components
export const MechanicFinderMap = ({ mechanics = [], onMechanicSelect, userLocation, radiusKm = 20 }) => {
  const [polyline, setPolyline] = useState(null);
  const toLatLng = (coords) => coords && coords.length >= 2 ? { lat: coords[1], lng: coords[0] } : null;
  const haversineKm = (a, b) => {
    if (!a || !b) return null;
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const lat1 = a.lat * Math.PI / 180;
    const lat2 = b.lat * Math.PI / 180;
    const x = Math.sin(dLat/2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng/2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  };

  // Accept both [lng,lat] array or { coordinates: [lng,lat] }
  const userLatLng = Array.isArray(userLocation)
    ? toLatLng(userLocation)
    : (userLocation && userLocation.coordinates ? toLatLng(userLocation.coordinates) : null);

  // Map mechanics to coordinates and compute distance, filter by provided radius
  const mechanicsWithinRadius = mechanics
    .map(m => {
      // Prefer currentLocation, fallback to garage location
      const currentCoords = m.currentLocation?.coordinates;
      const garageCoords = m.garage?.location?.coordinates;
      const isZero = (c) => !c || c.length < 2 || (c[0] === 0 && c[1] === 0);
      const coords = !isZero(currentCoords) ? currentCoords : (!isZero(garageCoords) ? garageCoords : null);
      
      const mechLatLng = toLatLng(coords);
      const distance = userLatLng && mechLatLng ? haversineKm(userLatLng, mechLatLng) : null;
      return { m, mechLatLng, distance };
    })
    .filter(x => x.mechLatLng && (x.distance === null || x.distance <= radiusKm));

  const mechanicMarkers = mechanicsWithinRadius.map(({ m, mechLatLng, distance }) => ({
    id: m._id,
    lat: mechLatLng.lat,
    lng: mechLatLng.lng,
    icon: createMechanicIcon(m.isAvailable, 'medium'),
    onClick: () => {
      // Clear any existing polyline first
      setPolyline(null);
      
      // Draw polyline ONLY between user and the selected mechanic
      if (userLatLng && mechLatLng) {
        setTimeout(() => {
          setPolyline([
            [userLatLng.lat, userLatLng.lng],
            [mechLatLng.lat, mechLatLng.lng]
          ]);
        }, 100);
      }
      if (onMechanicSelect) onMechanicSelect(m);
    },
    popup: (
      <div className="text-center min-w-[200px]">
        <div className="flex items-center space-x-2 mb-2">
          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
            <span className="text-primary-600 font-medium text-sm">
              {m.userId?.name?.charAt(0)}
            </span>
          </div>
          <div className="text-left">
            <p className="font-medium">{m.userId?.name}</p>
            <div className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${m.isAvailable ? 'bg-green-500' : 'bg-gray-400'}`} />
              <span className="text-xs text-gray-600">
                {m.isAvailable ? 'Available' : 'Busy'}
              </span>
            </div>
          </div>
        </div>
        <div className="text-left space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Rating:</span>
            <div className="flex items-center space-x-1">
              <span className="font-medium">{m.rating}</span>
              <span className="text-yellow-400">★</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Experience:</span>
            <span className="font-medium">{m.experience} years</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Distance:</span>
            <span className="font-medium">{(distance ?? 0).toFixed(1)} km</span>
          </div>
        </div>
        {onMechanicSelect && (
          <button
            onClick={() => onMechanicSelect(m)}
            className="w-full mt-3 bg-primary-500 text-white px-3 py-1 rounded text-sm hover:bg-primary-600 transition-colors"
          >
            Send Request
          </button>
        )}
      </div>
    )
  })).filter(marker => Number.isFinite(marker.lat) && Number.isFinite(marker.lng));

  const center = userLocation && userLocation.coordinates && userLocation.coordinates.length >= 2
    ? [userLocation.coordinates[1], userLocation.coordinates[0]]
    : undefined;

  return (
    <Map
      center={center}
      zoom={14}
      markers={mechanicMarkers}
      showUserLocation={!!userLocation}
      polylinePositions={polyline}
      height="400px"
    />
  );
};

export const RequestTrackingMap = ({ request, mechanicLocation, userLocation, showUserCurrentLocation = false }) => {
  const markers = [];
  let polylinePositions = null;

  // Add pickup location marker (always show this)
  if (request?.pickupLocation && request.pickupLocation.coordinates && request.pickupLocation.coordinates.length >= 2) {
    markers.push({
      id: 'pickup',
      lat: request.pickupLocation.coordinates[1],
      lng: request.pickupLocation.coordinates[0],
      icon: createUserIcon('large'),
      popup: (
        <div className="text-center">
          <div className="flex items-center space-x-2 mb-2">
            <MapPin className="w-4 h-4 text-blue-600" />
            <span className="font-medium">Pickup Location</span>
          </div>
          <p className="text-sm text-gray-600">{request.pickupLocation.address}</p>
        </div>
      )
    });
  }

  // Add user's current location marker (if different from pickup and available)
  if (showUserCurrentLocation && userLocation) {
    const userCoords = userLocation.coordinates || userLocation;
    if (userCoords && userCoords.length >= 2) {
      markers.push({
        id: 'user-current',
        lat: userCoords[1],
        lng: userCoords[0],
        icon: createCustomIcon('#10B981', 'large'), // Green for current user location
        popup: (
          <div className="text-center">
            <div className="flex items-center space-x-2 mb-2">
              <MapPin className="w-4 h-4 text-green-600" />
              <span className="font-medium">Your Current Location</span>
            </div>
            <p className="text-xs text-gray-400">
              Updated: {new Date(userLocation.timestamp || Date.now()).toLocaleTimeString()}
            </p>
          </div>
        )
      });
    }
  }

  // Add mechanic location marker
  if (mechanicLocation) {
    let mechCoords = null;
    
    // Handle different mechanic location formats
    if (mechanicLocation.coordinates && mechanicLocation.coordinates.length >= 2) {
      mechCoords = mechanicLocation.coordinates;
    } else if (mechanicLocation.lat && mechanicLocation.lng) {
      mechCoords = [mechanicLocation.lng, mechanicLocation.lat];
    }

    if (mechCoords) {
      markers.push({
        id: 'mechanic',
        lat: mechCoords[1],
        lng: mechCoords[0],
        icon: createMechanicIcon(true, 'large'),
        popup: (
          <div className="text-center">
            <div className="flex items-center space-x-2 mb-2">
              <Navigation className="w-4 h-4 text-green-600" />
              <span className="font-medium">Mechanic Location</span>
            </div>
            <p className="text-sm text-gray-600">
              Updated: {new Date(mechanicLocation.timestamp || Date.now()).toLocaleTimeString()}
            </p>
          </div>
        )
      });

      // Draw polyline between pickup location and mechanic
      if (request?.pickupLocation && request.pickupLocation.coordinates && request.pickupLocation.coordinates.length >= 2) {
        polylinePositions = [
          [request.pickupLocation.coordinates[1], request.pickupLocation.coordinates[0]],
          [mechCoords[1], mechCoords[0]]
        ];
      }
    }
  }

  // Determine map center - prefer mechanic location, then pickup location
  let center = [23.8103, 90.4125]; // Default Dhaka center
  
  if (mechanicLocation) {
    const mechCoords = mechanicLocation.coordinates || 
      (mechanicLocation.lat && mechanicLocation.lng ? [mechanicLocation.lng, mechanicLocation.lat] : null);
    if (mechCoords && mechCoords.length >= 2) {
      center = [mechCoords[1], mechCoords[0]];
    }
  } else if (request?.pickupLocation && request.pickupLocation.coordinates) {
    center = [request.pickupLocation.coordinates[1], request.pickupLocation.coordinates[0]];
  }

  return (
    <Map
      center={center}
      zoom={14}
      markers={markers}
      polylinePositions={polylinePositions}
      height="300px"
      showUserLocation={false}
    />
  );
};

export const MechanicRequestMap = ({ request, mechanicLocation, showRoute = true }) => {
  const markers = [];
  let polylinePositions = null;

  // Add user pickup location marker
  if (request?.pickupLocation && request.pickupLocation.coordinates && request.pickupLocation.coordinates.length >= 2) {
    markers.push({
      id: 'user-pickup',
      lat: request.pickupLocation.coordinates[1],
      lng: request.pickupLocation.coordinates[0],
      icon: createUserIcon('large'),
      popup: (
        <div className="text-center">
          <div className="flex items-center space-x-2 mb-2">
            <MapPin className="w-4 h-4 text-blue-600" />
            <span className="font-medium">Customer Location</span>
          </div>
          <p className="text-sm text-gray-600">{request.pickupLocation.address}</p>
          <p className="text-xs text-gray-400 mt-1">
            Customer: {request.userId?.name || 'User'}
          </p>
        </div>
      )
    });
  }

  // Add mechanic's current location marker
  if (mechanicLocation) {
    let mechCoords = null;
    
    // Handle different mechanic location formats
    if (mechanicLocation.coordinates && mechanicLocation.coordinates.length >= 2) {
      mechCoords = mechanicLocation.coordinates;
    } else if (mechanicLocation.lat && mechanicLocation.lng) {
      mechCoords = [mechanicLocation.lng, mechanicLocation.lat];
    }

    if (mechCoords) {
      markers.push({
        id: 'mechanic-current',
        lat: mechCoords[1],
        lng: mechCoords[0],
        icon: createMechanicIcon(true, 'large'),
        popup: (
          <div className="text-center">
            <div className="flex items-center space-x-2 mb-2">
              <Navigation className="w-4 h-4 text-green-600" />
              <span className="font-medium">Your Location</span>
            </div>
            <p className="text-sm text-gray-600">
              Updated: {new Date(mechanicLocation.timestamp || Date.now()).toLocaleTimeString()}
            </p>
          </div>
        )
      });

      // Draw route between mechanic and customer if both locations exist and showRoute is true
      if (showRoute && request?.pickupLocation && request.pickupLocation.coordinates && request.pickupLocation.coordinates.length >= 2) {
        polylinePositions = [
          [mechCoords[1], mechCoords[0]], // Mechanic location
          [request.pickupLocation.coordinates[1], request.pickupLocation.coordinates[0]] // Customer location
        ];
      }
    }
  }

  // Determine map center - prefer mechanic location, then customer location
  let center = [23.8103, 90.4125]; // Default Dhaka center
  
  if (mechanicLocation) {
    const mechCoords = mechanicLocation.coordinates || 
      (mechanicLocation.lat && mechanicLocation.lng ? [mechanicLocation.lng, mechanicLocation.lat] : null);
    if (mechCoords && mechCoords.length >= 2) {
      center = [mechCoords[1], mechCoords[0]];
    }
  } else if (request?.pickupLocation && request.pickupLocation.coordinates) {
    center = [request.pickupLocation.coordinates[1], request.pickupLocation.coordinates[0]];
  }

  return (
    <Map
      center={center}
      zoom={14}
      markers={markers}
      polylinePositions={polylinePositions}
      height="300px"
      showUserLocation={false}
    />
  );
};

export const LocationPickerMap = ({ onLocationSelect, initialLocation }) => {
  const center = initialLocation && initialLocation.coordinates && initialLocation.coordinates.length >= 2
    ? [initialLocation.coordinates[1], initialLocation.coordinates[0]]
    : undefined;

  return (
    <Map
      center={center}
      zoom={15}
      onLocationSelect={onLocationSelect}
      clickable={true}
      showUserLocation={true}
      height="300px"
    />
  );
};

export default Map;
