import type { Metadata } from 'next';
import './globals.css';
import Topbar from '../components/topbar';

export const metadata: Metadata = {
  title: 'HAPAX VEIL',
  description: 'Zero-knowledge self-destructing secret platform'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <Topbar />
        {children}
      </body>
    </html>
  );
}