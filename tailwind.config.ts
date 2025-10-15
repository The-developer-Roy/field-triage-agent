import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class", // Enables dark mode via 'class'
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#2563eb", // Tailwind blue-600
          light: "#3b82f6",
          dark: "#1e40af",
        },
        secondary: {
          DEFAULT: "#14b8a6", // Teal-500
          light: "#2dd4bf",
          dark: "#0d9488",
        },
        background: {
          light: "#f9fafb",
          dark: "#0f172a",
        },
        card: {
          light: "#ffffff",
          dark: "#1e293b",
        },
        accent: "#f59e0b",
        danger: "#ef4444",
        success: "#22c55e",
        warning: "#eab308",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
        mono: ["JetBrains Mono", "ui-monospace"],
      },
      boxShadow: {
        soft: "0 2px 10px rgba(0, 0, 0, 0.08)",
        card: "0 4px 14px rgba(0, 0, 0, 0.1)",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        pulseSlow: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
      animation: {
        fadeIn: "fadeIn 0.6s ease-in-out",
        slideUp: "slideUp 0.5s ease-out",
        pulseSlow: "pulseSlow 2s infinite ease-in-out",
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"), // Better form styling
    require("@tailwindcss/typography"), // For rich text and markdown
    require("@tailwindcss/aspect-ratio"), // For media and layout
  ],
};

export default config;
