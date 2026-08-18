import type { NextConfig } from "next";

const apiOrigin = (
  process.env.RAMEN_API_ORIGIN ??
  "https://ramen-rd-lab.cuteheea0.chatgpt.site"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/api/:path*",
          destination: `${apiOrigin}/api/:path*`,
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
