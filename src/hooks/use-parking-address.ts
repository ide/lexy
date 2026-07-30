import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';

import { formatStreetAddress } from '@/data/parking-address';

type Coordinates = {
  latitude: number;
  longitude: number;
};

/**
 * Resolve a car coordinate to the short street line shown by the Lexus app.
 * Coordinates are rounded to about a meter for a stable, persisted cache key;
 * parked-location refreshes that do not actually move the car reuse the result.
 */
export function useParkingAddress(coordinates?: Coordinates) {
  const latitude = coordinates?.latitude;
  const longitude = coordinates?.longitude;
  const valid =
    typeof latitude === 'number' &&
    Number.isFinite(latitude) &&
    typeof longitude === 'number' &&
    Number.isFinite(longitude) &&
    !(latitude === 0 && longitude === 0);
  const latitudeKey = valid ? latitude.toFixed(5) : null;
  const longitudeKey = valid ? longitude.toFixed(5) : null;

  return useQuery({
    queryKey: ['parking-address', latitudeKey, longitudeKey],
    enabled: valid,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      if (!valid) {
        return null;
      }
      const placemarks = await Location.reverseGeocodeAsync({ latitude, longitude });
      return formatStreetAddress(placemarks[0]);
    },
  });
}
