import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Photos are downscaled client-side when large; server enforces a 5 MB cap on top of this.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  serverExternalPackages: ["sharp", "@react-pdf/renderer"],
  // Files read at runtime must be traced into the serverless bundle.
  outputFileTracingIncludes: {
    "/*": ["./samples/bills/*", "./assets/fonts/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
