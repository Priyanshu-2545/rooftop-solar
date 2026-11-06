import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rooftop solar",
    short_name: "Solar",
    description: "Solar estimate, quote and project status",
    start_url: "/",
    display: "standalone",
    background_color: "#F6F1E7",
    theme_color: "#F6F1E7",
    icons: [{ src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
