import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Paint Pizarra',
  description: 'Aplicación de pizarra para dibujar estilo Paint'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
