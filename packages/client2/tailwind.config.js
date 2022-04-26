const colors = require("tailwindcss/colors");
const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./stories/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    colors: {
      sand: {
        50: "#FAFAF9",
        100: "#F5F5F4",
        200: "#E7E5E4",
        300: "#D6D3D1",
        400: "#A8A29E",
        500: "#78716C",
        600: "#57534E",
        700: "#44403C",
        800: "#292524",
        900: "#1C1917",
      },
      eggplant: {
        50: "#F8F5FD",
        100: "#EAE4F5",
        200: "#E0DAED",
        300: "#CDC3E1",
        400: "#A79CC1",
        500: "#776B91",
        600: "#584C72",
        700: "#45395F",
        800: "#2A1E44",
        900: "#1E1238",
      },
      purple: {
        50: "#d1ccdb",
        100: "#ada5bf",
        200: "#897da3",
        300: "#675b81",
        400: "#483e5e",
      },
      blue: {
        50: "#ddeffa",
        100: "#b6e4fe",
        200: "#96d3f5",
        300: "#75c1eb",
        400: "#67afd7",
      },
      red: {
        50: "#fae6de",
        100: "#e4af98",
        200: "#cc937a",
      },
      sky: {
        50: "#E7F4FD",
        100: "#C0DAEE",
        200: "#9ABEDF",
        300: "#74A0D0",
        400: "#5081C1",
        500: "#3962A8",
        600: "#2B4983",
        700: "#1D325F",
        800: "#1B284C",
        900: "#0F1C3C",
      },
      transparent: "transparent",
      current: "currentColor",
      white: colors.white,
      black: colors.black,
      gray: colors.gray,
    },
    fontFamily: {
      sans: ['"Inter"', "sans-serif"],
      serif: ['"Newsreader Display"', "serif"],
    },
    screens: {
      xs: "400px",
      ...defaultTheme.screens,
    },
    extend: {
      keyframes: {
        "background-oscillate": {
          "0%": { "background-position": "0 50%" },
          "25%": { "background-position": "50 50%" },
          "50%": { "background-position": "100% 50%" },
          "75%": { "background-position": "50% 50%" },
          "100%": { "background-position": "0 50%" },
        },
        marquee: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-100%)" },
        },
      },
      animation: {
        "background-oscillate-slow": "background-oscillate 4s ease-in infinite",
        marquee: "marquee 20s linear infinite",
      },
      backgroundImage: {
        diagonals: "url('/ui/bg-diagonals.png')",
        gradientRed:
          "linear-gradient(180deg, rgba(208, 97, 93, 0) 52.08%, rgba(208, 97, 93, 0.4) 100%)",
      },
      spacing: {
        15: "3.75rem",
      },
    },
  },
  plugins: [],
};
