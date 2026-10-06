import type { Metadata } from 'next';
import './globals.css';
import './metric-chapter-details.css';
export const metadata: Metadata = {
  title: 'AVGUST CARE 360',
  description: 'Programa de acompañamiento en campo para el aseguramiento del proceso MIPE en fincas de flores con registro de visitas técnicas, auditoría, mediciones y generación de informes.',
  openGraph: {
    title: 'AVGUST CARE 360',
    description: 'Programa de acompañamiento en campo para el aseguramiento del proceso MIPE en fincas de flores con registro de visitas técnicas, auditoría, mediciones y generación de informes.',
  },
  icons: { icon: '/favicon.svg' },
  manifest: '/manifest.webmanifest'
};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) { return <html lang="es"><head><meta name="theme-color" content="#007fa3"/><meta name="mobile-web-app-capable" content="yes"/><meta name="apple-mobile-web-app-capable" content="yes"/></head><body>{children}</body></html>; }
