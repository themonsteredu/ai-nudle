import type { NextConfig } from "next";

const apiOrigin = (
  process.env.RAMEN_API_ORIGIN ??
  "https://ramen-rd-lab.cuteheea0.chatgpt.site"
).replace(/\/$/, "");
const useRemoteApi = apiOrigin !== "local";

const nextConfig: NextConfig = {
  async rewrites() {
    const remoteRoutes = [
      "/api/settings",
      "/api/students",
      "/api/upload",
      "/api/media/:path*",
    ];

    return {
      beforeFiles: [
        ...(useRemoteApi ? remoteRoutes.map((source) => ({
          source,
          destination: `${apiOrigin}${source}`,
        })) : []),
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
