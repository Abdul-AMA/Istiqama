import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             "استقامة",
    short_name:       "استقامة",
    description:      "نظام إدارة حلقات القرآن الكريم",
    start_url:        "/",
    display:          "standalone",
    background_color: "#ffffff",
    theme_color:      "#1e3a5f",
    lang:             "ar",
    dir:              "rtl",
    icons: [
      {
        src:     "/icon.svg",
        sizes:   "any",
        type:    "image/svg+xml",
        purpose: "any",
      },
    ],
  }
}
