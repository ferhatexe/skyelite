import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import api from '../services/api';
import { Courier, LocationHistory } from '../types';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  LogOut, 
  Trash2, 
  Copy, 
  Check, 
  Search, 
  Clock, 
  Compass, 
  Zap,
  Navigation,
  RefreshCw,
  Menu,
  X,
  Activity
} from 'lucide-react';

const DEFAULT_CENTER = {
  lat: 41.0357641, // Prof. Dr. Necmettin Erbakan Parkı, Esenyurt Kıraç
  lng: 28.6448295,
};

const COURIER_COLORS = [
  { primary: '#0ea5e9', fill: '#0284c7' }, // Sky Blue
  { primary: '#10b981', fill: '#047857' }, // Emerald Green
  { primary: '#f59e0b', fill: '#b58000' }, // Amber Orange
  { primary: '#ec4899', fill: '#c026d3' }, // Pink
  { primary: '#8b5cf6', fill: '#6d28d9' }, // Violet Purple
  { primary: '#f43f5e', fill: '#e11d48' }, // Rose Red
  { primary: '#14b8a6', fill: '#0d9488' }, // Teal
  { primary: '#a855f7', fill: '#9333ea' }, // Purple
  { primary: '#eab308', fill: '#ca8a04' }, // Yellow Gold
  { primary: '#3b82f6', fill: '#2563eb' }, // Blue
];

export const AdminDashboard: React.FC = () => {
  const { state: authState, logout } = useAuth();
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [selectedCourierId, setSelectedCourierId] = useState<number | null>(null);
  const [selectedCourierHistory, setSelectedCourierHistory] = useState<LocationHistory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [infoWindowCourier, setInfoWindowCourier] = useState<Courier | null>(null);

  const [copiedCourierId, setCopiedCourierId] = useState<number | null>(null);

  // Custom Map Layer States
  const [activeLayer, setActiveLayer] = useState<'google_street' | 'google_hybrid' | 'dark' | 'osm'>('dark');
  const [showLayersDropdown, setShowLayersDropdown] = useState(false);
  const [showMobileList, setShowMobileList] = useState(false);
  const [showMobileDetails, setShowMobileDetails] = useState(false);

  const [pullingCourierId, setPullingCourierId] = useState<number | null>(null);

  const requestCourierLocation = (courierId: number) => {
    if (socket && isConnected) {
      socket.emit('request_courier_location', { courierId });
      setPullingCourierId(courierId);
      setTimeout(() => setPullingCourierId(null), 2000);
    }
  };

  // Socket Connection
  const { socket, isConnected } = useSocket({
    role: 'admin',
    token: authState.token
  });

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: number]: L.Marker }>({});
  const layersRef = useRef<{ [key: string]: L.TileLayer }>({});
  const polylineRef = useRef<L.Polyline | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);

  const selectedCourierIdRef = useRef<number | null>(null);

  useEffect(() => {
    selectedCourierIdRef.current = selectedCourierId;
  }, [selectedCourierId]);

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch all couriers on load
  const fetchCouriers = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const response = await api.get('/couriers');
      if (response.data.success) {
        setCouriers(response.data.couriers);
      }
    } catch (err) {
      console.error('Error fetching couriers:', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 800);
    }
  }, []);

  useEffect(() => {
    fetchCouriers();
  }, [fetchCouriers]);

  // Fetch location history when courier is selected
  const fetchLocationHistory = useCallback(async (courierId: number) => {
    try {
      const response = await api.get(`/locations/${courierId}/history?limit=50`);
      if (response.data.success) {
        setSelectedCourierHistory(response.data.history);
      }
    } catch (err) {
      console.error('Error fetching location history:', err);
    }
  }, []);

  useEffect(() => {
    if (selectedCourierId) {
      fetchLocationHistory(selectedCourierId);
    } else {
      setSelectedCourierHistory([]);
    }
  }, [selectedCourierId, fetchLocationHistory]);

  // Handle selected courier
  const selectCourier = (courier: Courier) => {
    selectedCourierIdRef.current = courier.id;
    setSelectedCourierId(courier.id);
    setShowMobileList(false);
    setShowMobileDetails(true);
    if (courier.latitude && courier.longitude) {
      const pos: L.LatLngExpression = [courier.latitude, courier.longitude];
      if (mapRef.current) {
        // Use flyTo for smooth flying animation and zoom in closer (level 21 - Max Zoom)
        mapRef.current.flyTo(pos, 21, { animate: true, duration: 1.5 });
      }
      setInfoWindowCourier(courier);
    }
  };

  // Socket event listener for live updates
  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.on('courier_location_changed', (data: {
      courierId: number;
      latitude: number;
      longitude: number;
      accuracy: number;
      speed: number | null;
      heading: number | null;
      last_update: string;
    }) => {
      // Update courier state
      setCouriers((prevCouriers) =>
        prevCouriers.map((c) => {
          if (c.id === data.courierId) {
            const updatedCourier = {
              ...c,
              latitude: data.latitude,
              longitude: data.longitude,
              accuracy: data.accuracy,
              speed: data.speed,
              heading: data.heading,
              last_update: data.last_update,
              status: 'active' as const
            };

            // If this courier is currently selected, add to path history
            if (selectedCourierId === data.courierId) {
              setSelectedCourierHistory((prevHistory) => {
                // Prevent duplicate points within 1 second
                const lastPoint = prevHistory[prevHistory.length - 1];
                if (lastPoint && lastPoint.latitude === data.latitude && lastPoint.longitude === data.longitude) {
                  return prevHistory;
                }
                return [
                  ...prevHistory,
                  {
                    id: Date.now(),
                    latitude: data.latitude,
                    longitude: data.longitude,
                    accuracy: data.accuracy,
                    speed: data.speed,
                    heading: data.heading,
                    timestamp: data.last_update
                  }
                ];
              });

              // Adjust map center if needed
              const pos: L.LatLngExpression = [data.latitude, data.longitude];
              if (mapRef.current) {
                mapRef.current.panTo(pos);
              }
            }

            // Update InfoWindow if open for this courier
            if (infoWindowCourier?.id === data.courierId) {
              setInfoWindowCourier(updatedCourier);
            }

            return updatedCourier;
          }
          return c;
        })
      );
    });

    socket.on('courier_status_changed', (data: {
      courierId: number;
      status: 'active' | 'inactive';
      name: string;
      device_info?: string;
    }) => {
      setCouriers((prevCouriers) =>
        prevCouriers.map((c) => {
          if (c.id === data.courierId) {
            const updated = {
              ...c,
              status: data.status,
              name: data.name || c.name,
              device_info: data.device_info || c.device_info,
            };
            if (infoWindowCourier?.id === data.courierId) {
              setInfoWindowCourier(updated);
            }
            return updated;
          }
          return c;
        })
      );
    });

    return () => {
      socket.off('courier_location_changed');
      socket.off('courier_status_changed');
    };
  }, [socket, isConnected, selectedCourierId, infoWindowCourier]);

  // Universal tracking link
  const trackingLink = `${window.location.origin}/track`;

  // Delete courier handler
  const handleDeleteCourier = async (id: number) => {
    if (!window.confirm('Bu birimi silmek istediğinize emin misiniz? Tüm geçmiş veriler de silinecektir.')) {
      return;
    }

    try {
      const response = await api.delete(`/couriers/${id}`);
      if (response.data.success) {
        setCouriers((prev) => prev.filter((c) => c.id !== id));
        if (selectedCourierId === id) {
          selectedCourierIdRef.current = null;
          setSelectedCourierId(null);
          setInfoWindowCourier(null);
        }
      }
    } catch (err) {
      console.error('Error deleting courier:', err);
    }
  };

  // Copy tracking link helper
  const copyLink = (link: string, id: number) => {
    navigator.clipboard.writeText(link);
    setCopiedCourierId(id);
    setTimeout(() => setCopiedCourierId(null), 2000);
  };

  // Filter couriers based on search query
  const filteredCouriers = couriers.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Define different base layers including Google Maps
    const googleStreetLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=tr', {
      attribution: '&copy; <a href="https://maps.google.com">Google Maps</a>',
      maxZoom: 22,
      maxNativeZoom: 22
    });

    const googleHybridLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&hl=tr', {
      attribution: '&copy; <a href="https://maps.google.com">Google Maps</a>',
      maxZoom: 22,
      maxNativeZoom: 22
    });

    const darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 22,
      maxNativeZoom: 20
    });

    const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 22,
      maxNativeZoom: 19
    });

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: true,
      layers: [darkLayer], // Start with CartoDB Dark Matter to match the cyber aesthetic
      maxZoom: 22
    }).setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 14); // Open closely on Prof. Dr. Necmettin Erbakan Parkı

    // Save references to layers for React-driven switching
    layersRef.current = {
      google_street: googleStreetLayer,
      google_hybrid: googleHybridLayer,
      dark: darkLayer,
      osm: streetLayer
    };

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Handle React-driven map layer swapping
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    Object.entries(layersRef.current).forEach(([key, layer]) => {
      if (key === activeLayer) {
        if (!map.hasLayer(layer)) {
          layer.addTo(map);
        }
      } else {
        if (map.hasLayer(layer)) {
          map.removeLayer(layer);
        }
      }
    });
  }, [activeLayer]);

  // Sync Markers, Popups and Accuracy Circle
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const activeCourierIds = new Set<number>();

    couriers.forEach((courier) => {
      if (!courier.latitude || !courier.longitude) return;
      activeCourierIds.add(courier.id);

      const latLng: L.LatLngExpression = [courier.latitude, courier.longitude];
      const isCourierActive = courier.status === 'active';
      const isCourierSelected = selectedCourierId === courier.id;
      const angle = courier.heading || 0;

      const colorIndex = courier.id % COURIER_COLORS.length;
      const colorScheme = COURIER_COLORS[colorIndex];
      const iconColor = isCourierActive ? colorScheme.primary : '#64748b';
      const fillColor = isCourierActive ? colorScheme.fill : '#334155';

      // Futuristic and premium SVG Marker
      const markerIconSvg = `
        <div class="radar-sweep-container" style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 50%; --sweep-color: ${iconColor}1f;">
          <!-- Double Sonar Ripple Wave Rings -->
          <div class="marker-ripple" style="border: 2px solid ${iconColor}; animation-delay: 0s; width: 44px; height: 44px;"></div>
          <div class="marker-ripple" style="border: 2px solid ${iconColor}; animation-delay: 1.2s; width: 44px; height: 44px;"></div>
          
          <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44" style="position: relative; z-index: 10;">
            <!-- Outer compass ticks -->
            <circle cx="22" cy="22" r="19" fill="none" stroke="${iconColor}" stroke-opacity="0.3" stroke-width="1.5" stroke-dasharray="2 3"/>
            <!-- Inner glass background -->
            <circle cx="22" cy="22" r="15" fill="${fillColor}" fill-opacity="0.25" stroke="${iconColor}" stroke-width="2"/>
            
            <!-- Directional glowing arrow rotating smoothly -->
            <g transform="rotate(${angle} 22 22)" style="transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);">
              <!-- Pulsing core dot -->
              <circle cx="22" cy="22" r="5.5" fill="${iconColor}"/>
              <!-- Direction pointer -->
              <polygon points="22,6 18,19 22,16.5 26,19" fill="#ffffff" filter="drop-shadow(0 0 3px ${iconColor})"/>
            </g>
          </svg>
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerIconSvg,
        className: 'custom-leaflet-marker',
        iconSize: [44, 44],
        iconAnchor: [22, 22] // Perfect center alignment to eliminate offset bug
      });

      let marker = markersRef.current[courier.id];
      if (marker) {
        marker.setLatLng(latLng);
        marker.setIcon(customIcon);
        // Refresh click event listener on update to avoid React stale closures
        marker.off('click');
        marker.on('click', () => {
          selectCourier(courier);
        });
      } else {
        marker = L.marker(latLng, { icon: customIcon }).addTo(map);
        marker.on('click', () => {
          selectCourier(courier);
        });
        markersRef.current[courier.id] = marker;
      }

      (marker as any).courierId = courier.id;

      const popupHtml = `
        <div class="text-white p-1.5 max-w-[210px] text-xs font-sans">
          <div class="flex justify-between items-center border-b border-slate-800 pb-2 mb-2">
            <span class="font-bold text-sm text-slate-100">${courier.name}</span>
            <span class="px-2 py-0.5 rounded text-[9px] font-extrabold ${
              isCourierActive ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/10' : 'bg-red-500/10 text-red-450 border border-red-500/10'
            }">${isCourierActive ? 'AKTİF' : 'ÇEVRİMDIŞI'}</span>
          </div>
          <div class="space-y-1.5 text-slate-350">
            <p class="flex justify-between"><span>Sapma:</span> <span class="font-bold text-slate-200">±${Math.round(courier.accuracy || 0)}m</span></p>
            ${courier.speed !== null && courier.speed !== undefined ? `<p class="flex justify-between"><span>Hız:</span> <span class="font-bold text-slate-200">${Math.round(courier.speed * 3.6)} km/s</span></p>` : ''}
            ${courier.heading !== null && courier.heading !== undefined ? `<p class="flex justify-between"><span>Yön:</span> <span class="font-bold text-slate-200">${Math.round(courier.heading)}°</span></p>` : ''}
            <p class="text-[9px] text-slate-500 pt-1.5 border-t border-slate-850">Güncelleme: ${new Date(courier.last_update!).toLocaleTimeString()}</p>
          </div>
          <div class="pt-2.5 mt-2 border-t border-slate-850">
            <a href="https://www.google.com/maps/dir/?api=1&destination=${courier.latitude},${courier.longitude}" 
               target="_blank" 
               rel="noopener noreferrer" 
               class="block text-center bg-sky-600 hover:bg-sky-500 text-white font-bold py-1.5 px-3 rounded-lg text-[9px] transition-all hover:scale-105"
               style="text-decoration: none; color: white;"
            >
              Yol Tarifi Al (Google Maps)
            </a>
          </div>
        </div>
      `;

      // Bind popup once or update its content in-place to prevent closed-popup race conditions
      if (!marker.getPopup()) {
        marker.bindPopup(popupHtml, {
          closeButton: true,
          offset: [0, -12]
        });
      } else {
        marker.setPopupContent(popupHtml);
      }

      if (infoWindowCourier && infoWindowCourier.id === courier.id) {
        if (!marker.isPopupOpen()) {
          marker.openPopup();
        }
      }

      if (isCourierSelected && courier.accuracy && courier.accuracy < 3000) {
        if (accuracyCircleRef.current) {
          accuracyCircleRef.current.setLatLng(latLng);
          accuracyCircleRef.current.setRadius(courier.accuracy);
          accuracyCircleRef.current.setStyle({
            color: iconColor,
            fillColor: iconColor
          });
        } else {
          accuracyCircleRef.current = L.circle(latLng, {
            radius: courier.accuracy,
            color: iconColor,
            opacity: 0.5,
            weight: 1.5,
            fillColor: iconColor,
            fillOpacity: 0.12
          }).addTo(map);
        }
      } else if (isCourierSelected && accuracyCircleRef.current) {
        accuracyCircleRef.current.remove();
        accuracyCircleRef.current = null;
      }
    });

    const selectedCourier = couriers.find(c => c.id === selectedCourierId);
    if ((!selectedCourierId || !selectedCourier || !selectedCourier.latitude || !selectedCourier.accuracy || selectedCourier.accuracy >= 3000) && accuracyCircleRef.current) {
      accuracyCircleRef.current.remove();
      accuracyCircleRef.current = null;
    }

    Object.keys(markersRef.current).forEach((idStr) => {
      const id = parseInt(idStr, 10);
      if (!activeCourierIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });
  }, [couriers, selectedCourierId, infoWindowCourier]);

  // Sync selected courier path history polyline
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (selectedCourierId && selectedCourierHistory.length > 1) {
      const latLngs = selectedCourierHistory.map((h) => [h.latitude, h.longitude] as L.LatLngExpression);
      const selectedCourierObj = couriers.find(c => c.id === selectedCourierId);
      const isSelectedActive = selectedCourierObj?.status === 'active';
      const colorIndex = selectedCourierId % COURIER_COLORS.length;
      const colorScheme = COURIER_COLORS[colorIndex];
      const selectedColor = isSelectedActive ? colorScheme.primary : '#64748b';

      if (polylineRef.current) {
        polylineRef.current.setLatLngs(latLngs);
        polylineRef.current.setStyle({ color: selectedColor });
      } else {
        polylineRef.current = L.polyline(latLngs, {
          color: selectedColor,
          opacity: 0.8,
          weight: 4
        }).addTo(map);
      }
    } else {
      if (polylineRef.current) {
        polylineRef.current.remove();
        polylineRef.current = null;
      }
    }
  }, [selectedCourierHistory, selectedCourierId, couriers]);

  // Sync Leaflet popup closure back to React state
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onPopupClose = (e: any) => {
      const closedMarker = e.popup?._source;
      const closedCourierId = closedMarker?.courierId;

      if (closedCourierId !== undefined && closedCourierId === selectedCourierIdRef.current) {
        selectedCourierIdRef.current = null;
        setInfoWindowCourier(null);
        setSelectedCourierId(null);
      }
    };

    map.on('popupclose', onPopupClose);
    return () => {
      map.off('popupclose', onPopupClose);
    };
  }, []);

  // Close Leaflet popup when infoWindowCourier is cleared in React state
  useEffect(() => {
    if (!infoWindowCourier && mapRef.current) {
      mapRef.current.closePopup();
    }
  }, [infoWindowCourier]);

  // Custom Zoom Control actions
  const handleZoomIn = () => {
    if (mapRef.current) {
      mapRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapRef.current) {
      mapRef.current.zoomOut();
    }
  };

  const selectedCourier = couriers.find((c) => c.id === selectedCourierId);

  // Get color for currently selected courier
  const getSelectedColor = () => {
    if (!selectedCourier) return '#0ea5e9';
    const colorIndex = selectedCourier.id % COURIER_COLORS.length;
    const colorScheme = COURIER_COLORS[colorIndex];
    return selectedCourier.status === 'active' ? colorScheme.primary : '#64748b';
  };
  const selectedColor = getSelectedColor();

  return (
    <div className="h-screen w-screen bg-[#070b19] flex flex-col overflow-hidden font-sans relative">
      
      {/* FULL-SCREEN MAP AS BACKGROUND */}
      <main className="absolute inset-0 z-0 bg-[#070b19]">
        <div ref={mapContainerRef} className="w-full h-full" style={{ outline: 'none' }}></div>
      </main>

      {/* FLOATING HEADER */}
      <header className="absolute top-4 left-4 right-4 z-[1000] glass-card px-4 md:px-6 py-2.5 md:py-3.5 rounded-[20px] border border-white/5 flex items-center justify-between shadow-2xl">
        <div className="flex items-center space-x-2 md:space-x-3">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-primary-500/10 border border-primary-500/25 rounded-xl flex items-center justify-center relative overflow-hidden group shrink-0">
            {/* Spinning glowing compass arrow */}
            <Compass className="w-4.5 h-4.5 md:w-5 md:h-5 text-primary-400 group-hover:rotate-180 transition-transform duration-700" />
            <div className="absolute inset-0 bg-primary-500/5 group-hover:animate-pulse"></div>
          </div>
          <div>
            <h1 className="text-xs md:text-sm font-bold text-white tracking-wide">Canlı Takip</h1>
            <p className="hidden md:block text-[10px] text-slate-400 font-semibold tracking-wider uppercase">Sistem Telemetrisi</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 md:space-x-4">
          {/* Socket Connection Badge */}
          {isConnected ? (
            <span className="inline-flex items-center px-2 md:px-3 py-1 rounded-full text-[9px] md:text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 tracking-wider uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-450 mr-1.5 md:mr-2 shadow-lg shadow-emerald-450/50 animate-pulse"></span>
              <span className="hidden sm:inline">BAĞLANTI AKTİF</span>
              <span className="sm:hidden">AKTİF</span>
            </span>
          ) : (
            <span className="inline-flex items-center px-2 md:px-3 py-1 rounded-full text-[9px] md:text-[10px] font-bold bg-red-500/10 border border-red-500/20 text-red-450 tracking-wider uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-red-450 mr-1.5 md:mr-2 animate-pulse"></span>
              <span className="hidden sm:inline">BAĞLANTI YOK</span>
              <span className="sm:hidden">YOK</span>
            </span>
          )}

          {/* Logout Button */}
          <button
            onClick={logout}
            className="flex items-center space-x-1.5 py-1.5 md:py-2 px-2.5 md:px-3 bg-slate-950/60 hover:bg-slate-900 border border-slate-850 rounded-xl text-slate-405 hover:text-white transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">ÇIKIŞ</span>
          </button>
        </div>
      </header>

      {/* FLOATING LEFT SIDEBAR */}
      <aside className={`fixed md:absolute top-20 md:top-24 left-4 right-4 md:right-auto bottom-24 md:bottom-4 z-[1000] w-auto md:w-96 glass-card rounded-[24px] border border-white/5 flex flex-col overflow-hidden shadow-2xl transition-all duration-300 ${showMobileList ? 'flex' : 'hidden md:flex'}`}>
        
        {/* Mobile Header / Close Button */}
        <div className="md:hidden flex items-center justify-between px-5 py-3 border-b border-slate-900/60 bg-slate-950/40 shrink-0">
          <span className="text-xs font-bold text-white uppercase tracking-wider">Birim Seçimi</span>
          <button
            onClick={() => setShowMobileList(false)}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Tracking Link Panel */}
        <div className="p-5 border-b border-slate-900/60 bg-slate-950/30 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold text-sky-400 tracking-widest uppercase">ORTAK TAKİP LİNKİ</h3>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 font-bold border border-sky-500/10">TRACK-LINK</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Birimlerin konumunu paylaşması için bu ortak bağlantıyı paylaşın:
          </p>
          <div className="flex items-center space-x-1.5 bg-slate-950/60 p-2.5 rounded-xl border border-slate-900">
            <input
              type="text"
              readOnly
              value={trackingLink}
              className="flex-1 bg-transparent text-xs text-primary-450 font-bold select-all focus:outline-none truncate pl-1"
            />
            <button
              onClick={() => copyLink(trackingLink, 999999)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg transition-all shrink-0"
              title="Kopyala"
            >
              {copiedCourierId === 999999 ? (
                <Check className="w-3.5 h-3.5 text-emerald-450" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Search Panel */}
        <div className="p-4 border-b border-slate-900/60 bg-slate-950/15">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Birim ara veya filtrele..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950/50 border border-slate-900 rounded-xl text-white placeholder-slate-500 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500/50 focus:border-sky-500/50 transition-all shadow-inner"
            />
          </div>
        </div>

        {/* Scrollable Courier List */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-2">
          <div className="px-2 pt-1 pb-2 flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-450 tracking-widest uppercase">BİRİMLER ({filteredCouriers.length})</span>
            <button
              onClick={fetchCouriers}
              disabled={isRefreshing}
              className="p-1.5 text-slate-450 hover:text-white hover:bg-slate-900 rounded-lg transition-all flex items-center justify-center disabled:opacity-50"
              title="Listeyi Yenile"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {filteredCouriers.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs font-medium italic">
              Kayıtlı birim bulunamadı.
            </div>
          ) : (
            filteredCouriers.map((courier) => {
              const isActive = courier.status === 'active';
              const isSelected = selectedCourierId === courier.id;
              const hasLocation = courier.latitude && courier.longitude;
              const colorIndex = courier.id % COURIER_COLORS.length;
              const colorScheme = COURIER_COLORS[colorIndex];

              return (
                <div
                  key={courier.id}
                  onClick={() => selectCourier(courier)}
                  className={`group p-3.5 rounded-[16px] border transition-all cursor-pointer relative overflow-hidden ${
                    isSelected
                      ? 'bg-slate-900/80 border-sky-500/30 shadow-[0_0_20px_rgba(14,165,233,0.1)]'
                      : 'bg-slate-950/40 border-slate-900/50 hover:bg-slate-900/50 hover:border-slate-800'
                  }`}
                >
                  {/* Subtle active background glow */}
                  {isSelected && (
                    <div className="absolute inset-0 bg-gradient-to-r from-sky-500/5 to-indigo-500/0 pointer-events-none"></div>
                  )}

                  <div className="flex justify-between items-start relative z-10">
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-xs text-slate-100">{courier.name}</span>
                        {isActive ? (
                          <span className="relative flex h-2 w-2">
                            <span 
                              className="animate-pulse absolute inline-flex h-full w-full rounded-full opacity-75"
                              style={{ backgroundColor: colorScheme.primary }}
                            ></span>
                            <span 
                              className="relative inline-flex rounded-full h-2 w-2"
                              style={{ 
                                backgroundColor: colorScheme.primary, 
                                boxShadow: `0 0 10px ${colorScheme.primary}` 
                              }}
                            ></span>
                          </span>
                        ) : (
                          <span className="relative flex h-2 w-2">
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-600"></span>
                          </span>
                        )}
                      </div>

                      {courier.device_info && (
                        <p className="text-[10px] text-sky-400/90 font-bold tracking-wide flex items-center">
                          <Compass className="w-3 h-3 mr-1" />
                          {courier.device_info}
                        </p>
                      )}

                      {hasLocation ? (
                        <p className="text-[10px] text-slate-450 font-medium">
                          Güncelleme: {new Date(courier.last_update!).toLocaleTimeString()} (±{Math.round(courier.accuracy || 0)}m)
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-500 italic">Konum verisi bekleniyor...</p>
                      )}
                    </div>

                    {/* Delete action */}
                    <div className="flex" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleDeleteCourier(courier.id)}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-900 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        title="Birimi sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* FLOATING CUSTOM LAYER SWITCHER (TOP RIGHT) */}
      <div className="absolute top-24 right-4 z-[1000] flex flex-col items-end space-y-2">
        <div className="relative">
          <button
            onClick={() => setShowLayersDropdown(!showLayersDropdown)}
            className="p-3 bg-slate-950/80 backdrop-blur-xl border border-slate-850 rounded-[16px] text-slate-250 hover:text-white shadow-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
            title="Harita Seçenekleri"
          >
            <Compass className="w-5 h-5 text-sky-450" />
          </button>

          {showLayersDropdown && (
            <div className="absolute right-0 mt-2 w-56 glass-card rounded-[18px] border border-white/5 shadow-2xl p-2.5 space-y-1 z-[1001]">
              <p className="text-[9px] font-extrabold text-sky-500 tracking-wider px-2 py-1 uppercase">HARİTA KATMANI</p>
              
              <button
                onClick={() => { setActiveLayer('google_street'); setShowLayersDropdown(false); }}
                className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-left text-xs font-bold transition-all ${
                  activeLayer === 'google_street' ? 'bg-sky-500/10 text-sky-450' : 'text-slate-350 hover:bg-slate-900/60'
                }`}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-sky-500"></div>
                <span>Google Harita</span>
              </button>

              <button
                onClick={() => { setActiveLayer('google_hybrid'); setShowLayersDropdown(false); }}
                className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-left text-xs font-bold transition-all ${
                  activeLayer === 'google_hybrid' ? 'bg-sky-500/10 text-sky-450' : 'text-slate-350 hover:bg-slate-900/60'
                }`}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                <span>Google Uydu (Hibrit)</span>
              </button>

              <button
                onClick={() => { setActiveLayer('dark'); setShowLayersDropdown(false); }}
                className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-left text-xs font-bold transition-all ${
                  activeLayer === 'dark' ? 'bg-sky-500/10 text-sky-450' : 'text-slate-350 hover:bg-slate-900/60'
                }`}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-purple-500"></div>
                <span>Karanlık Harita</span>
              </button>

              <button
                onClick={() => { setActiveLayer('osm'); setShowLayersDropdown(false); }}
                className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-left text-xs font-bold transition-all ${
                  activeLayer === 'osm' ? 'bg-sky-500/10 text-sky-450' : 'text-slate-350 hover:bg-slate-900/60'
                }`}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-slate-500"></div>
                <span>OpenStreetMap</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* FLOATING ZOOM CONTROLS (BOTTOM RIGHT) */}
      <div className="absolute bottom-20 right-4 z-[1000] flex flex-col bg-slate-950/80 backdrop-blur-xl border border-slate-850 rounded-[16px] shadow-2xl overflow-hidden">
        <button
          onClick={handleZoomIn}
          className="p-3.5 text-slate-300 hover:text-white hover:bg-slate-900 border-b border-slate-850 font-extrabold text-sm transition-all active:scale-95"
          title="Yakınlaştır"
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          className="p-3.5 text-slate-300 hover:text-white hover:bg-slate-900 font-extrabold text-sm transition-all active:scale-95"
          title="Uzaklaştır"
        >
          -
        </button>
      </div>

      {/* FLOATING TELEMETRY COCKPIT (RIGHT SIDE) */}
      {selectedCourier && (
        <aside className={`fixed md:absolute top-20 md:top-24 left-4 md:left-auto right-4 md:right-16 bottom-24 md:bottom-4 z-[1000] w-auto md:w-80 glass-card rounded-[24px] border border-white/5 flex flex-col overflow-hidden shadow-2xl p-5 space-y-5 transition-all duration-300 ${showMobileDetails ? 'flex' : 'hidden md:flex'}`}>
          
          {/* Mobile Header / Close Button */}
          <div className="md:hidden flex items-center justify-between border-b border-slate-900/60 pb-3 shrink-0">
            <span className="text-xs font-bold text-white uppercase tracking-wider">Birim Bilgileri</span>
            <button
              onClick={() => setShowMobileDetails(false)}
              className="p-1 text-slate-400 hover:text-white rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex justify-between items-start border-b border-slate-900/60 pb-3">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-sm text-slate-50">{selectedCourier.name}</h3>
                {selectedCourier.status === 'active' ? (
                  <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-emerald-500/15 border border-emerald-500/25 text-emerald-450 tracking-widest uppercase">AKTİF</span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-red-500/15 border border-red-500/25 text-red-450 tracking-widest uppercase">ÇEVRİMDIŞI</span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-1 font-semibold">{selectedCourier.device_info || 'Bilinmeyen Cihaz'}</p>
            </div>
            <button
              onClick={() => {
                selectedCourierIdRef.current = null;
                setSelectedCourierId(null);
                setInfoWindowCourier(null);
              }}
              className="text-slate-400 hover:text-white p-1.5 hover:bg-slate-900 rounded-lg transition-all text-xs font-bold"
              title="Kapat"
            >
              ✕
            </button>
          </div>

          {/* TELEMETRY GAUGES CONTAINER */}
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-6">
            
            {/* Speedometer */}
            <div className="flex flex-col items-center space-y-2">
              <span className="text-[9px] font-extrabold text-slate-400 tracking-widest uppercase">ANLIK SÜRAT</span>
              <div className="relative w-36 h-36 flex items-center justify-center">
                {/* SVG speedometer circular ring */}
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" stroke="#101726" strokeWidth="5.5" fill="transparent" />
                  <circle
                    className="speed-bar"
                    cx="50"
                    cy="50"
                    r="45"
                    stroke={selectedColor}
                    strokeWidth="5.5"
                    fill="transparent"
                    strokeDasharray={283}
                    strokeDashoffset={283 - (283 * Math.min(Math.round((selectedCourier.speed || 0) * 3.6), 80)) / 80}
                    strokeLinecap="round"
                    style={{ filter: `drop-shadow(0 0 3px ${selectedColor})` }}
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="text-2xl font-extrabold text-white leading-none">
                    {selectedCourier.speed !== null && selectedCourier.speed !== undefined
                      ? Math.round(selectedCourier.speed * 3.6)
                      : '0'}
                  </span>
                  <span className="block text-[8px] font-bold text-slate-450 tracking-wider mt-0.5">KM/S</span>
                </div>
              </div>
            </div>

            {/* Compass / Heading */}
            <div className="flex flex-col items-center space-y-2">
              <span className="text-[9px] font-extrabold text-slate-400 tracking-widest uppercase">YÖNELİM</span>
              <div className="relative w-28 h-28 flex items-center justify-center bg-slate-950/40 border border-slate-900/80 rounded-full shadow-inner">
                {/* Compass markers */}
                <div className="absolute top-1 text-[8px] font-extrabold text-slate-450">N</div>
                <div className="absolute right-2 text-[8px] font-extrabold text-slate-450">E</div>
                <div className="absolute bottom-1 text-[8px] font-extrabold text-slate-450">S</div>
                <div className="absolute left-2 text-[8px] font-extrabold text-slate-450">W</div>

                {/* Rotating arrow indicator */}
                <div
                  className="telemetry-dial"
                  style={{ transform: `rotate(${selectedCourier.heading || 0}deg)` }}
                >
                  <Navigation className="w-8 h-8 text-indigo-450 fill-indigo-500/10" />
                </div>
                <div className="absolute bottom-4 bg-slate-950 border border-slate-900/60 px-1.5 py-0.5 rounded text-[8px] font-bold text-slate-100">
                  {selectedCourier.heading !== null && selectedCourier.heading !== undefined
                    ? `${Math.round(selectedCourier.heading)}°`
                    : '0°'}
                </div>
              </div>
            </div>

            {/* Accuracy Badge */}
            <div className="bg-slate-950/60 border border-slate-900 p-3.5 rounded-2xl flex justify-between items-center">
              <div>
                <span className="text-[8px] font-bold text-slate-450 tracking-widest uppercase">SAPMA / DOĞRULUK</span>
                <p className="text-xs font-bold text-slate-100 mt-1">±{Math.round(selectedCourier.accuracy || 0)} Metre</p>
              </div>
              <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                <Compass className="w-4 h-4 text-sky-400" />
              </div>
            </div>

            {/* Last Update */}
            <div className="bg-slate-950/60 border border-slate-900 p-3.5 rounded-2xl flex justify-between items-center">
              <div>
                <span className="text-[8px] font-bold text-slate-450 tracking-widest uppercase">SON GÜNCELLEME</span>
                <p className="text-xs font-bold text-slate-100 mt-1">
                  {selectedCourier.last_update
                    ? new Date(selectedCourier.last_update).toLocaleTimeString()
                    : '---'}
                </p>
              </div>
              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <Clock className="w-4 h-4 text-indigo-400" />
              </div>
            </div>

          </div>

          {/* Yol Tarifi Al (Google Maps Directions) Button */}
          {selectedCourier.latitude && selectedCourier.longitude && (
            <div className="border-t border-slate-900/60 pt-3">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${selectedCourier.latitude},${selectedCourier.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="relative group overflow-hidden w-full py-3.5 px-4 shadow-lg flex items-center justify-center space-x-2 text-xs font-bold tracking-wider uppercase text-white transition-all"
                style={{ textDecoration: 'none' }}
              >
                <div 
                  className="absolute inset-0 transition-all duration-300"
                  style={{ 
                    backgroundImage: `linear-gradient(to right, ${selectedColor}, ${selectedColor}dd)` 
                  }}
                ></div>
                <span className="relative z-10 flex items-center justify-center space-x-1.5">
                  <span>YOL TARİFİ AL (GOOGLE MAPS)</span>
                  <Navigation className="w-3.5 h-3.5 text-white transform rotate-45 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </span>
              </a>
            </div>
          )}

          {/* Konum Güncelle / Anlık Konum Çek Button */}
          <div className="border-t border-slate-900/60 pt-3">
            <button
              onClick={() => requestCourierLocation(selectedCourier.id)}
              disabled={pullingCourierId === selectedCourier.id}
              className="relative overflow-hidden w-full py-3.5 px-4 rounded-xl border border-sky-500/30 hover:border-sky-500/55 bg-sky-500/10 text-sky-400 hover:text-white transition-all flex items-center justify-center space-x-2 text-xs font-bold tracking-wider uppercase disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pullingCourierId === selectedCourier.id ? (
                <>
                  <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin"></div>
                  <span>KONUM İSTENİYOR...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 animate-pulse" />
                  <span>KONUMU GÜNCELLE (ANLIK ÇEK)</span>
                </>
              )}
            </button>
          </div>

        </aside>
      )}

      {/* Floating Mobile Navigation Bar */}
      <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[1001] flex items-center space-x-2 bg-slate-950/80 backdrop-blur-md border border-white/10 px-4 py-2.5 rounded-full shadow-2xl">
        <button
          onClick={() => {
            setShowMobileList(true);
            setShowMobileDetails(false);
          }}
          className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-850 rounded-full text-xs font-bold text-sky-400 border border-sky-500/20"
        >
          <Menu className="w-3.5 h-3.5" />
          <span>BİRİMLER ({filteredCouriers.length})</span>
        </button>

        {selectedCourierId && (
          <button
            onClick={() => {
              setShowMobileDetails(true);
              setShowMobileList(false);
            }}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-850 rounded-full text-xs font-bold text-emerald-450 border border-emerald-500/20"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>DETAYLAR</span>
          </button>
        )}
      </div>

    </div>
  );
};
