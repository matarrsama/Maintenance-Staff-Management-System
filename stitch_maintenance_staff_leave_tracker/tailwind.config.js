/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./*.html"],
  safelist: [
    "z-[200]",
    "z-[210]",
    "bottom-4",
    "right-4",
    "text-[20px]",
    "text-[18px]",
    "bg-tertiary-container",
    "text-on-tertiary-container",
    "bg-error",
    "text-white",
    "hover:bg-error/90",
    "px-6",
    "pt-6",
    "pb-2"
  ],
  theme: {
  "extend": {
    "colors": {
      "on-error": "#ffffff",
      "surface-dim": "#cbdbf5",
      "surface-tint": "#4059aa",
      "inverse-surface": "#213145",
      "primary": "#00236f",
      "on-secondary-container": "#006f66",
      "on-primary-container": "#90a8ff",
      "on-primary": "#ffffff",
      "surface-variant": "#d3e4fe",
      "secondary-fixed": "#89f5e7",
      "on-surface": "#0b1c30",
      "tertiary-fixed-dim": "#c4c7c9",
      "secondary-container": "#86f2e4",
      "surface-bright": "#f8f9ff",
      "tertiary-container": "#3d4143",
      "on-primary-fixed-variant": "#264191",
      "tertiary": "#272b2d",
      "secondary": "#006a61",
      "surface-container-highest": "#d3e4fe",
      "surface": "#f8f9ff",
      "on-surface-variant": "#444651",
      "surface-container": "#e5eeff",
      "primary-container": "#1e3a8a",
      "primary-fixed": "#dce1ff",
      "tertiary-fixed": "#e0e3e5",
      "on-error-container": "#93000a",
      "error-container": "#ffdad6",
      "error": "#ba1a1a",
      "inverse-primary": "#b6c4ff",
      "on-tertiary-fixed": "#191c1e",
      "on-primary-fixed": "#00164e",
      "outline": "#757682",
      "surface-container-high": "#dce9ff",
      "surface-container-lowest": "#ffffff",
      "surface-container-low": "#eff4ff",
      "on-background": "#0b1c30",
      "on-secondary-fixed": "#00201d",
      "background": "#f8f9ff",
      "on-secondary": "#ffffff",
      "on-tertiary-container": "#aaadaf",
      "secondary-fixed-dim": "#6bd8cb",
      "primary-fixed-dim": "#b6c4ff",
      "inverse-on-surface": "#eaf1ff",
      "on-tertiary": "#ffffff",
      "outline-variant": "#c5c5d3",
      "on-tertiary-fixed-variant": "#444749",
      "on-secondary-fixed-variant": "#005049"
    },
    "borderRadius": {
      "DEFAULT": "0.125rem",
      "lg": "0.25rem",
      "xl": "0.5rem",
      "full": "0.75rem"
    },
    "spacing": {
      "container-padding": "24px",
      "data-density-comfortable": "16px",
      "data-density-compact": "8px",
      "section-gap": "32px",
      "unit": "4px",
      "gutter": "16px"
    },
    "fontFamily": {
      "label-md": [
        "Inter", "system-ui", "Segoe UI", "Arial", "sans-serif"
      ],
      "headline-sm": [
        "Inter", "system-ui", "Segoe UI", "Arial", "sans-serif"
      ],
      "body-md": [
        "Inter", "system-ui", "Segoe UI", "Arial", "sans-serif"
      ],
      "body-lg": [
        "Inter", "system-ui", "Segoe UI", "Arial", "sans-serif"
      ],
      "body-sm": [
        "Inter", "system-ui", "Segoe UI", "Arial", "sans-serif"
      ],
      "headline-lg": [
        "Inter", "system-ui", "Segoe UI", "Arial", "sans-serif"
      ],
      "headline-md": [
        "Inter", "system-ui", "Segoe UI", "Arial", "sans-serif"
      ],
      "headline-lg-mobile": [
        "Inter", "system-ui", "Segoe UI", "Arial", "sans-serif"
      ],
      "data-mono": [
        "Inter", "system-ui", "Segoe UI", "Arial", "sans-serif"
      ]
    },
    "fontSize": {
      "label-md": [
        "12px",
        {
          "lineHeight": "16px",
          "letterSpacing": "0.05em",
          "fontWeight": "600"
        }
      ],
      "headline-sm": [
        "16px",
        {
          "lineHeight": "24px",
          "fontWeight": "600"
        }
      ],
      "body-md": [
        "14px",
        {
          "lineHeight": "20px",
          "fontWeight": "400"
        }
      ],
      "body-lg": [
        "16px",
        {
          "lineHeight": "24px",
          "fontWeight": "400"
        }
      ],
      "body-sm": [
        "13px",
        {
          "lineHeight": "18px",
          "fontWeight": "400"
        }
      ],
      "headline-lg": [
        "32px",
        {
          "lineHeight": "40px",
          "letterSpacing": "-0.02em",
          "fontWeight": "700"
        }
      ],
      "headline-md": [
        "20px",
        {
          "lineHeight": "28px",
          "fontWeight": "600"
        }
      ],
      "headline-lg-mobile": [
        "24px",
        {
          "lineHeight": "32px",
          "letterSpacing": "-0.01em",
          "fontWeight": "700"
        }
      ],
      "data-mono": [
        "14px",
        {
          "lineHeight": "20px",
          "fontWeight": "500"
        }
      ]
    }
  }
},
  plugins: [],
};
