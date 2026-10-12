import type { Metadata } from 'next';
import './globals.css';
const description =
  'Portal AVGUST CARE 360 para fincas de flores: aseguramiento en campo, índice oficial, capítulos, acciones e informes revisados por el técnico.';

export const metadata: Metadata = {
  title: 'AVGUST CARE 360',
  applicationName: 'AVGUST CARE 360',
  description,
  openGraph: {
    title: 'AVGUST CARE 360',
    description,
    locale: 'es_CO',
    type: 'website',
    siteName: 'AVGUST CARE 360'
  },
  icons: {icon: '/favicon.svg', apple: '/favicon.svg'},
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'CARE 360',
    statusBarStyle: 'black-translucent'
  }
};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) { return <html lang="es"><head><meta name="theme-color" content="#007fa3"/><meta name="mobile-web-app-capable" content="yes"/><meta name="apple-mobile-web-app-capable" content="yes"/></head><body>{children}</body></html>; }
