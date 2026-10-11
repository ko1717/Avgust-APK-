import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'AVGUST CARE 360',
  description: 'Portal AVGUST CARE 360 para fincas de flores: aseguramiento en campo, capítulos, acciones e informes revisados por el técnico.',
  openGraph: {
    title: 'AVGUST CARE 360',
    description: 'Portal AVGUST CARE 360 para fincas de flores: aseguramiento en campo, capítulos, acciones e informes revisados por el técnico.',
  },
  icons: { icon: '/favicon.svg' },
  manifest: '/manifest.webmanifest'
};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) { return <html lang="es"><head><meta name="theme-color" content="#007fa3"/><meta name="mobile-web-app-capable" content="yes"/><meta name="apple-mobile-web-app-capable" content="yes"/></head><body>{children}</body></html>; }
