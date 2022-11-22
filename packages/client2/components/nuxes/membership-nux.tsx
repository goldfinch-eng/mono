import { useRouter } from "next/router";
import { useRef } from "react";

import { Button } from "@/components/design-system";

import { Nux, NuxRef } from "./nux";

export function MembershipNux() {
  const nuxRef = useRef<NuxRef>(null);
  const router = useRouter();
  return (
    <Nux ref={nuxRef} prefix="membership" version={1}>
      <div className="text-center">
        <div className="mb-5 text-lg font-medium">
          🎉 Announcing Goldfinch Membership
        </div>
        <div className="mb-5">
          Goldfinch Membership offers exclusive benefits, like{" "}
          <strong>Member Rewards</strong>, distributed weekly in FIDU.
        </div>
        <div className="mb-10">
          Become a Member by adding <strong>GFI</strong> and{" "}
          <strong>Capital</strong> to the <strong>Vault</strong> (you can remove
          it at any time).
        </div>
        <Button
          as="a"
          href="/membership"
          variant="rounded"
          size="lg"
          iconRight="ArrowSmRight"
          onClick={(e) => {
            e.preventDefault();
            nuxRef.current?.closeNux();
            router.push("/membership");
          }}
        >
          Try it out
        </Button>
      </div>
    </Nux>
  );
}
