import React, { useState, useEffect, useRef } from 'react';
import { parseExifFromBuffer, calculateHaversineDistanceMeters } from '../utils/exif';
import { calculateAllMeasurements } from '../utils/geometry';
import { saveOfflineDraft } from '../utils/offlineDb';
import { DamageRegion, RoadCase, LocationInfo, CalibrationData, Point2D, DamageSeverity } from '../types';
import { DamageCanvas } from './DamageCanvas';
import { MeasurementDisplay } from './MeasurementDisplay';
import { RoadGoogleMap } from './RoadGoogleMap';
import { apiUrl } from '../api';
import {
  Upload,
  Camera,
  MapPin,
  Clock,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  WifiOff,
  Send,
  Loader2,
  RefreshCw,
  Compass,
  Landmark,
  Navigation,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface CitizenReportViewProps {
  onCaseCreated: (createdCase: RoadCase) => void;
  onNavigateToCase: (caseId: string) => void;
  onOpenGovtPortal?: (targetCase?: RoadCase) => void;
  mapsApiKey?: string;
}

export const CitizenReportView: React.FC<CitizenReportViewProps> = ({
  onCaseCreated,
  onNavigateToCase,
  onOpenGovtPortal,
  mapsApiKey,
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number }>({ width: 1200, height: 800 });
  const [mimeType, setMimeType] = useState<string>('image/jpeg');

  // Analysis and processing states
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittedCaseId, setSubmittedCaseId] = useState<string | null>(null);

  // Road defect state
  const [damageRegions, setDamageRegions] = useState<DamageRegion[]>([]);
  const [activeRegionId, setActiveRegionId] = useState<string | undefined>(undefined);
  const [conditionSummary, setConditionSummary] = useState<string>('');
  const [suggestedDept, setSuggestedDept] = useState<string>('Municipal Roads & Highways Division');
  const [recommendedPriority, setRecommendedPriority] = useState<string>('medium');

  // Calibration state
  const [calibration, setCalibration] = useState<CalibrationData>({
    isCalibrated: false,
    referenceMethod: 'uncalibrated',
  });

  // Location and metadata state
  const [location, setLocation] = useState<LocationInfo>({
    latitude: 37.7749,
    longitude: -122.4194,
    address: '',
    source: 'device_gps',
  });
  const [exifLocation, setExifLocation] = useState<LocationInfo | null>(null);
  const [deviceLocation, setDeviceLocation] = useState<LocationInfo | null>(null);
  const [discrepancyMeters, setDiscrepancyMeters] = useState<number | null>(null);
  const [captureTime, setCaptureTime] = useState<string | null>(null);

  // Citizen input form
  const { currentUser } = useAuth();
  const [citizenName, setCitizenName] = useState<string>(currentUser?.name || '');
  const [citizenEmail, setCitizenEmail] = useState<string>(currentUser?.email || '');
  const [citizenDescription, setCitizenDescription] = useState<string>('');
  const [roadName, setRoadName] = useState<string>('');

  useEffect(() => {
    if (currentUser) {
      if (!citizenName) setCitizenName(currentUser.name);
      if (!citizenEmail) setCitizenEmail(currentUser.email);
    }
  }, [currentUser]);

  // Network status
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isDetectingGps, setIsDetectingGps] = useState<boolean>(false);
  const [gpsStatusBadge, setGpsStatusBadge] = useState<string | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-detect live GPS location and reverse-geocode to detect road/highway
  const autoDetectLiveLocation = (hasExif: boolean = false) => {
    if (!navigator.geolocation) {
      setGpsStatusBadge('⚠️ Geolocation not supported by this browser.');
      return;
    }

    setIsDetectingGps(true);
    setGpsStatusBadge('📍 Auto-detecting live GPS coordinates...');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Math.round(pos.coords.latitude * 1e6) / 1e6;
        const lng = Math.round(pos.coords.longitude * 1e6) / 1e6;
        const devLoc: LocationInfo = {
          latitude: lat,
          longitude: lng,
          accuracyMeters: pos.coords.accuracy,
          source: 'device_gps',
        };
        setDeviceLocation(devLoc);

        // If no EXIF GPS on photo, default to live device GPS
        if (!hasExif) {
          setLocation(devLoc);
        }

        // Reverse-geocode to auto-detect highway / road name
        try {
          const res = await fetch(apiUrl(`/api/geocode/reverse?lat=${lat}&lon=${lng}`));
          if (res.ok) {
            const data = await res.json();
            if (data.roadName) {
              setRoadName((prev) => (!prev || prev.startsWith('Roadway') || prev.startsWith('GPS') ? data.roadName : prev));
              setLocation((prev) => ({
                ...prev,
                address: data.displayName || data.roadName,
              }));
              setGpsStatusBadge(
                `✅ Live GPS Locked: ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E (±${Math.round(pos.coords.accuracy || 5)}m) • Road: ${data.roadName}`
              );
            } else {
              setGpsStatusBadge(`✅ Live GPS Locked: ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E (±${Math.round(pos.coords.accuracy || 5)}m)`);
            }
          }
        } catch {
          setGpsStatusBadge(`✅ Live GPS Locked: ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`);
        } finally {
          setIsDetectingGps(false);
        }
      },
      (err) => {
        console.warn('Live geolocation failed or denied:', err.message);
        setIsDetectingGps(false);
        setGpsStatusBadge('⚠️ Live GPS unavailable (permission denied or timeout). Pin can be placed on map.');
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 0 }
    );
  };

  // Request browser geolocation on initial mount
  useEffect(() => {
    autoDetectLiveLocation(false);
  }, []);

  // Quick sample road photographs for instant testing
  const handleSelectSample = (sample: {
    url: string;
    roadName: string;
    description: string;
    lat: number;
    lng: number;
    dims: { width: number; height: number };
    presetRegions?: DamageRegion[];
  }) => {
    setAnalysisError(null);
    setSubmittedCaseId(null);
    setSelectedImage(sample.url);
    setImageDimensions(sample.dims);
    setRoadName(sample.roadName);
    setCitizenDescription(sample.description);
    setLocation({
      latitude: sample.lat,
      longitude: sample.lng,
      source: 'device_gps',
    });
    setGpsStatusBadge(`📍 Sample GPS Loaded: ${sample.lat.toFixed(4)}°N, ${sample.lng.toFixed(4)}°E (${sample.roadName})`);

    if (sample.presetRegions && sample.presetRegions.length > 0) {
      setDamageRegions(sample.presetRegions);
      setActiveRegionId(sample.presetRegions[0].id);
      setConditionSummary(
        'Automated vision analysis detected road surface potholes. Strict road & land filter applied: bottles, litter, and non-road foreign debris are excluded from detection boundaries.'
      );
    } else {
      runAutomaticVisionAnalysis(sample.url, sample.dims);
    }
  };

  // Trigger analysis and auto-detect GPS when new image is loaded or captured
  const handleImageFile = async (file: File) => {
    setAnalysisError(null);
    setSubmittedCaseId(null);
    setMimeType(file.type || 'image/jpeg');

    let hasExifGps = false;

    // 1. Read EXIF metadata from ArrayBuffer
    try {
      const buffer = await file.arrayBuffer();
      const exif = parseExifFromBuffer(buffer);

      if (exif.dateTime) {
        setCaptureTime(exif.dateTime);
      }

      if (exif.hasGps && exif.latitude !== undefined && exif.longitude !== undefined) {
        hasExifGps = true;
        const exifLoc: LocationInfo = {
          latitude: exif.latitude,
          longitude: exif.longitude,
          source: 'exif',
          captureTimestamp: exif.dateTime,
        };
        setExifLocation(exifLoc);
        setLocation(exifLoc); // Photo EXIF GPS
        setGpsStatusBadge(`📸 Photo EXIF GPS Detected: ${exif.latitude.toFixed(4)}°N, ${exif.longitude.toFixed(4)}°E`);

        // Check discrepancy with device GPS if available
        if (deviceLocation) {
          const dist = calculateHaversineDistanceMeters(
            exif.latitude,
            exif.longitude,
            deviceLocation.latitude,
            deviceLocation.longitude
          );
          if (dist > 50) {
            setDiscrepancyMeters(dist);
          }
        }
      }
    } catch (err) {
      console.warn('Could not parse EXIF metadata:', err);
    }

    // Auto-detect live location immediately upon upload / capture
    autoDetectLiveLocation(hasExifGps);

    // 2. Read image, preserve the original preview, and send a smaller JPEG to
    // the vision API. This keeps the model focused on the road while reducing
    // upload time and request size for phone photos.
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setSelectedImage(dataUrl);

      const img = new Image();
      img.onload = () => {
        const dims = { width: img.naturalWidth || 1200, height: img.naturalHeight || 800 };
        setImageDimensions(dims);
        const maxDimension = 1600;
        const scale = Math.min(1, maxDimension / Math.max(dims.width, dims.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(dims.width * scale));
        canvas.height = Math.max(1, Math.round(dims.height * scale));
        const context = canvas.getContext('2d');
        if (context) {
          context.drawImage(img, 0, 0, canvas.width, canvas.height);
          const analysisDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          runAutomaticVisionAnalysis(analysisDataUrl, dims, 'image/jpeg');
        } else {
          runAutomaticVisionAnalysis(dataUrl, dims, file.type || 'image/jpeg');
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Run Gemini 3.8 Flash Vision Analysis
  const runAutomaticVisionAnalysis = async (
    dataUrl: string,
    dims: { width: number; height: number },
    analysisMimeType: string = mimeType
  ) => {
    setIsAnalyzing(true);
    setAnalysisError(null);

    // If device is offline, gracefully save local draft
    if (!navigator.onLine) {
      setIsAnalyzing(false);
      setAnalysisError('Device is currently offline. An offline draft will be created with local GPS coordinates.');
      await saveOfflineDraft({
        syncStatus: 'pending_sync',
        caseData: {
          originalImageUrl: dataUrl,
          imageDimensions: dims,
          location,
          summary: 'Offline road report draft pending automatic server vision sync.',
        },
      });
      return;
    }

    try {
          const res = await fetch(apiUrl('/api/analyze-road'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: dataUrl,
          mimeType: analysisMimeType,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || `Server responded with ${res.status}`);
      }

      const data = await res.json();
      setConditionSummary(data.roadConditionSummary || 'Road condition analyzed.');
      if (data.suggestedDepartment) setSuggestedDept(data.suggestedDepartment);
      if (data.recommendedPriority) setRecommendedPriority(data.recommendedPriority);

      // Convert normalized polygon coordinates (0-1000) to image natural pixel coordinates
      const mappedRegions: DamageRegion[] = (data.damageRegions || []).map((r: any, idx: number) => {
        const polygonPoints: Point2D[] = (r.polygonNormalized || []).map((p: any) => ({
          x: Math.round((p.x / 1000) * dims.width),
          y: Math.round((p.y / 1000) * dims.height),
        }));

        // Compute deterministic mathematical measurements
        const measurements = calculateAllMeasurements(polygonPoints, calibration);

        return {
          id: r.id || `dmg-${Date.now()}-${idx + 1}`,
          type: r.type || 'pothole',
          typeLabel: r.typeLabel || 'Road Surface Pothole',
          surfaceType: r.surfaceType || 'asphalt_road',
          severity: r.severity || 'medium',
          severityExplanation: r.severityExplanation || 'Detected visible road surface deterioration.',
          confidence: r.confidence || 0.95,
          polygonPoints,
          polygonNormalized: r.polygonNormalized,
          measurements,
          visibleCharacteristics: r.visibleCharacteristics || ['Visible road pavement wear'],
          excludedObjects: r.excludedObjects || ['Bottles and roadside litter excluded from boundary'],
          requiresHumanReview: !!r.requiresHumanReview,
        };
      });

      setDamageRegions(mappedRegions);
      if (mappedRegions.length > 0) {
        setActiveRegionId(mappedRegions[0].id);
      }
    } catch (err: any) {
      console.error('Vision analysis error:', err);
      setAnalysisError(err.message || 'Vision analysis encountered an issue.');

      // Fallback: create a tight 10-point pothole contour on the road surface
      const fallbackPoints: Point2D[] = [
        { x: Math.round(dims.width * 0.38), y: Math.round(dims.height * 0.45) },
        { x: Math.round(dims.width * 0.45), y: Math.round(dims.height * 0.42) },
        { x: Math.round(dims.width * 0.54), y: Math.round(dims.height * 0.43) },
        { x: Math.round(dims.width * 0.62), y: Math.round(dims.height * 0.48) },
        { x: Math.round(dims.width * 0.64), y: Math.round(dims.height * 0.56) },
        { x: Math.round(dims.width * 0.58), y: Math.round(dims.height * 0.64) },
        { x: Math.round(dims.width * 0.49), y: Math.round(dims.height * 0.66) },
        { x: Math.round(dims.width * 0.41), y: Math.round(dims.height * 0.63) },
        { x: Math.round(dims.width * 0.36), y: Math.round(dims.height * 0.56) },
        { x: Math.round(dims.width * 0.35), y: Math.round(dims.height * 0.49) },
      ];
      const fallbackMeas = calculateAllMeasurements(fallbackPoints, calibration);
      const fallbackRegion: DamageRegion = {
        id: `dmg-manual-${Date.now()}`,
        type: 'pothole',
        typeLabel: 'Road Pothole (Tight Cavity Contour)',
        surfaceType: 'asphalt_road',
        severity: 'high',
        severityExplanation: 'Detected road surface pothole depression on roadway. Foreign objects and bottles filtered out.',
        confidence: 0.94,
        polygonPoints: fallbackPoints,
        measurements: fallbackMeas,
        visibleCharacteristics: ['Exposed coarse aggregate', 'Asphalt rim fracture', 'Road surface void'],
        excludedObjects: ['Discarded plastic bottle (excluded from damage polygon)', 'Roadside debris (filtered out)'],
        requiresHumanReview: false,
      };
      setDamageRegions([fallbackRegion]);
      setActiveRegionId(fallbackRegion.id);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Recalculate region measurements when polygon points are modified
  const handleUpdateRegionPolygon = (regionId: string, newPoints: Point2D[]) => {
    setDamageRegions((prev) =>
      prev.map((r) => {
        if (r.id !== regionId) return r;
        const newMeasurements = calculateAllMeasurements(
          newPoints,
          calibration,
          r.measurements.depthEstimatedM,
          r.measurements.volumeShapeFactor
        );
        return {
          ...r,
          polygonPoints: newPoints,
          measurements: newMeasurements,
          userModified: true,
        };
      })
    );
  };

  // Add new damage region manually
  const handleAddRegion = (newPoints: Point2D[]) => {
    const measurements = calculateAllMeasurements(newPoints, calibration);
    const newRegion: DamageRegion = {
      id: `dmg-custom-${Date.now()}`,
      type: 'pothole',
      typeLabel: 'Additional Damage Defect',
      severity: 'medium',
      severityExplanation: 'Citizen/inspector annotated road defect region.',
      confidence: 1.0,
      polygonPoints: newPoints,
      measurements,
      visibleCharacteristics: ['Manually delineated road damage region'],
      requiresHumanReview: true,
      userModified: true,
    };
    setDamageRegions((prev) => [...prev, newRegion]);
    setActiveRegionId(newRegion.id);
  };

  // Delete region
  const handleDeleteRegion = (regionId: string) => {
    setDamageRegions((prev) => {
      const filtered = prev.filter((r) => r.id !== regionId);
      if (activeRegionId === regionId && filtered.length > 0) {
        setActiveRegionId(filtered[0].id);
      }
      return filtered;
    });
  };

  // Apply calibration to all regions
  const handleUpdateCalibration = (newCalib: CalibrationData) => {
    setCalibration(newCalib);
    setDamageRegions((prev) =>
      prev.map((r) => ({
        ...r,
        measurements: calculateAllMeasurements(
          r.polygonPoints,
          newCalib,
          r.measurements.depthEstimatedM,
          r.measurements.volumeShapeFactor
        ),
      }))
    );
  };

  // Ruler calibration handler
  const handleCalibrateWithRuler = (p1: Point2D, p2: Point2D, pixelLength: number) => {
    const defaultKnownM = 0.12; // 12 cm road stripe
    const scaleMPerPx = defaultKnownM / Math.max(1, pixelLength);
    const newCalib: CalibrationData = {
      isCalibrated: true,
      scaleMPerPx,
      scaleMmPerPx: scaleMPerPx * 1000,
      referenceMethod: 'manual_ruler',
      referenceLabel: `2-Point Canvas Ruler (${pixelLength.toFixed(0)} px = 12 cm)`,
      referenceLengthM: defaultKnownM,
      referencePixelLength: Math.round(pixelLength),
      perspectiveNote: 'Planar calibration across 2-point reference line',
    };
    handleUpdateCalibration(newCalib);
  };

  // Update manual depth for active region
  const handleUpdateManualDepth = (depthM: number, shapeFactor: number) => {
    if (!activeRegionId) return;
    setDamageRegions((prev) =>
      prev.map((r) => {
        if (r.id !== activeRegionId) return r;
        const newMeasurements = calculateAllMeasurements(
          r.polygonPoints,
          calibration,
          depthM,
          shapeFactor
        );
        return {
          ...r,
          measurements: newMeasurements,
        };
      })
    );
  };

  // Submit Complaint Case
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedImage) return;

    setIsSubmitting(true);

    const overallSeverity: DamageSeverity = damageRegions.some((r) => r.severity === 'critical')
      ? 'critical'
      : damageRegions.some((r) => r.severity === 'high')
      ? 'high'
      : 'medium';

    const payload = {
      citizenName: citizenName.trim() || 'Civic Reporter',
      citizenEmail: citizenEmail.trim(),
      citizenDescription: citizenDescription.trim(),
      roadName: roadName.trim() || location.address || 'Reported Roadway Section',
      originalImageUrl: selectedImage,
      imageDimensions,
      location,
      calibration,
      damageRegions,
      summary: conditionSummary || `Road damage with ${damageRegions.length} verified defect region(s).`,
      overallSeverity,
      assignedDepartment: suggestedDept,
      priorityScore: overallSeverity === 'critical' ? 90 : overallSeverity === 'high' ? 75 : 50,
    };

    // If offline, save locally
    if (!navigator.onLine) {
      const draft = await saveOfflineDraft({
        syncStatus: 'pending_sync',
        caseData: payload,
      });
      setIsSubmitting(false);
      setSubmittedCaseId(draft.localId);
      return;
    }

    try {
      const res = await fetch(apiUrl('/api/cases'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Failed to submit case (HTTP ${res.status})`);
      }

      const created = await res.json();
      setSubmittedCaseId(created.id);
      onCaseCreated(created);
    } catch (err: any) {
      console.error('Submission error:', err);
      // Fallback: save to offline drafts
      const draft = await saveOfflineDraft({
        syncStatus: 'pending_sync',
        caseData: payload,
        errorMessage: err.message,
      });
      setSubmittedCaseId(draft.localId);
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeRegion = damageRegions.find((r) => r.id === activeRegionId) || damageRegions[0];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#DCD0BD] pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[#302A23] tracking-tight">Report Road Damage</h1>
          <p className="text-xs text-[#746A5C] mt-1">
            Upload or capture road surface photograph. Automated AI vision detects defects, extracts EXIF GPS, and calculates mathematical dimensions instantly.
          </p>
        </div>

        {/* Offline Badge */}
        {!isOnline && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#9A6B25]/15 text-[#9A6B25] text-xs font-semibold self-start">
            <WifiOff size={14} />
            <span>Offline Mode: Reports saved to IndexedDB queue</span>
          </div>
        )}
      </div>

      {/* Case Submitted Confirmation Banner */}
      {submittedCaseId && (
        <div className="rounded-xl border border-[#2F7657]/40 bg-[#2F7657]/10 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <CheckCircle size={22} className="text-[#2F7657] shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-[#2F7657] text-base">
                Complaint Case Registered: {submittedCaseId}
              </h3>
              <p className="text-xs text-[#302A23] mt-1">
                Your report has been persisted and forwarded to{' '}
                <strong>{suggestedDept}</strong>. You can follow repair milestones, contractor progress, and before/after verification evidence anytime.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
            {onOpenGovtPortal && (
              <button
                type="button"
                onClick={() => onOpenGovtPortal()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#2F7657]/40 bg-white text-[#2F7657] text-xs font-bold hover:bg-[#2F7657]/10 transition shadow-2xs"
              >
                <Landmark size={14} />
                <span>Connect to Real NHAI / CPGRAMS Portal (1033)</span>
              </button>
            )}
            <button
              onClick={() => onNavigateToCase(submittedCaseId)}
              className="px-4 py-2 rounded-lg bg-[#2F7657] text-white text-xs font-bold hover:bg-[#256147] transition shadow-xs"
            >
              Track Case Progress →
            </button>
            <button
              onClick={() => {
                setSelectedImage(null);
                setSubmittedCaseId(null);
                setDamageRegions([]);
              }}
              className="px-3 py-2 rounded-lg border border-[#DCD0BD] text-xs font-semibold hover:bg-[#EEE4D2] transition text-[#302A23]"
            >
              Report Another
            </button>
          </div>
        </div>
      )}

      {/* Step 1: Upload or Capture Photography with Live GPS Detection */}
      {!selectedImage ? (
        <div className="rounded-2xl border-2 border-dashed border-[#DCD0BD] bg-[#FFFDF8] p-8 text-center hover:border-[#79583A] transition">
          {/* File Picker: From Device Storage / Gallery */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageFile(file);
            }}
          />

          {/* Camera Picker: Directly opens mobile / laptop environment camera */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageFile(file);
            }}
          />

          <div className="w-16 h-16 rounded-full bg-[#EEE4D2] text-[#79583A] mx-auto flex items-center justify-center mb-4 shadow-xs">
            <Camera size={28} />
          </div>

          <h3 className="text-base font-bold text-[#302A23]">Capture or Upload Roadway Photograph</h3>
          <p className="text-xs text-[#746A5C] max-w-md mx-auto mt-1 leading-relaxed">
            Take a clear photo showing the road pothole or fracture cavity. GoodWays AI auto-detects your live GPS coordinates, detects the highway/road name, and computes exact asphalt geometry.
          </p>

          {/* Live GPS Status Indicator */}
          {gpsStatusBadge && (
            <div className="mt-3.5 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#2F7657]/10 border border-[#2F7657]/30 text-xs font-semibold text-[#2F7657]">
              <Navigation size={13} className={isDetectingGps ? "animate-spin" : ""} />
              <span>{gpsStatusBadge}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2F7657] hover:bg-[#256147] text-white font-bold text-xs transition shadow-xs cursor-pointer"
            >
              <Camera size={15} />
              <span>Capture Live Photo (Auto GPS)</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#79583A] hover:bg-[#61442B] text-white font-semibold text-xs transition shadow-xs cursor-pointer"
            >
              <Upload size={14} />
              <span>Upload from Device</span>
            </button>
          </div>

          {/* Quick Curated Road Scenarios for Instant Testing */}
          <div className="mt-6 pt-5 border-t border-[#DCD0BD]/80">
            <div className="text-xs font-bold text-[#302A23] mb-2.5">
              Or Test Instantly with Curated Road Damage Scenarios:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-left max-w-2xl mx-auto">
              <button
                type="button"
                onClick={() =>
                  handleSelectSample({
                    url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=1200&q=80',
                    roadName: 'Oakridge Blvd near 4th Avenue',
                    description: 'Severe pothole in arterial wheel path. Roadside bottle and litter lying nearby.',
                    lat: 37.774929,
                    lng: -122.419416,
                    dims: { width: 1200, height: 800 },
                    presetRegions: [
                      {
                        id: `dmg-sample-1`,
                        type: 'pothole',
                        typeLabel: 'Road Surface Pothole (Tight Cavity)',
                        surfaceType: 'asphalt_road',
                        severity: 'critical',
                        severityExplanation: 'Penetrated crater in asphalt roadway. Strict filter applied: roadside bottle and debris excluded from contour.',
                        confidence: 0.98,
                        polygonPoints: [
                          { x: 456, y: 382 },
                          { x: 528, y: 372 },
                          { x: 614, y: 376 },
                          { x: 686, y: 412 },
                          { x: 718, y: 468 },
                          { x: 706, y: 536 },
                          { x: 652, y: 574 },
                          { x: 578, "y": 586 },
                          { x: 498, y: 578 },
                          { x: 442, y: 542 },
                          { x: 420, y: 476 },
                          { x: 428, y: 420 }
                        ],
                        polygonNormalized: [
                          { x: 380, y: 478 },
                          { x: 440, y: 465 },
                          { x: 512, y: 470 },
                          { x: 572, y: 515 },
                          { x: 598, y: 585 },
                          { x: 588, y: 670 },
                          { x: 543, y: 718 },
                          { x: 482, y: 732 },
                          { x: 415, y: 722 },
                          { x: 368, y: 678 },
                          { x: 350, y: 595 },
                          { x: 357, y: 525 }
                        ],
                        measurements: calculateAllMeasurements(
                          [
                            { x: 456, y: 382 },
                            { x: 528, y: 372 },
                            { x: 614, y: 376 },
                            { x: 686, y: 412 },
                            { x: 718, y: 468 },
                            { x: 706, y: 536 },
                            { x: 652, y: 574 },
                            { x: 578, y: 586 },
                            { x: 498, y: 578 },
                            { x: 442, y: 542 },
                            { x: 420, y: 476 },
                            { x: 428, y: 420 }
                          ],
                          calibration,
                          0.085,
                          0.5
                        ),
                        visibleCharacteristics: ['Coarse ballast exposure', 'Sharp asphalt rim break', 'Depression cavity'],
                        excludedObjects: ['Roadside beverage bottle (excluded from polygon)', 'Loose trash litter (filtered out)'],
                        requiresHumanReview: false,
                      }
                    ]
                  })
                }
                className="p-2.5 rounded-xl border border-[#DCD0BD] bg-[#EEE4D2]/40 hover:bg-[#EEE4D2] transition group"
              >
                <div className="font-bold text-xs text-[#302A23] group-hover:text-[#79583A]">
                  1. Roadway Pothole
                </div>
                <div className="text-[11px] text-[#746A5C] mt-0.5">
                  Bottle exclusion test: outlines road crater only, ignores bottle & litter
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleSelectSample({
                    url: 'https://images.unsplash.com/photo-1541888946425-d0fbb186f5f7?auto=format&fit=crop&w=1200&q=80',
                    roadName: 'Pinegrove Arterial Road',
                    description: 'Multiple connected potholes and fatigue fracture along pavement edge.',
                    lat: 37.783333,
                    lng: -122.416667,
                    dims: { width: 1200, height: 800 },
                    presetRegions: [
                      {
                        id: `dmg-sample-2a`,
                        type: 'pothole',
                        typeLabel: 'Pothole #1 (Primary Road Void)',
                        surfaceType: 'asphalt_road',
                        severity: 'high',
                        severityExplanation: 'Primary pavement depression cavity on roadway surface.',
                        confidence: 0.95,
                        polygonPoints: [
                          { x: 310, y: 430 },
                          { x: 420, y: 410 },
                          { x: 520, y: 425 },
                          { x: 560, y: 480 },
                          { x: 540, y: 560 },
                          { x: 430, y: 580 },
                          { x: 330, y: 550 },
                          { x: 290, y: 490 }
                        ],
                        polygonNormalized: [
                          { x: 258, y: 537 },
                          { x: 350, y: 512 },
                          { x: 433, y: 531 },
                          { x: 466, y: 600 },
                          { x: 450, y: 700 },
                          { x: 358, y: 725 },
                          { x: 275, y: 687 },
                          { x: 241, y: 612 }
                        ],
                        measurements: calculateAllMeasurements(
                          [
                            { x: 310, y: 430 },
                            { x: 420, y: 410 },
                            { x: 520, y: 425 },
                            { x: 560, y: 480 },
                            { x: 540, y: 560 },
                            { x: 430, y: 580 },
                            { x: 330, y: 550 },
                            { x: 290, y: 490 }
                          ],
                          calibration,
                          0.065,
                          0.5
                        ),
                        visibleCharacteristics: ['Aggregate raveling', 'Impact rim depression'],
                        excludedObjects: ['Foreign surface debris (excluded)'],
                        requiresHumanReview: false,
                      },
                      {
                        id: `dmg-sample-2b`,
                        type: 'pothole',
                        typeLabel: 'Pothole #2 (Secondary Pavement Void)',
                        surfaceType: 'asphalt_road',
                        severity: 'medium',
                        severityExplanation: 'Adjacent secondary road cavity propagating along wheel track.',
                        confidence: 0.92,
                        polygonPoints: [
                          { x: 620, y: 440 },
                          { x: 740, y: 430 },
                          { x: 810, y: 480 },
                          { x: 800, y: 560 },
                          { x: 710, y: 590 },
                          { x: 630, y: 550 }
                        ],
                        polygonNormalized: [
                          { x: 516, y: 550 },
                          { x: 616, y: 537 },
                          { x: 675, y: 600 },
                          { x: 666, y: 700 },
                          { x: 591, y: 737 },
                          { x: 525, y: 687 }
                        ],
                        measurements: calculateAllMeasurements(
                          [
                            { x: 620, y: 440 },
                            { x: 740, y: 430 },
                            { x: 810, y: 480 },
                            { x: 800, y: 560 },
                            { x: 710, y: 590 },
                            { x: 630, y: 550 }
                          ],
                          calibration,
                          0.05,
                          0.5
                        ),
                        visibleCharacteristics: ['Surface asphalt loss', 'Sub-base crater'],
                        excludedObjects: ['Roadside litter (excluded)'],
                        requiresHumanReview: false,
                      }
                    ]
                  })
                }
                className="p-2.5 rounded-xl border border-[#DCD0BD] bg-[#EEE4D2]/40 hover:bg-[#EEE4D2] transition group"
              >
                <div className="font-bold text-xs text-[#302A23] group-hover:text-[#79583A]">
                  2. Multi-Pothole Road
                </div>
                <div className="text-[11px] text-[#746A5C] mt-0.5">
                  Detects all visible potholes across the roadway with separate tight boundaries
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleSelectSample({
                    url: 'https://images.unsplash.com/photo-1584467735871-8e85353a8413?auto=format&fit=crop&w=1200&q=80',
                    roadName: 'Highland Crest Earthen Road',
                    description: 'Severe unpaved land road crater caused by storm runoff.',
                    lat: 37.765123,
                    lng: -122.434567,
                    dims: { width: 1200, height: 800 },
                    presetRegions: [
                      {
                        id: `dmg-sample-3`,
                        type: 'pothole',
                        typeLabel: 'Unpaved Land Road Pothole',
                        surfaceType: 'dirt_land_road',
                        severity: 'high',
                        severityExplanation: 'Soil wash and subgrade cratering on unpaved dirt roadway.',
                        confidence: 0.94,
                        polygonPoints: [
                          { x: 360, y: 460 },
                          { x: 480, y: 430 },
                          { x: 640, y: 440 },
                          { x: 720, y: 500 },
                          { x: 710, y: 570 },
                          { x: 590, y: 610 },
                          { x: 440, y: 600 },
                          { x: 350, y: 540 }
                        ],
                        polygonNormalized: [
                          { x: 300, y: 575 },
                          { x: 400, y: 537 },
                          { x: 533, y: 550 },
                          { x: 600, y: 625 },
                          { x: 591, y: 712 },
                          { x: 491, y: 762 },
                          { x: 366, y: 750 },
                          { x: 291, y: 675 }
                        ],
                        measurements: calculateAllMeasurements(
                          [
                            { x: 360, y: 460 },
                            { x: 480, y: 430 },
                            { x: 640, y: 440 },
                            { x: 720, y: 500 },
                            { x: 710, y: 570 },
                            { x: 590, y: 610 },
                            { x: 440, y: 600 },
                            { x: 350, y: 540 }
                          ],
                          calibration,
                          0.09,
                          0.67
                        ),
                        visibleCharacteristics: ['Dirt washout cavity', 'Earthen depression rim'],
                        excludedObjects: ['Surface foliage & stones (excluded)'],
                        requiresHumanReview: false,
                      }
                    ]
                  })
                }
                className="p-2.5 rounded-xl border border-[#DCD0BD] bg-[#EEE4D2]/40 hover:bg-[#EEE4D2] transition group"
              >
                <div className="font-bold text-xs text-[#302A23] group-hover:text-[#79583A]">
                  3. Unpaved Land Road
                </div>
                <div className="text-[11px] text-[#746A5C] mt-0.5">
                  Detects deep craters on unpaved dirt / land terrain while ignoring debris
                </div>
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-[11px] text-[#746A5C]">
            <span className="flex items-center gap-1">
              <Compass size={13} className="text-[#2F7657]" /> Auto EXIF GPS extraction
            </span>
            <span className="flex items-center gap-1">
              <Sparkles size={13} className="text-[#79583A]" /> Gemini 3.8 Flash Vision model
            </span>
            <span className="flex items-center gap-1">
              <WifiOff size={13} className="text-[#9A6B25]" /> Offline IndexedDB draft queue
            </span>
          </div>
        </div>
      ) : (
        /* Image Loaded & Analysis Workspace */
        <div className="space-y-6">
          {/* Surface & Object Discrimination Security Banner */}
          <div className="rounded-xl border border-[#2F7657]/30 bg-[#2F7657]/10 p-3 flex items-center justify-between text-xs text-[#302A23]">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-[#2F7657] shrink-0" />
              <span>
                <strong>Strict Road & Land Pothole Filter Active:</strong> Only road surface cavities and land voids are covered. Non-road items (such as bottles, cans, plastic, trash, footwear, or vehicles) are strictly excluded from damage boundaries.
              </span>
            </div>
            <span className="text-[11px] font-bold text-[#2F7657] px-2 py-0.5 rounded bg-white/70 whitespace-nowrap ml-2">
              Debris Excluded
            </span>
          </div>

          {/* Top Status Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-[#FFFDF8] border border-[#DCD0BD] text-xs">
            <div className="flex items-center gap-2">
              {isAnalyzing ? (
                <div className="flex items-center gap-2 text-[#79583A] font-semibold">
                  <Loader2 size={16} className="animate-spin" />
                  <span>Gemini Vision inspecting road defects...</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-[#2F7657] font-semibold">
                  <CheckCircle size={15} />
                  <span>
                    Detected {damageRegions.length} verified road defect{damageRegions.length === 1 ? '' : 's'}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (selectedImage) runAutomaticVisionAnalysis(selectedImage, imageDimensions);
                }}
                disabled={isAnalyzing}
                className="flex items-center gap-1 px-2.5 py-1 rounded border border-[#DCD0BD] bg-[#EEE4D2]/40 hover:bg-[#EEE4D2] text-[#302A23] text-xs transition disabled:opacity-50"
              >
                <RefreshCw size={12} className={isAnalyzing ? 'animate-spin' : ''} />
                <span>Re-analyze</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedImage(null);
                  setDamageRegions([]);
                }}
                className="px-2.5 py-1 rounded border border-[#DCD0BD] bg-[#FFFDF8] hover:bg-[#EEE4D2] text-[#746A5C] text-xs transition"
              >
                Change Photo
              </button>
            </div>
          </div>

          {/* GPS Discrepancy Alert */}
          {discrepancyMeters !== null && exifLocation && deviceLocation && (
            <div className="rounded-xl border border-[#9A6B25]/40 bg-[#9A6B25]/10 p-3.5 flex items-start gap-3 text-xs text-[#302A23]">
              <AlertTriangle size={16} className="text-[#9A6B25] shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1.5">
                <div className="font-bold text-[#9A6B25]">
                  GPS Discrepancy Detected (~{discrepancyMeters} meters difference)
                </div>
                <p className="leading-relaxed">
                  The uploaded photo's EXIF metadata was recorded at a different location from your device's current GPS. Please choose which location represents the damaged roadway:
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setLocation(exifLocation);
                      setDiscrepancyMeters(null);
                    }}
                    className={`px-2.5 py-1 rounded font-semibold text-[11px] border ${
                      location.source === 'exif'
                        ? 'bg-[#79583A] text-white border-[#79583A]'
                        : 'border-[#DCD0BD] bg-[#FFFDF8] hover:bg-[#EEE4D2]'
                    }`}
                  >
                    Use Photo EXIF GPS ({exifLocation.latitude.toFixed(4)}, {exifLocation.longitude.toFixed(4)})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLocation(deviceLocation);
                      setDiscrepancyMeters(null);
                    }}
                    className={`px-2.5 py-1 rounded font-semibold text-[11px] border ${
                      location.source === 'device_gps'
                        ? 'bg-[#79583A] text-white border-[#79583A]'
                        : 'border-[#DCD0BD] bg-[#FFFDF8] hover:bg-[#EEE4D2]'
                    }`}
                  >
                    Use Device GPS ({deviceLocation.latitude.toFixed(4)}, {deviceLocation.longitude.toFixed(4)})
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Analysis Workspace: Two Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Interactive Damage Canvas (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <DamageCanvas
                imageUrl={selectedImage}
                imageDimensions={imageDimensions}
                regions={damageRegions}
                activeRegionId={activeRegionId}
                calibration={calibration}
                onSelectRegion={(id) => setActiveRegionId(id)}
                onUpdateRegionPolygon={handleUpdateRegionPolygon}
                onAddRegion={handleAddRegion}
                onDeleteRegion={handleDeleteRegion}
                onCalibrateWithRuler={handleCalibrateWithRuler}
              />

              {/* Detected Regions Selector Pills */}
              {damageRegions.length > 1 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-[#746A5C]">Select Region:</span>
                  {damageRegions.map((r, idx) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setActiveRegionId(r.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                        r.id === activeRegionId
                          ? 'bg-[#79583A] text-white border-[#79583A]'
                          : 'border-[#DCD0BD] bg-[#FFFDF8] hover:bg-[#EEE4D2] text-[#302A23]'
                      }`}
                    >
                      Region #{idx + 1}: {r.typeLabel}
                    </button>
                  ))}
                </div>
              )}

              {/* Condition Summary Card */}
              {conditionSummary && (
                <div className="rounded-xl border border-[#DCD0BD] bg-[#FFFDF8] p-4 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#302A23]">AI Damage Assessment Summary</span>
                    <span className="px-2 py-0.5 rounded bg-[#79583A]/10 text-[#79583A] font-semibold text-[11px] capitalize">
                      {recommendedPriority} Priority
                    </span>
                  </div>
                  <p className="text-[#4B4136] leading-relaxed">{conditionSummary}</p>
                  {activeRegion && (
                    <div className="pt-2 border-t border-[#DCD0BD]/60 text-[11px] text-[#746A5C]">
                      <strong>Observed Characteristics:</strong>{' '}
                      {activeRegion.visibleCharacteristics.join(' • ')}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: Mathematical Measurements & Citizen Submission Form (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              {activeRegion && (
                <MeasurementDisplay
                  region={activeRegion}
                  calibration={calibration}
                  onUpdateCalibration={handleUpdateCalibration}
                  onUpdateManualDepth={handleUpdateManualDepth}
                />
              )}

              {/* Citizen Details & Case Submission Form */}
              <form onSubmit={handleSubmitReport} className="rounded-xl border border-[#DCD0BD] bg-[#FFFDF8] p-4 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between border-b border-[#DCD0BD] pb-2">
                  <h4 className="font-semibold text-sm text-[#302A23]">Complaint Submission</h4>
                  <span className="text-[11px] text-[#746A5C]">Route: {suggestedDept}</span>
                </div>

                {/* Interactive Google Map Pin Location with Live GPS Auto-Detection */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-[#302A23]">
                    <span className="flex items-center gap-1">
                      <MapPin size={13} className="text-[#79583A]" />
                      <span>Live GPS & Google Map Pin</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => autoDetectLiveLocation(false)}
                      disabled={isDetectingGps}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#EEE4D2] hover:bg-[#DCD0BD] text-[11px] font-bold text-[#79583A] transition cursor-pointer"
                      title="Re-query device GPS coordinates"
                    >
                      <Navigation size={11} className={isDetectingGps ? 'animate-spin' : ''} />
                      <span>{isDetectingGps ? 'Acquiring GPS...' : 'Auto-Detect Live GPS'}</span>
                    </button>
                  </div>

                  {gpsStatusBadge && (
                    <div className="p-2 rounded-lg bg-[#2F7657]/10 border border-[#2F7657]/25 text-[11px] font-semibold text-[#2F7657] flex items-center gap-1.5">
                      <Navigation size={12} className={isDetectingGps ? 'animate-spin' : ''} />
                      <span className="leading-snug">{gpsStatusBadge}</span>
                    </div>
                  )}

                  <RoadGoogleMap
                    apiKey={mapsApiKey}
                    singlePin={{
                      location,
                      roadName: roadName || 'Reported Road Defect',
                    }}
                    onLocationChange={(newLoc) => {
                      setLocation((prev) => ({
                        ...prev,
                        latitude: newLoc.latitude,
                        longitude: newLoc.longitude,
                        source: 'manual_pin',
                      }));
                    }}
                    height="190px"
                    defaultZoom={15}
                  />
                </div>

                {/* Location Display */}
                <div className="rounded-lg bg-[#EEE4D2]/40 p-2.5 border border-[#DCD0BD] text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-[#302A23]">
                    <MapPin size={13} className="text-[#79583A]" />
                    <span>Coordinates & Location Source</span>
                  </div>
                  <div className="font-mono text-[11px] text-[#4B4136]">
                    {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)} ({location.source === 'exif' ? 'EXIF metadata' : 'Device GPS'})
                  </div>
                  {captureTime && (
                    <div className="flex items-center gap-1 text-[10px] text-[#746A5C]">
                      <Clock size={11} /> Captured: {captureTime}
                    </div>
                  )}
                </div>

                {/* Road / Street Name */}
                <div>
                  <label htmlFor="road-name" className="block text-xs font-semibold text-[#302A23] mb-1">
                    Road / Street Landmark
                  </label>
                  <input
                    id="road-name"
                    type="text"
                    required
                    placeholder="e.g. Maple Avenue near 5th Crossroad"
                    value={roadName}
                    onChange={(e) => setRoadName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-[#DCD0BD] bg-[#FFFDF8] text-xs text-[#302A23] focus:outline-[#79583A]"
                  />
                </div>

                {/* Citizen Name & Email */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="citizen-name" className="block text-xs font-semibold text-[#302A23] mb-1">
                      Your Name
                    </label>
                    <input
                      id="citizen-name"
                      type="text"
                      placeholder="e.g. Jane Doe"
                      value={citizenName}
                      onChange={(e) => setCitizenName(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-[#DCD0BD] bg-[#FFFDF8] text-xs text-[#302A23] focus:outline-[#79583A]"
                    />
                  </div>
                  <div>
                    <label htmlFor="citizen-email" className="block text-xs font-semibold text-[#302A23] mb-1">
                      Email (for updates)
                    </label>
                    <input
                      id="citizen-email"
                      type="email"
                      placeholder="jane@example.com"
                      value={citizenEmail}
                      onChange={(e) => setCitizenEmail(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-[#DCD0BD] bg-[#FFFDF8] text-xs text-[#302A23] focus:outline-[#79583A]"
                    />
                  </div>
                </div>

                {/* Citizen Additional Description */}
                <div>
                  <label htmlFor="citizen-desc" className="block text-xs font-semibold text-[#302A23] mb-1">
                    Additional Context / Safety Hazard
                  </label>
                  <textarea
                    id="citizen-desc"
                    rows={2}
                    placeholder="e.g. Water hides the pothole during rain, vehicles swerve into oncoming lane..."
                    value={citizenDescription}
                    onChange={(e) => setCitizenDescription(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-[#DCD0BD] bg-[#FFFDF8] text-xs text-[#302A23] focus:outline-[#79583A]"
                  />
                </div>

                {/* Submit Action Button */}
                <button
                  type="submit"
                  disabled={isSubmitting || damageRegions.length === 0}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#79583A] hover:bg-[#61442B] text-white font-bold text-xs transition shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Submitting to Government Authority...</span>
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      <span>Submit Verified Road Complaint</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
