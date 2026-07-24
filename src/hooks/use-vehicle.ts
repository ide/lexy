import { useQuery } from '@tanstack/react-query';
import { fetch } from 'expo/fetch';

import { fetchVehicle } from '@/data/vehicle';

const apiUrl = process.env.EXPO_PUBLIC_LEXY_API_URL;

export function useVehicle() {
  return useQuery({
    queryKey: ['vehicle'],
    queryFn: ({ signal }) => {
      if (!apiUrl) {
        throw new Error('EXPO_PUBLIC_LEXY_API_URL is not configured');
      }
      return fetchVehicle(apiUrl, fetch, signal);
    },
  });
}
