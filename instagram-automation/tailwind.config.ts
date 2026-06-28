import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#101114",
        panel: "#f7f7f4",
        line: "#d8d8ce",
        moss: "#496a4c",
        coral: "#e45845",
        steel: "#425466"
      }
    }
  },
  plugins: []
};

export default config;
