const colors = require("tailwindcss/colors");

module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./stories/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    colors: {
      sand: {
        50: "#f8f6f4",
        100: "#f1efed",
        200: "#e4e0dd",
        300: "#d6d1cc",
        400: "#c3beb7",
        500: "#b4ada7",
        600: "#9e9994",
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
      transparent: "transparent",
      current: "currentColor",
      white: colors.white,
      black: colors.black,
      gray: colors.gray,
    },
    fontFamily: {
      sans: ['"aktiv-grotesk"', "sans-serif"],
    },
    extend: {},
  },
  plugins: [],
};
