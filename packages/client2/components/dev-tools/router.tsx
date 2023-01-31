import clsx from "clsx";
import {
  MemoryRouter,
  Routes,
  Route,
  useNavigate,
  useLocation,
} from "react-router-dom";

import { Icon } from "@/components/design-system";

import { BorrowTools } from "./borrow-tools";
import { Home } from "./home";
import { Kyc } from "./kyc";
import { Membership } from "./membership";
import { WithdrawalMechanics } from "./withdrawal-mechanics";

export default function DevToolsRouter2() {
  return (
    <MemoryRouter>
      <BackButton />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/kyc" element={<Kyc />} />
        <Route path="/membership" element={<Membership />} />
        <Route path="/withdrawal-mechanics" element={<WithdrawalMechanics />} />
        <Route path="/borrow" element={<BorrowTools />} />
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
