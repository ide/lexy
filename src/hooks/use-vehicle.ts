import { useQuery } from '@tanstack/react-query';
import { fetch } from 'expo/fetch';

import { loadVehicle } from '@/data/vehicle';

const apiUrl = process.env.EXPO_PUBLIC_LEXY_API_URL;

export function useVehicle() {
  return useQuery({
    queryKey: ['vehicle', apiUrl ?? 'stub'],
    queryFn: ({ signal }) => loadVehicle(apiUrl, fetch, signal),
  });
}
