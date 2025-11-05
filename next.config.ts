import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/calendar.ics',
        destination: '/api/calendar/ics',
      },
    ];
  },
  // Garantir que as rotas API são servidas corretamente
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
