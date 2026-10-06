import type { Metadata } from 'next';
import './globals.css';
import './metric-chapter-details.css';
export const metadata: Metadata = { title: 'AVGUST CARE 360 · Informes', description: 'Visitas, listas de chequeo e informes técnicos de AVGUST CARE 360.',icons:{icon:'/favicon.svg'},manifest:'/manifest.webmanifest' };
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) { return <html lang="es"><head><meta name="theme-color" content="#007fa3"/><meta name="mobile-web-app-capable" content="yes"/><meta name="apple-mobile-web-app-capable" content="yes"/></head><body>{children}</body></html>; }
