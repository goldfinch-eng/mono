import {useLocation, useRouteMatch} from "react-router-dom"
import {AppRoute, isAppRoute} from "../types/routes"

export function useCurrentRoute(): AppRoute | undefined {
  const location = useLocation()
  const routeMatch = useRouteMatch(location.pathname)
  if (routeMatch && isAppRoute(routeMatch.path)) {
    return routeMatch.path
  } else {
    console.error(`Unexpected route path: ${routeMatch?.path}`)
    return
  }
}
