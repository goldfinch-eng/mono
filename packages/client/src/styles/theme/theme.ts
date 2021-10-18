import {DefaultTheme} from "styled-components"

export const defaultTheme: DefaultTheme = {
  colors: {
    sandXxxDark: "#9e9994",
    sandXxDark: "#b4ada7",
    sandXDark: "#c3beb7",
    sandDark: "#d6d1cc",
    sand: "#e4e0dd",
    sandLight: "#f1efed",
    sandXLight: "#f8f6f4",

    purpDark: "#483e5e",
    purp: "#675b81",
    purpLight: "#897da3",
    purpXLight: "#ada5bf",
    purpXxLight: "#d1ccdb",

    blueDark: "#67afd7",
    blue: "#75c1eb",
    blueLight: "#96d3f5",
    blueXLight: "#b6e4fe",
    blueXxLight: "#ddeffa",

    redXLight: "#fae6de",
    red: "#e4af98",
    redDark: "#cc937a",
  },
  typography: {
    fontSize: {
      sansSizeXxs: "12px",
      sansSizeXs: "15px",
      sansSizeS: "18px",
      sansSizeM: "21px",
      sansSizeBase: "24px",
      sansSizeMl: "28px",
      sansSizeL: "32px",
      sansSizeXl: "36px",
      sansSizeXxl: "42px",
    },
  },
  breakpoints: {
    screenS: "350px",
    screenM: "600px",
    screenL: "900px",
  },
  widths: {
    contentMaxWidth: "750px",
    navWidth: "180px",
  },
  heights: {
    widgetButtonHeight: "40px",
  },
}
