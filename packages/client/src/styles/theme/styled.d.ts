import "styled-components"

interface ColorsObject {
  sandXxxDark: string
  sandXxDark: string
  sandXDark: string
  sandDark: string
  sand: string
  sandLight: string
  sandXLight: string

  purpDark: string
  purp: string
  purpLight: string
  purpXLight: string
  purpXxLight: string

  blueDark: string
  blue: string
  blueLight: string
  blueXLight: string
  blueXxLight: string

  redXLight: string
  red: string
  redDark: string
}

interface FontSizesObject {
  sansSizeXxs: string
  sansSizeXs: string
  sansSizeS: string
  sansSizeM: string
  sansSizeBase: string
  sansSizeMl: string
  sansSizeL: string
  sansSizeXl: string
  sansSizeXxl: string
}

interface TypographyObject {
  fontSize: FontSizesObject
}

interface BreakPointsObject {
  screenS: string
  screenM: string
  screenL: string
}

interface WidthsObject {
  contentMaxWidth: string
  navWidth: string
}

interface HeightsObject {
  widgetButtonHeight: string
}

declare module "styled-components" {
  export interface DefaultTheme {
    colors: ColorsObject
    typography: TypographyObject
    breakpoints: BreakPointsObject
    widths: WidthsObject
    heights: HeightsObject
  }
}
