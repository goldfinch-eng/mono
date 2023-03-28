import { useRef } from "react";

import { Link } from "@/components/design-system";

import { Nux, NuxRef } from "./nux";

export function CallableLoanNux() {
  const nuxRef = useRef<NuxRef>(null);
  return (
    <Nux
      ref={nuxRef}
      prefix="callable-loan"
      version={1}
      shouldShowOnPage={(pathname) =>
        pathname !== "/pools/0x032f7299621c3b68e5d7aceabd567b65e2284da7"
      }
    >
      <div className="mb-2 text-center text-xl font-medium">
        Callable Loans are live!
      </div>
      Explore the new{" "}
      <Link
        href="/pools/0x032f7299621c3b68e5d7aceabd567b65e2284da7"
        onClick={() => nuxRef.current?.closeNux()}
      >
        Fazz Financial deal
      </Link>
      , offering 13% APY and the ability to call back your capital every 3
      months.
    </Nux>
  );
}
