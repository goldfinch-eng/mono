import {defaultTheme} from "../styles/theme"

const screenS = `@media (max-width: ${defaultTheme.breakpoints.screenS})`
const screenM = `@media (max-width: ${defaultTheme.breakpoints.screenM})`
const screenL = `@media (max-width: ${defaultTheme.breakpoints.screenL})`

const MediaPoint = {
  screenS,
  screenM,
  screenL,
}

export default MediaPoint
