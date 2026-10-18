export type DamageType =
  | 'pothole'
  | 'longitudinal_crack'
  | 'transverse_crack'
  | 'alligator_crack'
  | 'deteriorated_asphalt'
  | 'surface_deformation'
  | 'waterlogged_pothole'
  | 'edge_cracking'
  | 'other';

export type DamageSeverity = 'low' | 'medium' | 'high' | 'critical';

export type CaseStatus =
  | 'Draft'
  | 'Submitted'
  | 'Pending Review'
  | 'Accepted'
  | 'Assigned'
  | 'Repair In Progress'
  | 'Awaiting Verification'
  | 'Resolved'
  | 'Rejected';

export interface Point2D {
  x: number;
  y: number;
}

export interface CalibrationData {
  isCalibrated: boolean;
  scaleCmPerPx?: number; // centimeters per pixel
  scaleMmPerPx?: number; // millimeters per pixel
  scaleMPerPx?: number; // meters per pixel
  referenceMethod: 'known_object' | 'lane_marking' | 'manhole' | 'manual_ruler' | 'uncalibrated' | 'default_road_gsd';
  referenceLabel?: string;
  referenceLengthM?: number;
  referenceLengthCm?: number;
  referencePixelLength?: number;
  perspectiveNote?: string;
}

export interface GeometricMeasurements {
  lengthPx: number;
  widthPx: number;
  areaPx2: number;
  perimeterPx: number;
  aspectRatio: number;
  // Centimeter dimensions (Primary)
  lengthCm: number;
  widthCm: number;
  areaCm2: number;
  perimeterCm: number;
  // Meter dimensions
  lengthM?: number;
  widthM?: number;
  areaM2?: number;
  perimeterM?: number;
  // Depth & Volume
  depthEstimatedM?: number;
  depthEstimatedCm?: number;
  depthSource?: 'sensor' | 'manual_field_entry' | 'calibrated_gauge' | 'uncalibrated_rgb';
  volumeM3?: number;
  volumeCm3?: number;
  volumeShapeFactor?: number; // e.g. 0.5 for bowl, 0.67 for trench, 1.0 for prism
  uncertaintyNotes: string[];
}

export interface DamageRegion {
  id: string;
  type: DamageType;
  typeLabel: string;
  severity: DamageSeverity;
  severityExplanation: string;
  confidence: number; // 0 to 1
  polygonPoints: Point2D[]; // in original image pixel coordinates
  polygonNormalized?: Point2D[]; // 0-1000 scale
  measurements: GeometricMeasurements;
  visibleCharacteristics: string[];
  requiresHumanReview: boolean;
  userModified?: boolean;
  surfaceType?: 'asphalt_road' | 'concrete_road' | 'dirt_land_road' | 'unpaved_land' | 'paved_road';
  excludedObjects?: string[]; // e.g. ['Plastic bottle', 'Beverage can', 'Loose trash']
}

export interface LocationInfo {
  latitude: number;
  longitude: number;
  address?: string;
  accuracyMeters?: number;
  source: 'exif' | 'device_gps' | 'manual_pin';
  captureTimestamp?: string;
  discrepancyNote?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: 'citizen' | 'official' | 'inspector' | 'system';
  action: string;
  notes?: string;
  fromStatus?: CaseStatus;
  toStatus?: CaseStatus;
}

export interface RepairEvidence {
  id: string;
  timestamp: string;
  stage: 'in_progress' | 'completed';
  imageUrl: string;
  notes: string;
  contractorName?: string;
  materialsUsed?: string;
}

export interface VerificationRecord {
  verifiedAt: string;
  verifierName: string;
  verifierBadge: string;
  decision: 'approved' | 'rejected' | 'rework_needed';
  checklist: {
    surfaceFlatnessConfirmed: boolean;
    edgeSealingInspected: boolean;
    debrisCleared: boolean;
    drainageIntegrityVerified: boolean;
    trafficSafetyReopened: boolean;
  };
  notes: string;
}

export interface GovernmentPortalRouting {
  roadJurisdiction: 'national_highway' | 'state_highway' | 'municipal_urban' | 'rural_local' | 'unknown';
  portalName: string; // e.g. 'NHAI Rajmargyatra', 'CPGRAMS (MoRTH)', 'State PWD Portal'
  portalUrl: string; // e.g. 'https://rajmargyatra.nhai.gov.in/'
  portalDescription: string;
  helplinePhone?: string; // e.g. '1033'
  isDirectApiAvailable: boolean; // false for public portals requiring citizen OTP
  externalReferenceId?: string; // e.g. 'NHAI-2026-89104'
  externalFilingStatus: 'not_filed' | 'filed_by_citizen' | 'forwarded_by_official' | 'acknowledged';
  externalFilingTimestamp?: string;
  dossierSummary: string; // Standardized text dossier ready to copy-paste into official portal
}

export interface SceneValidationResult {
  isRoadScene: boolean;
  sceneCategory: 'asphalt_road' | 'concrete_road' | 'paved_street' | 'dirt_land_road' | 'non_road_scene' | 'unclear_obstructed';
  sceneConfidence: number; // 0 to 1
  roadValidationMessage: string;
  detectedSurfaceCharacteristics?: string[];
}

export interface RoadCase {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: CaseStatus;
  citizenName?: string;
  citizenEmail?: string;
  citizenDescription?: string;
  roadName?: string;
  originalImageUrl: string;
  imageDimensions: { width: number; height: number };
  location: LocationInfo;
  calibration: CalibrationData;
  damageRegions: DamageRegion[];
  summary: string;
  overallSeverity: DamageSeverity;
  assignedDepartment?: string;
  assignedTeam?: string;
  estimatedCompletionDate?: string;
  priorityScore: number; // 1-100
  repairEvidences: RepairEvidence[];
  verification?: VerificationRecord;
  auditTrail: AuditLogEntry[];
  syncStatus?: 'synced' | 'pending_sync' | 'draft';
  clientReportToken?: string; // Idempotency token to prevent duplicate syncs
  governmentIntegration?: GovernmentPortalRouting;
}

export interface Department {
  id: string;
  name: string;
  jurisdiction: string;
  contactEmail: string;
  phone: string;
  activeCasesCount: number;
}

export type UserRole = 'citizen' | 'official';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  department?: string; // For authority (e.g. Municipal Roads & Highways Division)
  badgeNumber?: string; // For authority (e.g. PWD-EXEC-749)
  designation?: string; // e.g. Senior Executive Engineer or Citizen Reporter
  jurisdiction?: string;
  approvalStatus?: 'approved' | 'pending' | 'rejected';
  isSuperAdmin?: boolean;
  authorizedBy?: string;
  createdAt: string;
}

export interface AuthSession {
  user: AppUser;
  token: string;
}

