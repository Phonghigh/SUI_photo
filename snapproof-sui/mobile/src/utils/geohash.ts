/**
 * Geohash encoding utility.
 * Converts latitude/longitude to a geohash string.
 * We use precision 6 (~1.2 km) for coarse location in proofs.
 */

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

/**
 * Encode a lat/lng pair into a geohash string.
 * @param lat  Latitude  (-90 to 90)
 * @param lng  Longitude (-180 to 180)
 * @param precision  Number of characters (default 6 ≈ 1.2 km box)
 */
export function encodeGeohash(
  lat: number,
  lng: number,
  precision: number = 6
): string {
  let latMin = -90,
    latMax = 90;
  let lngMin = -180,
    lngMax = 180;
  let hash = "";
  let bit = 0;
  let ch = 0;
  let isLng = true; // alternate between lng and lat bits

  while (hash.length < precision) {
    if (isLng) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) {
        ch = ch | (1 << (4 - bit));
        lngMin = mid;
      } else {
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        ch = ch | (1 << (4 - bit));
        latMin = mid;
      } else {
        latMax = mid;
      }
    }

    isLng = !isLng;
    bit++;

    if (bit === 5) {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return hash;
}

/**
 * Decode a geohash string back to a lat/lng bounding box.
 * Returns the center point and error margins.
 */
export function decodeGeohash(hash: string): {
  lat: number;
  lng: number;
  latErr: number;
  lngErr: number;
} {
  let latMin = -90,
    latMax = 90;
  let lngMin = -180,
    lngMax = 180;
  let isLng = true;

  for (const c of hash) {
    const idx = BASE32.indexOf(c);
    if (idx === -1) break;

    for (let bit = 4; bit >= 0; bit--) {
      if (isLng) {
        const mid = (lngMin + lngMax) / 2;
        if (idx & (1 << bit)) {
          lngMin = mid;
        } else {
          lngMax = mid;
        }
      } else {
        const mid = (latMin + latMax) / 2;
        if (idx & (1 << bit)) {
          latMin = mid;
        } else {
          latMax = mid;
        }
      }
      isLng = !isLng;
    }
  }

  const lat = (latMin + latMax) / 2;
  const lng = (lngMin + lngMax) / 2;
  return {
    lat,
    lng,
    latErr: (latMax - latMin) / 2,
    lngErr: (lngMax - lngMin) / 2,
  };
}
