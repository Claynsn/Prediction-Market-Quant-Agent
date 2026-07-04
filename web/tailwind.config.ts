import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0b0f17",
        panel: "#121826",
        accent: "#5eead4",
      },
    },
  },
  plugins: [],
};

export default config;
