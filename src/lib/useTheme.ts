import { useEffect, useState } from 'react';
import {
  applyTheme,
  devicePrefersLight,
  readPreference,
  resolveTheme,
  savePreference,
  watchDeviceTheme,
  type Theme,
  type ThemePreference,
} from './theme';

/** The user's theme choice, the theme it resolves to now, and setters that save it. */
export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);
  const [prefersLight, setPrefersLight] = useState(devicePrefersLight);
  const theme: Theme = resolveTheme(preference, prefersLight);

  useEffect(() => watchDeviceTheme(setPrefersLight), []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setPreference = (next: ThemePreference) => {
    savePreference(next);
    setPreferenceState(next);
  };

  // The top-bar button: always an explicit Light or Dark, never System.
  const toggleTheme = () => setPreference(theme === 'dark' ? 'light' : 'dark');

  return { preference, theme, setPreference, toggleTheme };
}
