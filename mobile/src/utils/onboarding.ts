import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_SEEN_KEY = 'worker_app_onboarding_seen_v1';

export async function hasSeenOnboarding() {
  return AsyncStorage.getItem(ONBOARDING_SEEN_KEY).then(value => value === 'true');
}

export async function markOnboardingSeen() {
  await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, 'true');
}
