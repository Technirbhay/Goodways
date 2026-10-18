import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { RoadCase, LocationInfo } from '../types';
import { apiUrl } from '../api';
import {
  MapPin,
  ExternalLink,
  Navigation,
  ZoomIn,
  ZoomOut,
  Layers,
  Compass,
  CheckCircle,
  Copy,
  Info,
  Move,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Globe,
  Search,
  Loader2,
  Eye,
  Mountain,
} from 'lucide-react';

interface RoadGoogleMapProps {
  apiKey?: string;
  cases?: RoadCase[];
  selectedCaseId?: string | null;
  onSelectCase?: (caseId: string) => void;
  // Single location pin mode (for report creation or single case inspection)
  singlePin?: {
    location: LocationInfo;
    draggable?: boolean;
    title?: string;
    roadName?: string;
  };
  onLocationChange?: (newLoc: { latitude: number; longitude: number }) => void;
  height?: string;
  defaultZoom?: number;
  showSearchBar?: boolean;
}

export const RoadGoogleMap: React.FC<RoadGoogleMapProps> = ({
  cases = [],
  selectedCaseId,
  onSelectCase,
  singlePin,
  onLocationChange,
  height = '420px',
  defaultZoom = 15,
  showSearchBar = true,
}) => {
  // Layer: 'google_roadmap', 'google_hybrid', 'google_satellite', 'google_terrain', 'osm'
  const [activeLayer, setActiveLayer] = useState<'google_roadmap' | 'google_hybrid' | 'google_satellite' | 'google_terrain'>('google_roadmap');
  const [zoomLevel, setZoomLevel] = useState<number>(defaultZoom);
  const [copiedCoords, setCopiedCoords] = useState(false);
  const [isAdjustingPin, setIsAdjustingPin] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResultsDropdown, setShowResultsDropdown] = useState(false);

  // References for Leaflet
  const leafletContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);

  // Determine current active coordinate
  const activeLat = singlePin
    ? singlePin.location.latitude
    : cases.length > 0
    ? (selectedCaseId ? cases.find((c) => c.id === selectedCaseId)?.location.latitude : cases[0].location.latitude) || 37.7749
    : 37.7749;

  const activeLng = singlePin
    ? singlePin.location.longitude
    : cases.length > 0
    ? (selectedCaseId ? cases.find((c) => c.id === selectedCaseId)?.location.longitude : cases[0].location.longitude) || -122.4194
    : -122.4194;

  const activeRoadName =
    singlePin?.roadName ||
    (selectedCaseId ? cases.find((c) => c.id === selectedCaseId)?.roadName : cases[0]?.roadName) ||
    'Roadway Defect';

  // State to track current lat/lng
  const [currentCoords, setCurrentCoords] = useState({ lat: activeLat, lng: activeLng });

  useEffect(() => {
    setCurrentCoords({ lat: activeLat, lng: activeLng });
  }, [activeLat, activeLng]);

  // Fine coordinate nudges
  const handleNudge = (deltaLat: number, deltaLng: number) => {
    const newLat = Math.round((currentCoords.lat + deltaLat) * 1e6) / 1e6;
    const newLng = Math.round((currentCoords.lng + deltaLng) * 1e6) / 1e6;
    setCurrentCoords({ lat: newLat, lng: newLng });
    if (onLocationChange) {
      onLocationChange({ latitude: newLat, longitude: newLng });
    }
    if (mapInstanceRef.current) {
      mapInstanceRef.current.panTo([newLat, newLng]);
    }
  };

  const handleCopyCoords = () => {
    const coordsStr = `${currentCoords.lat.toFixed(6)}, ${currentCoords.lng.toFixed(6)}`;
    navigator.clipboard.writeText(coordsStr);
    setCopiedCoords(true);
    setTimeout(() => setCopiedCoords(false), 2000);
  };

  // Google Maps pin icons
  const createPinIcon = (color: string, isSelected = false) => {
    const size = isSelected ? 36 : 28;
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0px 3px 6px rgba(0,0,0,0.5)); cursor: pointer;">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
        <circle cx="12" cy="10" r="3" fill="#FFFFFF"/>
      </svg>
    `;
    return L.divIcon({
      html: svg,
      className: 'custom-google-marker',
      iconSize: [size, size],
      iconAnchor: [size / 2, size],
      popupAnchor: [0, -size],
    });
  };

  // Search geocoding
  const handleSearchSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const res = await fetch(apiUrl(`/api/geocode?q=${encodeURIComponent(searchQuery)}`));
      if (res.ok) {
        const results = await res.json();
        setSearchResults(results);
        setShowResultsDropdown(true);
      }
    } catch (err) {
      console.warn('Geocoding error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (result: any) => {
    const newLat = parseFloat(result.lat);
    const newLng = parseFloat(result.lon);
    if (!isNaN(newLat) && !isNaN(newLng)) {
      setCurrentCoords({ lat: newLat, lng: newLng });
      if (onLocationChange) {
        onLocationChange({ latitude: newLat, longitude: newLng });
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([newLat, newLng], 16, { duration: 1.2 });
      }
    }
    setShowResultsDropdown(false);
    setSearchQuery(result.display_name.split(',')[0]);
  };

  // Initialize and update Map instance
  useEffect(() => {
    if (!leafletContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(leafletContainerRef.current, {
        center: [currentCoords.lat, currentCoords.lng],
        zoom: zoomLevel,
        zoomControl: false,
      });
      mapInstanceRef.current = map;

      map.on('zoomend', () => {
        setZoomLevel(map.getZoom());
      });
    }

    const map = mapInstanceRef.current;
    if (!map) return;

    // Switch Tile Layer: Use Official Free Google Maps Tile Servers
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }

    let tileUrl = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'; // Google Roadmap
    let attribution = '&copy; Google Maps Infrastructure Data';
    let maxZoom = 20;

    if (activeLayer === 'google_satellite') {
      tileUrl = 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'; // Google Satellite
      attribution = '&copy; Google Earth Imagery';
    } else if (activeLayer === 'google_hybrid') {
      tileUrl = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'; // Google Hybrid (Satellite + Roads/Labels)
      attribution = '&copy; Google Satellite & Roads';
    } else if (activeLayer === 'google_terrain') {
      tileUrl = 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}'; // Google Terrain
      attribution = '&copy; Google Terrain';
    }

    const newTileLayer = L.tileLayer(tileUrl, { attribution, maxZoom }).addTo(map);
    tileLayerRef.current = newTileLayer;

    // Update markers
    if (markersGroupRef.current) {
      markersGroupRef.current.clearLayers();
    } else {
      markersGroupRef.current = L.layerGroup().addTo(map);
    }

    const markersGroup = markersGroupRef.current;

    // 1. Single Pin Mode (e.g. reporting or inspecting one case)
    if (singlePin) {
      const pin = L.marker([currentCoords.lat, currentCoords.lng], {
        icon: createPinIcon('#EA4335', true), // Google Red
        draggable: !!singlePin.draggable,
      }).addTo(markersGroup);

      pin.bindPopup(`
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #202124; padding: 4px; min-width: 170px;">
          <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 2px;">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #EA4335;"></span>
            <span style="font-weight: 800; font-size: 13px; color: #202124;">${activeRoadName}</span>
          </div>
          <div style="font-size: 11px; font-family: monospace; color: #5f6368;">${currentCoords.lat.toFixed(6)}, ${currentCoords.lng.toFixed(6)}</div>
          <div style="margin-top: 6px; padding: 4px 6px; background: #f1f3f4; border-radius: 4px; font-size: 10px; color: #3c4043; font-weight: 600;">
            ${singlePin.draggable ? 'Click road or drag pin to position coordinates' : 'Identified Road Defect'}
          </div>
          <div style="margin-top: 6px; text-align: right;">
            <a href="https://www.google.com/maps?q=${currentCoords.lat},${currentCoords.lng}" target="_blank" rel="noopener noreferrer" style="color: #1a73e8; font-weight: 700; font-size: 11px; text-decoration: none;">
              Open in Google Maps App →
            </a>
          </div>
        </div>
      `);

      if (singlePin.draggable && onLocationChange) {
        pin.on('dragend', (e) => {
          const latlng = (e.target as L.Marker).getLatLng();
          const nLat = Math.round(latlng.lat * 1e6) / 1e6;
          const nLng = Math.round(latlng.lng * 1e6) / 1e6;
          setCurrentCoords({ lat: nLat, lng: nLng });
          onLocationChange({ latitude: nLat, longitude: nLng });
        });
      }

      map.on('click', (e: L.LeafletMouseEvent) => {
        if (singlePin.draggable && onLocationChange) {
          const nLat = Math.round(e.latlng.lat * 1e6) / 1e6;
          const nLng = Math.round(e.latlng.lng * 1e6) / 1e6;
          setCurrentCoords({ lat: nLat, lng: nLng });
          pin.setLatLng([nLat, nLng]);
          onLocationChange({ latitude: nLat, longitude: nLng });
        }
      });
    } else if (cases.length > 0) {
      // 2. Multi-Case Mode
      cases.forEach((c) => {
        const isSel = c.id === selectedCaseId;
        const col =
          c.status === 'Resolved'
            ? '#34A853' // Google Green
            : c.overallSeverity === 'critical'
            ? '#EA4335' // Google Red
            : c.overallSeverity === 'high'
            ? '#FBBC05' // Google Yellow/Amber
            : '#4285F4'; // Google Blue

        const m = L.marker([c.location.latitude, c.location.longitude], {
          icon: createPinIcon(col, isSel),
        }).addTo(markersGroup);

        const areaStr = c.damageRegions[0]?.measurements.areaCm2
          ? `${c.damageRegions[0].measurements.areaCm2.toLocaleString()} cm²`
          : c.damageRegions[0]?.measurements.areaM2
          ? `${c.damageRegions[0].measurements.areaM2} m²`
          : 'Pending';

        m.bindPopup(`
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #202124; padding: 4px; min-width: 190px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
              <span style="font-weight: 800; font-family: monospace; font-size: 11px; color: #1a73e8;">${c.id}</span>
              <span style="font-size: 9px; font-weight: 800; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; background: ${col}20; color: ${col}; border: 1px solid ${col}40;">${c.overallSeverity}</span>
            </div>
            <div style="font-weight: 700; font-size: 13px; color: #202124; margin-top: 2px;">${c.roadName}</div>
            <div style="font-size: 11px; color: #5f6368; margin-top: 3px;">Status: <strong style="color: ${col};">${c.status}</strong></div>
            <div style="font-size: 11px; color: #5f6368; margin-top: 1px;">Pothole Area: <strong>${areaStr}</strong></div>
            <div style="font-size: 10px; color: #70757a; font-family: monospace; margin-top: 2px;">${c.location.latitude.toFixed(5)}, ${c.location.longitude.toFixed(5)}</div>
            ${c.governmentIntegration?.externalReferenceId ? `<div style="font-size: 10px; color: #137333; font-weight: 700; margin-top: 4px;">Govt Docket: ${c.governmentIntegration.externalReferenceId}</div>` : ''}
            <div style="margin-top: 8px; border-top: 1px solid #dadce0; padding-top: 4px; display: flex; justify-content: space-between;">
              <a href="https://www.google.com/maps?q=${c.location.latitude},${c.location.longitude}" target="_blank" rel="noopener noreferrer" style="color: #1a73e8; font-weight: 700; font-size: 11px; text-decoration: none;">
                Directions in Google Maps ↗
              </a>
            </div>
          </div>
        `);

        m.on('click', () => {
          if (onSelectCase) onSelectCase(c.id);
        });
      });
    }

    setTimeout(() => {
      map.invalidateSize();
    }, 120);

  }, [activeLayer, currentCoords.lat, currentCoords.lng, cases, selectedCaseId, singlePin]);

  // Clean up
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  };

  return (
    <div
      className="relative rounded-2xl border border-[#DCD0BD] overflow-hidden bg-[#e5e3df] shadow-sm select-none flex flex-col font-sans"
      style={{ height }}
    >
      {/* Top Map Bar: Search Bar, Layer Switcher, Coordinates, and Launch Google Maps */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: Google Search Box & Suggestions Dropdown */}
        {showSearchBar && (
          <div className="relative pointer-events-auto min-w-[200px] sm:min-w-[260px] max-w-sm">
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Search Google Maps road, city, or highway..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearchSubmit(e as any);
                  }
                }}
                onFocus={() => searchResults.length > 0 && setShowResultsDropdown(true)}
                className="w-full pl-8 pr-8 py-1.5 rounded-xl bg-white/95 backdrop-blur-md border border-[#dadce0] text-xs text-[#202124] shadow-md focus:outline-none focus:ring-2 focus:ring-[#4285F4]"
              />
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5f6368]" />
              {isSearching ? (
                <Loader2 size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#4285F4] animate-spin" />
              ) : (
                searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                      setShowResultsDropdown(false);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#70757a] hover:text-[#202124] text-xs font-bold"
                  >
                    ×
                  </button>
                )
              )}
            </div>

            {/* Suggestions Dropdown */}
            {showResultsDropdown && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl border border-[#dadce0] shadow-xl overflow-hidden z-30 max-h-52 overflow-y-auto">
                {searchResults.map((res, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectSearchResult(res)}
                    className="w-full text-left px-3 py-2 text-xs text-[#202124] hover:bg-[#f1f3f4] border-b border-[#f1f3f4] last:border-b-0 flex items-start gap-2"
                  >
                    <MapPin size={13} className="text-[#EA4335] shrink-0 mt-0.5" />
                    <span className="truncate">{res.display_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Center/Right: Google Layer Switcher (Map, Hybrid, Satellite, Terrain) */}
        <div className="flex items-center gap-1.5 pointer-events-auto flex-wrap">
          <div className="flex items-center p-0.5 rounded-xl bg-white/95 backdrop-blur-md border border-[#dadce0] shadow-md text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveLayer('google_roadmap')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition ${
                activeLayer === 'google_roadmap'
                  ? 'bg-[#4285F4] text-white font-bold shadow-xs'
                  : 'text-[#3c4043] hover:bg-[#f1f3f4]'
              }`}
              title="Official Google Maps Roadmap with street names & route shields"
            >
              <span>Map</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveLayer('google_hybrid')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition ${
                activeLayer === 'google_hybrid'
                  ? 'bg-[#4285F4] text-white font-bold shadow-xs'
                  : 'text-[#3c4043] hover:bg-[#f1f3f4]'
              }`}
              title="Google Satellite with road names and highway overlays"
            >
              <span>Hybrid</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveLayer('google_satellite')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition ${
                activeLayer === 'google_satellite'
                  ? 'bg-[#4285F4] text-white font-bold shadow-xs'
                  : 'text-[#3c4043] hover:bg-[#f1f3f4]'
              }`}
              title="Pure Google Satellite imagery"
            >
              <span>Satellite</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveLayer('google_terrain')}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg transition ${
                activeLayer === 'google_terrain'
                  ? 'bg-[#4285F4] text-white font-bold shadow-xs'
                  : 'text-[#3c4043] hover:bg-[#f1f3f4]'
              }`}
              title="Google Terrain & Elevation"
            >
              <span>Terrain</span>
            </button>
          </div>

          {/* GPS Coordinates Badge */}
          <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/95 backdrop-blur-md border border-[#dadce0] text-[11px] font-mono text-[#3c4043] shadow-md">
            <Compass size={12} className="text-[#EA4335]" />
            <span>
              {currentCoords.lat.toFixed(5)}, {currentCoords.lng.toFixed(5)}
            </span>
            <button
              type="button"
              onClick={handleCopyCoords}
              className="p-0.5 text-[#5f6368] hover:text-[#202124]"
              title="Copy Coordinates"
            >
              {copiedCoords ? <CheckCircle size={12} className="text-[#34A853]" /> : <Copy size={12} />}
            </button>
          </div>

          {/* Launch in Google Maps App */}
          <a
            href={`https://www.google.com/maps?q=${currentCoords.lat},${currentCoords.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#1a73e8] text-white text-xs font-bold hover:bg-[#1557b0] transition shadow-md"
            title="Open coordinates directly in Google Maps application"
          >
            <Navigation size={12} />
            <span>Google Maps</span>
            <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* Main Map Container */}
      <div className="w-full flex-1 relative">
        <div ref={leafletContainerRef} className="w-full h-full z-0" />

        {/* Google Maps Logo Watermark in bottom left corner */}
        <div className="absolute bottom-2 left-2 z-10 pointer-events-none flex items-center gap-1 px-2 py-0.5 rounded bg-white/80 backdrop-blur-xs text-[10px] font-bold text-[#5f6368] shadow-2xs">
          <span className="text-[#4285F4]">G</span>
          <span className="text-[#EA4335]">o</span>
          <span className="text-[#FBBC05]">o</span>
          <span className="text-[#4285F4]">g</span>
          <span className="text-[#34A853]">l</span>
          <span className="text-[#EA4335]">e</span>
          <span className="text-[#5f6368] font-normal ml-0.5">Maps Free</span>
        </div>
      </div>

      {/* Floating Controls in bottom right */}
      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-2">
        {/* Street View Quick Launch */}
        <a
          href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${currentCoords.lat},${currentCoords.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/95 backdrop-blur-md border border-[#dadce0] text-xs font-bold text-[#3c4043] hover:text-[#1a73e8] shadow-md transition"
          title="Launch Google Street View 360° panorama at this coordinate"
        >
          <Eye size={13} className="text-[#FBBC05]" />
          <span>Street View</span>
        </a>

        {/* Zoom Controls */}
        <div className="flex items-center rounded-xl bg-white/95 backdrop-blur-md border border-[#dadce0] shadow-md">
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-1.5 text-[#3c4043] hover:bg-[#f1f3f4] rounded-l-xl transition"
            title="Zoom In"
          >
            <ZoomIn size={14} />
          </button>
          <div className="w-px h-4 bg-[#dadce0]" />
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-1.5 text-[#3c4043] hover:bg-[#f1f3f4] rounded-r-xl transition"
            title="Zoom Out"
          >
            <ZoomOut size={14} />
          </button>
        </div>

        {/* Fine-Tune Pin Nudge for Reporting Mode */}
        {onLocationChange && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsAdjustingPin((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#202124]/90 text-white text-xs font-semibold backdrop-blur-md shadow-md hover:bg-[#202124] transition cursor-pointer"
              title="Fine-tune coordinate position on road"
            >
              <MapPin size={12} className="text-[#EA4335]" />
              <span>{isAdjustingPin ? 'Hide Nudge' : 'Fine-Tune'}</span>
            </button>

            {isAdjustingPin && (
              <div className="absolute right-0 bottom-full mb-1 flex items-center gap-0.5 p-1 rounded-xl bg-white border border-[#dadce0] shadow-xl animate-fade-in">
                <button
                  type="button"
                  onClick={() => handleNudge(0.0001, 0)}
                  className="p-1.5 text-[#3c4043] hover:bg-[#f1f3f4] rounded-lg transition"
                  title="Nudge North"
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => handleNudge(-0.0001, 0)}
                  className="p-1.5 text-[#3c4043] hover:bg-[#f1f3f4] rounded-lg transition"
                  title="Nudge South"
                >
                  <ArrowDown size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => handleNudge(0, -0.0001)}
                  className="p-1.5 text-[#3c4043] hover:bg-[#f1f3f4] rounded-lg transition"
                  title="Nudge West"
                >
                  <ArrowLeft size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => handleNudge(0, 0.0001)}
                  className="p-1.5 text-[#3c4043] hover:bg-[#f1f3f4] rounded-lg transition"
                  title="Nudge East"
                >
                  <ArrowRight size={13} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Helpful banner when in single pin placement mode */}
      {singlePin?.draggable && onLocationChange && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 px-3.5 py-1.5 rounded-full bg-[#202124]/90 text-white text-xs font-medium backdrop-blur-md pointer-events-none shadow-md flex items-center gap-1.5">
          <Move size={12} className="text-[#EA4335]" />
          <span>Click anywhere on roadway or drag pin to position pothole coordinates</span>
        </div>
      )}
    </div>
  );
};
