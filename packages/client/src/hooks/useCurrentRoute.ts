import {pathToRegexp} from "path-to-regexp"
import {useLocation} from "react-router-dom"
import {AppRoute, appRoutes} from "../types/routes"

export function useCurrentRoute(): AppRoute | undefined {
  const location = useLocation()
  const routeMatch = appRoutes.find((route: string) => pathToRegexp(route).exec(location.pathname))
  if (routeMatch) {
    return routeMatch
  } else {
    console.error(`Failed to match route path: ${location.pathname}`)
    return
  }
}
