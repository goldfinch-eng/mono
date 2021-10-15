export function mediaPoint(theme) {
  const screenS = `@media (max-width: ${theme.breakpoints.screenS})`
  const screenM = `@media (max-width: ${theme.breakpoints.screenM})`
  const screenL = `@media (max-width: ${theme.breakpoints.screenL})`

  return {screenS, screenM, screenL}
}
