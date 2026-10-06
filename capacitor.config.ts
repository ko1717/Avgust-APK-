import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'co.com.avgust.care360',
  appName: 'AVGUST CARE 360',
  webDir: 'desktop/ui',
  android: {
    // Android 15 draws the WebView under the status bar. Force margins so
    // battery, signal and notifications stay in their own strip.
    adjustMarginsForEdgeToEdge: 'force',
  },
};

export default config;
