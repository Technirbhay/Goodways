export interface ParsedExifData {
  hasGps: boolean;
  latitude?: number;
  longitude?: number;
  altitudeMeters?: number;
  dateTime?: string;
  cameraMake?: string;
  cameraModel?: string;
  orientation?: number;
}

/**
 * Parses EXIF metadata from an ArrayBuffer of a JPEG file.
 */
export function parseExifFromBuffer(buffer: ArrayBuffer): ParsedExifData {
  const result: ParsedExifData = { hasGps: false };
  const view = new DataView(buffer);

  // Check JPEG SOI (0xFFD8)
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) {
    return result;
  }

  let offset = 2;
  const length = view.byteLength;

  while (offset < length - 4) {
    const marker = view.getUint16(offset);
    offset += 2;

    // APP1 marker (0xFFE1)
    if (marker === 0xffe1) {
      const app1Length = view.getUint16(offset);
      offset += 2;

      // Check for 'Exif\0\0' (0x457869660000)
      if (
        view.getUint8(offset) === 0x45 &&
        view.getUint8(offset + 1) === 0x78 &&
        view.getUint8(offset + 2) === 0x69 &&
        view.getUint8(offset + 3) === 0x66 &&
        view.getUint8(offset + 4) === 0x00 &&
        view.getUint8(offset + 5) === 0x00
      ) {
        parseTiffHeader(view, offset + 6, result);
        return result;
      }
      offset += app1Length - 2;
    } else if ((marker & 0xff00) === 0xff00) {
      // Skip other markers
      const markerLength = view.getUint16(offset);
      offset += markerLength;
    } else {
      break;
    }
  }

  return result;
}

function parseTiffHeader(view: DataView, tiffOffset: number, result: ParsedExifData) {
  if (tiffOffset + 8 > view.byteLength) return;

  // Byte order: 0x4949 ('II' = little endian), 0x4D4D ('MM' = big endian)
  const byteOrder = view.getUint16(tiffOffset);
  const littleEndian = byteOrder === 0x4949;

  // Check 0x002A
  if (view.getUint16(tiffOffset + 2, littleEndian) !== 0x002a) return;

  // Offset to first IFD (IFD0)
  const firstIfdOffset = view.getUint32(tiffOffset + 4, littleEndian);
  if (firstIfdOffset < 8) return;

  let gpsIfdOffset = -1;
  let exifSubIfdOffset = -1;

  // Parse IFD0
  parseIfd(
    view,
    tiffOffset + firstIfdOffset,
    tiffOffset,
    littleEndian,
    (tag, type, count, valueOffset) => {
      if (tag === 0x8825) {
        // GPSInfo IFD pointer
        gpsIfdOffset = view.getUint32(valueOffset, littleEndian);
      } else if (tag === 0x8769) {
        // Exif IFD pointer
        exifSubIfdOffset = view.getUint32(valueOffset, littleEndian);
      } else if (tag === 0x0132) {
        // DateTime
        result.dateTime = readAsciiString(view, valueOffset, count);
      } else if (tag === 0x010f) {
        // Make
        result.cameraMake = readAsciiString(view, valueOffset, count);
      } else if (tag === 0x0110) {
        // Model
        result.cameraModel = readAsciiString(view, valueOffset, count);
      } else if (tag === 0x0112) {
        // Orientation
        result.orientation = view.getUint16(valueOffset, littleEndian);
      }
    }
  );

  // Parse Exif Sub IFD if available for DateTimeOriginal
  if (exifSubIfdOffset > 0 && !result.dateTime) {
    parseIfd(
      view,
      tiffOffset + exifSubIfdOffset,
      tiffOffset,
      littleEndian,
      (tag, type, count, valueOffset) => {
        if (tag === 0x9003 || tag === 0x9004) {
          result.dateTime = readAsciiString(view, valueOffset, count);
        }
      }
    );
  }

  // Parse GPS IFD
  if (gpsIfdOffset > 0) {
    let latRef = 'N';
    let lonRef = 'E';
    let latDeg: number[] | null = null;
    let lonDeg: number[] | null = null;
    let altitude: number | null = null;

    parseIfd(
      view,
      tiffOffset + gpsIfdOffset,
      tiffOffset,
      littleEndian,
      (tag, type, count, valueOffset) => {
        if (tag === 0x0001) {
          // GPSLatitudeRef
          latRef = String.fromCharCode(view.getUint8(valueOffset));
        } else if (tag === 0x0002) {
          // GPSLatitude (3 rationals)
          latDeg = readRationals(view, valueOffset, 3, littleEndian);
        } else if (tag === 0x0003) {
          // GPSLongitudeRef
          lonRef = String.fromCharCode(view.getUint8(valueOffset));
        } else if (tag === 0x0004) {
          // GPSLongitude (3 rationals)
          lonDeg = readRationals(view, valueOffset, 3, littleEndian);
        } else if (tag === 0x0006) {
          // GPSAltitude (1 rational)
          const rats = readRationals(view, valueOffset, 1, littleEndian);
          if (rats.length > 0) altitude = rats[0];
        }
      }
    );

    const validLat = latDeg as number[] | null;
    const validLon = lonDeg as number[] | null;

    if (validLat && validLat.length === 3 && validLon && validLon.length === 3) {
      let lat = validLat[0] + validLat[1] / 60 + validLat[2] / 3600;
      if (latRef === 'S') lat = -lat;

      let lon = validLon[0] + validLon[1] / 60 + validLon[2] / 3600;
      if (lonRef === 'W') lon = -lon;

      if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
        result.hasGps = true;
        result.latitude = Math.round(lat * 1e6) / 1e6;
        result.longitude = Math.round(lon * 1e6) / 1e6;
        if (altitude !== null) {
          result.altitudeMeters = Math.round(altitude * 10) / 10;
        }
      }
    }
  }
}

function parseIfd(
  view: DataView,
  offset: number,
  tiffBase: number,
  littleEndian: boolean,
  callback: (tag: number, type: number, count: number, valueOffset: number) => void
) {
  if (offset + 2 > view.byteLength) return;
  const numEntries = view.getUint16(offset, littleEndian);
  let current = offset + 2;

  for (let i = 0; i < numEntries; i++) {
    if (current + 12 > view.byteLength) break;
    const tag = view.getUint16(current, littleEndian);
    const type = view.getUint16(current + 2, littleEndian);
    const count = view.getUint32(current + 4, littleEndian);

    const typeSize = getTypeSize(type);
    const totalBytes = count * typeSize;

    let valueOffset = current + 8;
    if (totalBytes > 4) {
      const ptr = view.getUint32(current + 8, littleEndian);
      valueOffset = tiffBase + ptr;
    }

    if (valueOffset + totalBytes <= view.byteLength) {
      callback(tag, type, count, valueOffset);
    }

    current += 12;
  }
}

function getTypeSize(type: number): number {
  switch (type) {
    case 1: // BYTE
    case 2: // ASCII
    case 7: // UNDEFINED
      return 1;
    case 3: // SHORT
      return 2;
    case 4: // LONG
      return 4;
    case 5: // RATIONAL
      return 8;
    default:
      return 1;
  }
}

function readAsciiString(view: DataView, offset: number, count: number): string {
  let str = '';
  for (let i = 0; i < count; i++) {
    const charCode = view.getUint8(offset + i);
    if (charCode === 0) break;
    str += String.fromCharCode(charCode);
  }
  return str.trim();
}

function readRationals(
  view: DataView,
  offset: number,
  count: number,
  littleEndian: boolean
): number[] {
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    const entryOffset = offset + i * 8;
    if (entryOffset + 8 > view.byteLength) break;
    const num = view.getUint32(entryOffset, littleEndian);
    const den = view.getUint32(entryOffset + 4, littleEndian);
    result.push(den === 0 ? 0 : num / den);
  }
  return result;
}

/**
 * Distance between two coordinates in meters using the Haversine formula.
 */
export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}
