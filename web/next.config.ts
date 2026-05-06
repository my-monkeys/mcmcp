import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow accessing the dev server from the LAN (phone, other devices) so HMR
  // doesn't fail when you visit http://192.168.x.x:3000 instead of localhost.
  allowedDevOrigins: ['192.168.1.69'],
};

export default nextConfig;
