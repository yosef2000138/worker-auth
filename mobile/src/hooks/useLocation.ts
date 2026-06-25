import { useState } from 'react';
import * as Location from 'expo-location';
export function useLocation() { const [location, setLocation] = useState<Location.LocationObject | null>(null); const [error, setError] = useState<string | null>(null); const requestLocation = async () => { const { status } = await Location.requestForegroundPermissionsAsync(); if (status !== 'granted') { setError('Location permission denied'); return null; } const current = await Location.getCurrentPositionAsync({}); setLocation(current); return current; }; return { location, error, requestLocation }; }
