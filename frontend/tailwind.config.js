/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b1020",
        panel: "#111933",
        edge: "#1f2a4a",
        accent: "#7aa2ff",
        good: "#34d399",
        warn: "#f59e0b",
        bad: "#f87171",
        muted: "#7b87a8",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
}

