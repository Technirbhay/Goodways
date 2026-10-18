import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { RoadCase, LocationInfo } from '../types';
import {
  MapPin,
  Navigation,
  Crosshair,
  Loader2,
  AlertCircle,
  ExternalLink,
  Layers,
  Globe,
  Eye,
  CheckCircle2,
} from 'lucide-react';

interface InteractiveMapProps {
  cases?: RoadCase[];
  selectedCaseId?: string | null;
  onSelectCase?: (caseId: string) => void;
  interactiveLocation?: LocationInfo | null;
  onLocationChange?: (newLoc: LocationInfo) => void;
  height?: string;
  allowPinDrop?: boolean;
  autoLocate?: boolean;
}

interface UserLiveLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  resolvedAddress?: string;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  cases = [],
  selectedCaseId,
  onSelectCase,
  interactiveLocation,
  onLocationChange,
  height = '520px',
  allowPinDrop = false,
  autoLocate = true,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const userLocationLayerRef = useRef<L.LayerGroup | null>(null);
  const pinDropMarkerRef = useRef<L.Marker | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // View state: 'leaflet' (with satellite/street toggle) or 'google_embed' (real Google Map)
  const [activeEngine, setActiveEngine] = useState<'interactive' | 'google_embed'>('interactive');
  const [mapLayerStyle, setMapLayerStyle] = useState<'satellite' | 'street'>('satellite');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [isTrackingLive, setIsTrackingLive] = useState<boolean>(false);
  const [liveLocation, setLiveLocation] = useState<UserLiveLocation | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [activeCenter, setActiveCenter] = useState<{ lat: number; lng: number }>({
    lat: interactiveLocation?.latitude || cases[0]?.location.latitude || 37.7749,
    lng: interactiveLocation?.longitude || cases[0]?.location.longitude || -122.4194,
  });

  // Free OpenStreetMap reverse geocoder (Zero API keys needed)
  const reverseGeocode = async (lat: number, lon: number): Promise<string | undefined> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
        { headers: { Accept: 'application/json' } }
      );
      if (res.ok) {
        const data = await res.json();
        const road = data.address?.road || data.address?.pedestrian || data.address?.highway;
        const city = data.address?.city || data.address?.town || data.address?.village || data.address?.suburb;
        if (road && city) return `${road}, ${city}`;
        if (data.display_name) return data.display_name.split(',').slice(0, 3).join(',');
      }
    } catch {
      // ignore
    }
    return undefined;
  };

  // Helper to create custom SVG pins
  const createCaseIcon = (severity: string, isSelected: boolean) => {
    let color = '#79583A';
    if (severity === 'critical') color = '#DC2626';
    else if (severity === 'high') color = '#D97706';
    else if (severity === 'Resolved') color = '#16A34A';

    const size = isSelected ? 40 : 32;
    const svgHtml = `
      <div style="width: ${size}px; height: ${size}px; position: relative; display: flex; align-items: center; justify-content: center;">
        <svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${color}" stroke="#FFFFFF" stroke-width="2" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.5)); transition: transform 0.2s;">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          <circle cx="12" cy="9" r="3.2" fill="#FFFFFF"/>
        </svg>
      </div>
    `;

    return L.divIcon({
      html: svgHtml,
      className: 'custom-road-marker',
      iconSize: [size, size],
      iconAnchor: [size / 2, size],
      popupAnchor: [0, -size],
    });
  };

  // Helper to create glowing live user location marker
  const createUserLiveIcon = () => {
    const html = `
      <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
        <div style="
          position: absolute;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(37, 99, 235, 0.45);
          animation: ping 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;
        "></div>
        <div style="
          position: relative;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #2563EB;
          border: 3px solid #FFFFFF;
          box-shadow: 0 2px 5px rgba(0,0,0,0.4);
        "></div>
      </div>
    `;

    return L.divIcon({
      html,
      className: 'user-live-pin',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  };

  // Switch Tile Layer between Real Satellite Aerial & Street
  const updateTileLayer = (style: 'satellite' | 'street') => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    if (style === 'satellite') {
      // Real high-resolution satellite photography (Esri World Imagery) - Zero API keys
      tileLayerRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
          maxZoom: 19,
        }
      ).addTo(map);
    } else {
      // High-resolution OpenStreetMap street cartography - Zero API keys
      tileLayerRef.current = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }
      ).addTo(map);
    }
    setMapLayerStyle(style);
  };

  // Live Location Detection (Zero API key required)
  const handleDetectLocation = useCallback((continuous: boolean = false) => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    const geoSuccess = async (pos: GeolocationPosition) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const accuracy = pos.coords.accuracy;

      let address: string | undefined;
      try {
        address = await reverseGeocode(lat, lng);
      } catch {
        // ignore
      }

      const userLoc: UserLiveLocation = {
        latitude: lat,
        longitude: lng,
        accuracy,
        resolvedAddress: address,
      };

      setLiveLocation(userLoc);
      setActiveCenter({ lat, lng });
      setIsLocating(false);

      const map = mapInstanceRef.current;
      if (map) {
        map.setView([lat, lng], 17, { animate: true });
      }

      if (allowPinDrop && onLocationChange) {
        onLocationChange({
          latitude: Math.round(lat * 1e6) / 1e6,
          longitude: Math.round(lng * 1e6) / 1e6,
          address: address || '',
          source: 'device_gps',
        });
      }
    };

    const geoError = (err: GeolocationPositionError) => {
      setIsLocating(false);
      setIsTrackingLive(false);
      let msg = 'Unable to retrieve location.';
      if (err.code === err.PERMISSION_DENIED) {
        msg = 'Location permission denied. Please allow location access in your browser settings.';
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        msg = 'GPS signal unavailable. Please ensure location services are enabled on your device.';
      } else if (err.code === err.TIMEOUT) {
        msg = 'Location request timed out. Please retry.';
      }
      setLocationError(msg);
    };

    navigator.geolocation.getCurrentPosition(geoSuccess, geoError, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 0,
    });

    if (continuous) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setLiveLocation((prev) => ({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            resolvedAddress: prev?.resolvedAddress,
          }));
          setActiveCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        geoError,
        { enableHighAccuracy: true, maximumAge: 1000 }
      );
      watchIdRef.current = watchId;
      setIsTrackingLive(true);
    }
  }, [allowPinDrop, onLocationChange]);

  const toggleContinuousTracking = () => {
    if (isTrackingLive) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsTrackingLive(false);
    } else {
      handleDetectLocation(true);
    }
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (activeEngine !== 'interactive') return;
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.invalidateSize();
      return;
    }

    const initLat = interactiveLocation?.latitude || cases[0]?.location.latitude || activeCenter.lat;
    const initLng = interactiveLocation?.longitude || cases[0]?.location.longitude || activeCenter.lng;

    const map = L.map(mapContainerRef.current, {
      center: [initLat, initLng],
      zoom: cases.length > 1 ? 14 : 16,
      zoomControl: true,
    });

    // Default to real HD Satellite imagery
    tileLayerRef.current = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
        maxZoom: 19,
      }
    ).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    const userLocationLayer = L.layerGroup().addTo(map);

    markersLayerRef.current = markersLayer;
    userLocationLayerRef.current = userLocationLayer;
    mapInstanceRef.current = map;

    // Pin drop click handler
    if (allowPinDrop && onLocationChange) {
      map.on('click', async (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        const roundedLat = Math.round(lat * 1e6) / 1e6;
        const roundedLng = Math.round(lng * 1e6) / 1e6;
        const address = await reverseGeocode(roundedLat, roundedLng);

        setActiveCenter({ lat: roundedLat, lng: roundedLng });
        onLocationChange({
          latitude: roundedLat,
          longitude: roundedLng,
          address: address || '',
          source: 'device_gps',
        });
      });
    }

    if (autoLocate) {
      handleDetectLocation(false);
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [activeEngine]);

  // Update Live Location Graphic
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = userLocationLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    if (liveLocation) {
      const { latitude, longitude, accuracy } = liveLocation;

      if (accuracy && accuracy < 2000) {
        const accuracyCircle = L.circle([latitude, longitude], {
          radius: accuracy,
          color: '#3B82F6',
          fillColor: '#60A5FA',
          fillOpacity: 0.18,
          weight: 1.5,
        });
        accuracyCircle.addTo(layer);
      }

      const liveMarker = L.marker([latitude, longitude], {
        icon: createUserLiveIcon(),
        zIndexOffset: 1000,
      });

      const popupDiv = document.createElement('div');
      popupDiv.className = 'p-1.5 text-xs text-[#302A23] font-sans min-w-[200px]';
      popupDiv.innerHTML = `
        <div style="font-weight: 700; color: #2563EB; display: flex; align-items: center; gap: 4px;">
          <span>📍 Your Current Live Location</span>
        </div>
        ${
          liveLocation.resolvedAddress
            ? `<div style="font-weight: 600; margin-top: 4px; color: #302A23;">${liveLocation.resolvedAddress}</div>`
            : ''
        }
        <div style="font-family: monospace; font-size: 11px; margin-top: 4px; color: #746A5C;">
          ${latitude.toFixed(6)}, ${longitude.toFixed(6)}
        </div>
        <div style="font-size: 10px; color: #16A34A; margin-top: 2px;">
          GPS Accuracy: ±${Math.round(accuracy)} meters
        </div>
        <div style="margin-top: 8px;">
          <a href="https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}" target="_blank" rel="noopener noreferrer" style="display: block; text-align: center; padding: 5px 8px; border-radius: 6px; background: #2563EB; color: white; font-weight: 600; text-decoration: none; font-size: 11px;">
            Open in Google Maps App ↗
          </a>
        </div>
      `;

      liveMarker.bindPopup(popupDiv);
      liveMarker.addTo(layer);
    }
  }, [liveLocation]);

  // Update Road Case Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();
    const bounds: [number, number][] = [];

    const visibleCases = cases.filter((c) => {
      if (severityFilter === 'all') return true;
      if (severityFilter === 'critical') return c.overallSeverity === 'critical';
      if (severityFilter === 'high') return c.overallSeverity === 'high';
      if (severityFilter === 'resolved') return c.status === 'Resolved';
      return true;
    });

    visibleCases.forEach((c) => {
      const { latitude, longitude } = c.location;
      if (!latitude || !longitude) return;

      bounds.push([latitude, longitude]);
      const isSelected = c.id === selectedCaseId;
      const icon = createCaseIcon(c.status === 'Resolved' ? 'Resolved' : c.overallSeverity, isSelected);

      const marker = L.marker([latitude, longitude], { icon });
      const firstDmg = c.damageRegions[0];
      const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

      const popupDiv = document.createElement('div');
      popupDiv.className = 'p-1.5 text-xs text-[#302A23] font-sans min-w-[220px] max-w-[270px]';
      popupDiv.innerHTML = `
        <div style="font-weight: 700; font-size: 11px; color: #746A5C; font-family: monospace;">${c.id}</div>
        <div style="font-weight: 700; font-size: 13px; margin-top: 2px; color: #111;">${c.roadName}</div>
        <div style="margin-top: 6px; border-radius: 6px; overflow: hidden; height: 110px; background: #111;">
          <img src="${c.originalImageUrl}" alt="${c.roadName}" style="width: 100%; height: 100%; object-fit: cover;" />
        </div>
        <div style="margin-top: 6px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 600; color: #79583A;">${firstDmg ? firstDmg.typeLabel : 'Pavement Defect'}</span>
          <span style="font-size: 10px; padding: 2px 7px; border-radius: 4px; font-weight: 700; background: ${
            c.status === 'Resolved' ? '#DCFCE7' : '#FEE2E2'
          }; color: ${c.status === 'Resolved' ? '#16A34A' : '#DC2626'};">
            ${c.status}
          </span>
        </div>
        <div style="font-size: 11px; color: #666; margin-top: 4px;">
          GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}
        </div>
        <div style="margin-top: 8px; display: flex; gap: 6px;">
          <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" style="flex: 1; text-align: center; padding: 5px 8px; border-radius: 6px; background: #EEE4D2; color: #302A23; font-weight: 600; font-size: 10px; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 4px;">
            <span>Google Maps</span> ↗
          </a>
        </div>
      `;

      const inspectBtn = document.createElement('button');
      inspectBtn.innerText = 'Inspect Case';
      inspectBtn.style.cssText =
        'flex: 1; padding: 5px 8px; border-radius: 6px; background: #79583A; color: white; font-weight: 600; font-size: 10px; border: none; cursor: pointer;';
      inspectBtn.onclick = () => {
        if (onSelectCase) onSelectCase(c.id);
      };
      const btnContainer = popupDiv.querySelector('div:last-child');
      if (btnContainer) {
        btnContainer.prepend(inspectBtn);
      }

      marker.bindPopup(popupDiv);
      marker.addTo(markersLayer);

      if (isSelected) {
        map.setView([latitude, longitude], 17, { animate: true });
        marker.openPopup();
      }
    });

    if (bounds.length > 1 && !selectedCaseId && !liveLocation) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [cases, selectedCaseId, severityFilter, liveLocation]);

  // Update Interactive Draggable Pin
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !interactiveLocation) return;

    if (pinDropMarkerRef.current) {
      pinDropMarkerRef.current.setLatLng([interactiveLocation.latitude, interactiveLocation.longitude]);
    } else {
      const pinIcon = L.divIcon({
        html: `
          <div style="width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
            <svg viewBox="0 0 24 24" width="34" height="34" fill="#DC2626" stroke="#FFFFFF" stroke-width="2" style="filter: drop-shadow(0 4px 8px rgba(0,0,0,0.5));">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
              <circle cx="12" cy="9" r="3.5" fill="#FFFFFF"/>
            </svg>
          </div>
        `,
        className: 'interactive-pindrop-marker',
        iconSize: [34, 34],
        iconAnchor: [17, 34],
      });

      const marker = L.marker([interactiveLocation.latitude, interactiveLocation.longitude], {
        icon: pinIcon,
        draggable: !!allowPinDrop,
      });

      if (allowPinDrop && onLocationChange) {
        marker.on('dragend', async () => {
          const pos = marker.getLatLng();
          const lat = Math.round(pos.lat * 1e6) / 1e6;
          const lng = Math.round(pos.lng * 1e6) / 1e6;
          const address = await reverseGeocode(lat, lng);
          setActiveCenter({ lat, lng });
          onLocationChange({
            latitude: lat,
            longitude: lng,
            address: address || '',
            source: 'device_gps',
          });
        });
      }

      marker.addTo(map);
      pinDropMarkerRef.current = marker;
    }
  }, [interactiveLocation, allowPinDrop]);

  // Selected or Active target coordinates for genuine Google Map embed
  const currentTargetLat =
    interactiveLocation?.latitude ||
    cases.find((c) => c.id === selectedCaseId)?.location.latitude ||
    activeCenter.lat;
  const currentTargetLng =
    interactiveLocation?.longitude ||
    cases.find((c) => c.id === selectedCaseId)?.location.longitude ||
    activeCenter.lng;

  // Genuine Google Maps URL (100% real Google Maps, works without any API keys)
  const genuineGoogleMapEmbedUrl = `https://maps.google.com/maps?q=${currentTargetLat},${currentTargetLng}&t=${
    mapLayerStyle === 'satellite' ? 'k' : 'm'
  }&z=17&output=embed`;

  return (
    <div className="relative rounded-xl border border-[#DCD0BD] bg-[#FFFDF8] overflow-hidden shadow-xs flex flex-col">
      {/* Map Header Toolbar with Real Engine & Layer Switchers */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 border-b border-[#DCD0BD] bg-[#EEE4D2]/40 text-xs text-[#302A23]">
        <div className="flex items-center gap-2">
          <MapPin size={15} className="text-[#79583A]" />
          <span className="font-bold text-sm">Real Geospatial Road Map</span>
          <span className="px-2 py-0.5 rounded-full bg-[#2F7657]/15 text-[#2F7657] font-semibold text-[10px]">
            Live & Active (No API key needed)
          </span>
        </div>

        {/* Engine Switcher: Interactive Satellite Map vs Genuine Google Map */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center p-0.5 rounded-lg border border-[#DCD0BD] bg-[#FFFDF8] text-[11px] font-semibold">
            <button
              onClick={() => setActiveEngine('interactive')}
              className={`px-2 py-1 rounded transition flex items-center gap-1 ${
                activeEngine === 'interactive'
                  ? 'bg-[#79583A] text-white shadow-2xs'
                  : 'text-[#302A23] hover:bg-[#EEE4D2]'
              }`}
            >
              <Globe size={12} />
              <span>Interactive Aerial Map</span>
            </button>
            <button
              onClick={() => setActiveEngine('google_embed')}
              className={`px-2 py-1 rounded transition flex items-center gap-1 ${
                activeEngine === 'google_embed'
                  ? 'bg-[#2563EB] text-white shadow-2xs'
                  : 'text-[#302A23] hover:bg-[#EEE4D2]'
              }`}
            >
              <ExternalLink size={12} />
              <span>Google Maps Live</span>
            </button>
          </div>

          {/* Layer Style: Real HD Satellite vs Street */}
          <div className="flex items-center p-0.5 rounded-lg border border-[#DCD0BD] bg-[#FFFDF8] text-[11px] font-semibold">
            <button
              onClick={() => updateTileLayer('satellite')}
              className={`px-2 py-1 rounded transition ${
                mapLayerStyle === 'satellite'
                  ? 'bg-stone-800 text-white'
                  : 'text-[#302A23] hover:bg-[#EEE4D2]'
              }`}
              title="Real high-resolution aerial satellite imagery of roads and pavement"
            >
              🛰️ Satellite
            </button>
            <button
              onClick={() => updateTileLayer('street')}
              className={`px-2 py-1 rounded transition ${
                mapLayerStyle === 'street'
                  ? 'bg-[#79583A] text-white'
                  : 'text-[#302A23] hover:bg-[#EEE4D2]'
              }`}
              title="Standard street cartography"
            >
              🗺️ Street
            </button>
          </div>

          {/* Live GPS Detection Button */}
          <button
            onClick={() => handleDetectLocation(false)}
            disabled={isLocating}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs transition shadow-xs disabled:opacity-50"
            title="Detect your real live GPS coordinates now"
          >
            {isLocating ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Crosshair size={13} />
            )}
            <span>{isLocating ? 'Detecting...' : 'Locate Me'}</span>
          </button>

          {/* Live Follow Tracking */}
          <button
            onClick={toggleContinuousTracking}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-semibold transition ${
              isTrackingLive
                ? 'bg-[#2F7657] border-[#2F7657] text-white'
                : 'border-[#DCD0BD] bg-[#FFFDF8] text-[#302A23] hover:bg-[#EEE4D2]'
            }`}
            title="Real-time live follow mode as you walk or drive"
          >
            <Navigation size={12} className={isTrackingLive ? 'animate-pulse' : ''} />
            <span className="hidden sm:inline">
              {isTrackingLive ? 'Live Tracking ON' : 'Follow Movement'}
            </span>
          </button>
        </div>
      </div>

      {/* Live GPS Telemetry Status Strip */}
      {liveLocation && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 text-xs flex flex-wrap items-center justify-between gap-2 text-blue-900">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
            </span>
            <span className="font-semibold">Live GPS Fixed:</span>
            <span className="font-mono text-[11px]">
              {liveLocation.latitude.toFixed(6)}, {liveLocation.longitude.toFixed(6)}
            </span>
            <span className="text-blue-700 text-[11px]">
              (Accuracy: ±{Math.round(liveLocation.accuracy)}m)
            </span>
            {liveLocation.resolvedAddress && (
              <span className="font-medium text-blue-950 hidden md:inline">
                • {liveLocation.resolvedAddress}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {allowPinDrop && onLocationChange && (
              <button
                onClick={() => {
                  onLocationChange({
                    latitude: Math.round(liveLocation.latitude * 1e6) / 1e6,
                    longitude: Math.round(liveLocation.longitude * 1e6) / 1e6,
                    address: liveLocation.resolvedAddress || '',
                    source: 'device_gps',
                  });
                }}
                className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] transition shadow-2xs"
              >
                Set Defect Location Here
              </button>
            )}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${liveLocation.latitude},${liveLocation.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 hover:text-blue-900 font-semibold underline text-[11px] flex items-center gap-0.5"
            >
              <span>Open in Google Maps App</span> ↗
            </a>
          </div>
        </div>
      )}

      {/* Location Error Warning */}
      {locationError && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-900 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <AlertCircle size={14} className="text-amber-700 shrink-0" />
            <span>{locationError}</span>
          </div>
          <button
            onClick={() => setLocationError(null)}
            className="text-amber-800 font-semibold text-[11px] underline ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Map View Container */}
      <div style={{ height, width: '100%', position: 'relative' }}>
        {activeEngine === 'interactive' ? (
          <div
            ref={mapContainerRef}
            style={{ height: '100%', width: '100%' }}
            className="z-0 bg-stone-900"
          />
        ) : (
          /* Genuine Google Maps Live View (Zero API Key needed) */
          <iframe
            title="Google Maps Genuine Live View"
            src={genuineGoogleMapEmbedUrl}
            style={{ width: '100%', height: '100%', border: 0 }}
            allowFullScreen={false}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        )}
      </div>

      {/* Bottom Bar: Severity Legend & Controls */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-[#FFFDF8] border-t border-[#DCD0BD] text-[11px] text-[#746A5C] gap-2">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" /> Live Position
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626]" /> Critical
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]" /> High
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#79583A]" /> Medium
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A]" /> Resolved
          </span>
        </div>

        <div className="flex items-center gap-2">
          {allowPinDrop && (
            <span className="text-[#79583A] font-semibold">
              Click anywhere on the satellite to drop defect pin
            </span>
          )}
          <span className="text-stone-300">•</span>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${currentTargetLat},${currentTargetLng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#79583A] hover:underline font-semibold flex items-center gap-1"
          >
            <span>Driving Directions in Google Maps</span> ↗
          </a>
        </div>
      </div>
    </div>
  );
};
