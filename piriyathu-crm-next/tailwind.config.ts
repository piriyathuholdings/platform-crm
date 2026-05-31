import type { Config } from "tailwindcss";
import daisyui from "daisyui";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        "app-background": "#F8FBFF",
        "surface-subtle": "#EEF6FF",
        "surface-muted": "#EEF2FF",
        "border-subtle": "#D9E7F5",
        "sidebar-base": "#0B1F3A",
        "sidebar-elevated": "#102A4C",
        "text-strong": "#0F172A",
        "text-default": "#1E293B",
        "text-muted": "#64748B"
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        sm: "0.25rem",
        md: "0.5rem",
        lg: "0.75rem",
        xl: "1rem"
      },
      boxShadow: {
        nexus: "0 10px 30px -18px rgba(15, 23, 42, 0.2)"
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-jakarta)", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      fontSize: {
        "metric-lg": ["1.75rem", { lineHeight: "2.25rem", fontWeight: "700" }]
      },
      spacing: {
        "sidebar-width": "272px",
        "topbar-height": "64px"
      }
    }
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        crm: {
          primary: "oklch(45% 0.24 277.023)",
          "primary-content": "#FFFFFF",
          secondary: "#006591",
          "secondary-content": "#FFFFFF",
          accent: "#0EA5E9",
          "accent-content": "#082F49",
          neutral: "#0F172A",
          "neutral-content": "#E2E8F0",
          "base-100": "#FFFFFF",
          "base-200": "#EEF6FF",
          "base-300": "#D9E7F5",
          "base-content": "#0F172A",
          info: "#0284C7",
          success: "#059669",
          warning: "#D97706",
          error: "#DC2626"
        }
      }
    ]
  }
};

export default config;
