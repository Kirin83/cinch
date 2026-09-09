import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: ["pg"],
  async redirects() {
    return [
      {
        source: "/launch",
        destination: "https://www.ponsfamily.com/launchpad/create",
        permanent: false,
      },
      {
        source: "/methodology",
        destination: "/docs",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
