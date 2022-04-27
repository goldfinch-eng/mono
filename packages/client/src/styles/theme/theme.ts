import {DefaultTheme} from "styled-components"
import colors from "./colors"
import typography from "./typography"

export const defaultTheme: DefaultTheme = {
  colors,
  typography,
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
    iconHeight: "45px",
  },
}
