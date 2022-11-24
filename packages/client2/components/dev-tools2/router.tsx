import { createMemoryRouter, RouterProvider } from "react-router-dom";

import { Home } from "./home";
import { Membership } from "./membership";

const router = createMemoryRouter([
  {
    path: "/",
    element: <Home />,
  },
  {
    path: "/membership",
    element: <Membership />,
  },
]);

export default function DevToolsRouter() {
  return <RouterProvider router={router} />;
}
