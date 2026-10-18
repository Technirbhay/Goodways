import { GovernmentPortalRouting, LocationInfo, DamageRegion, DamageSeverity } from '../types';

/**
 * Evaluates roadway name and context to automatically route the grievance
 * to the appropriate Indian Government Authority (NHAI Rajmargyatra, CPGRAMS, or State PWD).
 */
export function determineGovernmentRouting(
  roadName: string,
  location: LocationInfo,
  regions: DamageRegion[],
  overallSeverity: DamageSeverity,
  caseId: string,
  citizenName?: string,
  citizenDescription?: string
): GovernmentPortalRouting {
  const normalizedRoad = (roadName || '').toLowerCase();

  const isNationalHighway =
    normalizedRoad.includes('nh-') ||
    normalizedRoad.includes('nh ') ||
    normalizedRoad.includes('national highway') ||
    normalizedRoad.includes('expressway') ||
    normalizedRoad.includes('bypass') ||
    normalizedRoad.includes('arterial corridor');

  const isStateHighway =
    normalizedRoad.includes('sh-') ||
    normalizedRoad.includes('sh ') ||
    normalizedRoad.includes('state highway') ||
    normalizedRoad.includes('ring road') ||
    normalizedRoad.includes('district road') ||
    normalizedRoad.includes('mdr');

  let roadJurisdiction: GovernmentPortalRouting['roadJurisdiction'] = 'municipal_urban';
  let portalName = 'CPGRAMS — Ministry of Road Transport & Highways (MoRTH)';
  let portalUrl = 'https://pgportal.gov.in/';
  let portalDescription =
    'Government of India Centralised Public Grievance Redress and Monitoring System (CPGRAMS) for national & state road grievances.';
  let helplinePhone = '1800-11-4000';

  if (isNationalHighway) {
    roadJurisdiction = 'national_highway';
    portalName = 'NHAI Rajmargyatra Portal (National Highways Authority of India)';
    portalUrl = 'https://rajmargyatra.nhai.gov.in/';
    portalDescription =
      'Official citizen portal and 24x7 emergency response system for all National Highway stretches across India.';
    helplinePhone = '1033';
  } else if (isStateHighway) {
    roadJurisdiction = 'state_highway';
    portalName = 'State Public Works Department (PWD) & CPGRAMS';
    portalUrl = 'https://pgportal.gov.in/';
    portalDescription =
      'State highway jurisdiction under State PWD and monitored via CPGRAMS public grievance redressal.';
    helplinePhone = '1800-11-4000';
  } else {
    roadJurisdiction = 'municipal_urban';
    portalName = 'Urban Local Body (ULB) & CPGRAMS Grievance Portal';
    portalUrl = 'https://pgportal.gov.in/';
    portalDescription =
      'Municipal Corporation Road Division & Central Public Grievance portal for city street maintenance.';
    helplinePhone = '1913';
  }

  // Format primary damage measurements
  const primaryDmg = regions[0];
  const lengthStr = primaryDmg?.measurements.lengthCm
    ? `${primaryDmg.measurements.lengthCm.toFixed(1)} cm`
    : `${primaryDmg?.measurements.lengthPx || 0} px`;
  const widthStr = primaryDmg?.measurements.widthCm
    ? `${primaryDmg.measurements.widthCm.toFixed(1)} cm`
    : `${primaryDmg?.measurements.widthPx || 0} px`;
  const areaStr = primaryDmg?.measurements.areaCm2
    ? `${primaryDmg.measurements.areaCm2.toLocaleString()} cm²`
    : `${primaryDmg?.measurements.areaPx2.toLocaleString()} px²`;
  const depthStr = primaryDmg?.measurements.depthEstimatedCm
    ? `${primaryDmg.measurements.depthEstimatedCm.toFixed(1)} cm`
    : 'Inspection Gauge Pending';

  // Construct official government formatted grievance dossier
  const dossierSummary = `[OFFICIAL ROAD DAMAGE GRIEVANCE DOSSIER]
Case Tracking ID: ${caseId}
Target Authority: ${portalName}
Portal URL: ${portalUrl}
Emergency / Grievance Helpline: ${helplinePhone}
--------------------------------------------------
1. ROAD IDENTIFICATION
Roadway / Corridor: ${roadName || 'Reported Roadway Section'}
Jurisdiction Category: ${roadJurisdiction.toUpperCase().replace('_', ' ')}
GPS Coordinates: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}
Google Maps Link: https://www.google.com/maps?q=${location.latitude.toFixed(6)},${location.longitude.toFixed(6)}

2. DAMAGE DEFECT METRICS (GOODWAYS AI VISION)
Primary Defect: ${primaryDmg?.typeLabel || 'Road Surface Cavity'}
Surface Type: ${primaryDmg?.surfaceType === 'dirt_land_road' ? 'Unpaved Land / Dirt Road' : 'Paved Roadway Asphalt'}
Foreign Debris Filter: Bottles, cans & roadside trash strictly excluded
Physical Dimensions: Length ${lengthStr} × Width ${widthStr}
Surface Area: ${areaStr}
Estimated Crater Depth: ${depthStr}
Hazard Severity Level: ${overallSeverity.toUpperCase()}

3. CITIZEN WITNESS REPORT
Reporter: ${citizenName || 'Civic Reporter'}
Context: ${citizenDescription || 'Hazardous road cavity causing suspension jolts and traffic safety risks.'}
Timestamp: ${new Date().toISOString()}
--------------------------------------------------
Notice: Generated via GoodWays Infrastructure Intelligence Platform. This dossier provides standardized metric evidence for filing directly into ${portalName}.`;

  return {
    roadJurisdiction,
    portalName,
    portalUrl,
    portalDescription,
    helplinePhone,
    isDirectApiAvailable: false, // Portals mandate citizen mobile OTP validation
    externalFilingStatus: 'not_filed',
    dossierSummary,
  };
}
