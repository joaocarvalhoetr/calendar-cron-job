import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/calendar.ics',
        destination: '/calendar/ics',
      },
    ];
  },
};

export default nextConfig;
