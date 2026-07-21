import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             "استقامة",
    short_name:       "استقامة",
    description:      "نظام إدارة حلقات القرآن الكريم",
    start_url:        "/",
    display:          "standalone",
    background_color: "#134430",
    theme_color:      "#134430",
    lang:             "ar",
    dir:              "rtl",
    icons: [
      {
        src:     "/icons/icon-192.png",
        sizes:   "192x192",
        type:    "image/png",
        purpose: "any",
      },
      {
        src:     "/icons/icon-512.png",
        sizes:   "512x512",
        type:    "image/png",
        purpose: "any",
      },
      {
        src:     "/icons/maskable-192.png",
        sizes:   "192x192",
        type:    "image/png",
        purpose: "maskable",
      },
      {
        src:     "/icons/maskable-512.png",
        sizes:   "512x512",
        type:    "image/png",
        purpose: "maskable",
      },
    ],
  }
}
