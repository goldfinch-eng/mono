import clsx from "clsx";
import {
  MemoryRouter,
  Routes,
  Route,
  useNavigate,
  useLocation,
} from "react-router-dom";

import { Icon } from "@/components/design-system";

import { Home } from "./home";
import { Membership } from "./membership";

export default function DevToolsRouter2() {
  return (
    <MemoryRouter>
      <BackButton />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/membership" element={<Membership />} />
      </Routes>
    </MemoryRouter>
  );
}

function BackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <button
      onClick={() => navigate(-1)}
      className={clsx(
        "absolute top-3 left-3 p-1",
        location.pathname === "/" ? "hidden" : null
      )}
    >
      <Icon name="ArrowSmRight" className="rotate-180" size="md" />
    </button>
  );
}
