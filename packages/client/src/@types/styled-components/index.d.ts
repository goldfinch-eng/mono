import "styled-components"

declare module "styled-components" {
  export interface DefaultTheme {
    colors: {
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

      yellow: string
    }
    typography: {
      fontSize: {
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
    }
    breakpoints: {
      screenS: string
      screenM: string
      screenL: string
    }
    widths: {
      contentMaxWidth: string
      navWidth: string
    }
    heights: {
      widgetButtonHeight: string
      iconHeight: string
    }
  }
}
