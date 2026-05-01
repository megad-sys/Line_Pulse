import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["Cabinet Grotesk", "system-ui", "-apple-system", "sans-serif"],
        sans: ["Cabinet Grotesk", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-ibm-plex-mono)", "IBM Plex Mono", "monospace"],
      },
      colors: {
        background: "#F7F5F0",
        surface: "#FFFFFF",
      },
    },
  },
  plugins: [],
};
export default config;
