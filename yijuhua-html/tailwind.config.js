import animate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      opacity: Object.fromEntries(Array.from({ length: 101 }, (_, i) => [i, `${i / 100}`])),
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
      colors: Object.fromEntries(
        ["background", "foreground", "border", "input", "ring"].map((k) => [k, `hsl(var(--${k}))`]).concat(
          ["card", "popover", "primary", "secondary", "muted", "accent", "destructive"].map((k) => [
            k,
            { DEFAULT: `hsl(var(--${k}))`, foreground: `hsl(var(--${k}-foreground))` },
          ])
        )
      ),
    },
  },
  plugins: [animate],
};
