import "styled-components"
import {defaultTheme} from "./theme"

type ThemeInterface = typeof defaultTheme

declare module "styled-components" {
  export interface DefaultTheme extends ThemeInterface {}
}
