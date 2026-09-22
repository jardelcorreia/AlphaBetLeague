import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AlphaBet League - Brasileirão 2026',
    short_name: 'AlphaBet',
    description: 'A plataforma oficial de palpites premium para o Brasileirão.',
    start_url: '/',
    display: 'standalone',
    background_color: '#050810',
    theme_color: '#3b82f6',
    icons: [
      {
        src: '/icons/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable'
      },
      {
        src: '/icons/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      },
    ],
  }
}
