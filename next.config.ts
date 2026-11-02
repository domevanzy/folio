import type { NextConfig } from "next";
const config: NextConfig = {
  serverExternalPackages: ["pdfjs-dist"],
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/api/notebooks/**": [
      "./node_modules/pdfjs-dist/legacy/build/*.mjs",
      "./node_modules/@napi-rs/canvas*/**/*",
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
export default config;
