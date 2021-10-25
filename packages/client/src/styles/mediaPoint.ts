interface ThemeBreakpoints {
  breakpoints: {
    screenS: string
    screenM: string
    screenL: string
  }
}

interface MediaPoint {
  screenS: string
  screenM: string
  screenL: string
}

export function mediaPoint(theme: ThemeBreakpoints): MediaPoint {
  const screenS = `@media (max-width: ${theme.breakpoints.screenS})`
  const screenM = `@media (max-width: ${theme.breakpoints.screenM})`
  const screenL = `@media (max-width: ${theme.breakpoints.screenL})`

  return {screenS, screenM, screenL}
}
