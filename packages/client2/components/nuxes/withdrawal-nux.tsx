import { useRouter } from "next/router";
import { useRef } from "react";

import { Button } from "@/components/design-system";

import { Nux, NuxRef } from "./nux";

export function WithdrawalNux() {
  const nuxRef = useRef<NuxRef>(null);
  const router = useRouter();

  return (
    <Nux ref={nuxRef} prefix="withdrawal" version={1}>
      <div>
        <div className="mb-5 text-center text-lg font-medium">
          🎉 Announcing Senior Pool Withdrawal Requests
        </div>
        <div className="mb-5 text-center ">
          As outlined in GIP-25, LPs must now submit a{" "}
          <strong>Withdrawal Request</strong> to withdraw FIDU from the Senior
          Pool. Here&apos;s how it works:
        </div>
        <ul className="mb-10 list-outside list-disc pl-4 text-xs">
          <li className="mb-3">
            A single Withdrawal Request may be fulfilled over multiple
            distribution periods. Distributions happen every 2 weeks, and
            distribution amounts are variable based on availability of capital
            in the Senior Pool and total amount requested.
          </li>
          <li className="mb-3">
            A Withdrawal Request remains active until it is completely fulfilled
            or cancelled. An LP can only have one active Request at a time.
          </li>
          <li className="mb-3">
            FIDU that is staked or supplied to a Membership Vault must be
            unstaked or removed from the Vault before an LP can submit a request
            to withdraw it from the Senior Pool.
          </li>
          <li>
            Once a Withdrawal Request has been made, it can only be increased or
            cancelled, not reduced. If a Request is cancelled before it is fully
            fulfilled, the LP is charged a cancellation fee.
          </li>
        </ul>

        <div className="flex gap-3">
          <Button
            as="a"
            href="/pools/senior"
            variant="rounded"
            size="lg"
            iconRight="ArrowSmRight"
            className="flex-1"
            onClick={(e) => {
              e.preventDefault();
              nuxRef.current?.closeNux();
              router.push("/pools/senior");
            }}
          >
            Go to Senior Pool
          </Button>
          <Button
            colorScheme="secondary"
            variant="rounded"
            size="lg"
            className="!px-12"
            onClick={() => {
              nuxRef.current?.closeNux();
            }}
          >
            Close
          </Button>
        </div>
      </div>
    </Nux>
  );
}
