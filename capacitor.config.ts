import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'co.com.avgust.care360',
  appName: 'AVGUST CARE 360',
  webDir: 'desktop/ui',
  server: {
    // Same origin shape Firebase Auth already allows (localhost). Navigation
    // hosts are the Hosting portal in firebase-applet-config.json. Firestore
    // publish uses fetch and does not need a WebView navigation.
    androidScheme: 'https',
    hostname: 'localhost',
    allowNavigation: [
      'gen-lang-client-0175464290.firebaseapp.com',
      'gen-lang-client-0175464290.web.app',
      'accounts.google.com',
      '*.google.com',
      '*.googleapis.com',
      '*.gstatic.com',
      '*.firebaseapp.com',
    ],
  },
  android: {
    // Android 15 draws the WebView under the status bar. Force margins so
    // battery, signal and notifications stay in their own strip.
    adjustMarginsForEdgeToEdge: 'force',
  },
};

export default config;
