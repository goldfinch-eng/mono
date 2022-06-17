import { useState } from "react";

import { Button } from "@/components/design-system";
import { SERVER_URL } from "@/constants";
import { openVerificationModal } from "@/lib/state/actions";

export default function DevToolsButtons({
  account,
  setPanel,
}: {
  account: string;
  setPanel: (panel: string) => void;
}): JSX.Element {
  const [disabled, setDisabled] = useState<boolean>(false);
  const [loading, setLoading] = useState<string | null>(null);

  return (
    <div className="w-[760px]">
      <div className="-mx-2 mb-8 flex">
        <div className="px-2">
          <Button
            size="lg"
            isLoading={loading === "setup"}
            disabled={disabled}
            onClick={async () => {
              setDisabled(true);
              setLoading("setup");

              const response = await fetch(`${SERVER_URL}/setupForTesting`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  address: account,
                }),
              });

              setDisabled(false);
              setLoading(null);

              if (!response.ok) {
                throw new Error("Could not complete testing setup");
              }
            }}
          >
            Setup for Testing
          </Button>
        </div>

        <div className="px-2">
          <Button
            size="lg"
            isLoading={loading === "fund"}
            disabled={disabled}
            onClick={async () => {
              setDisabled(true);
              setLoading("fund");

              const response = await fetch(`${SERVER_URL}/fundWithWhales`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  address: account,
                }),
              });

              setDisabled(false);
              setLoading(null);

              if (!response.ok) {
                throw new Error("Could not fund with whales");
              }
            }}
          >
            Fund With Whales
          </Button>
        </div>

        <div className="px-2">
          <Button
            size="lg"
            isLoading={loading === "advance1"}
            disabled={disabled}
            onClick={async () => {
              setDisabled(true);
              setLoading("advance1");

              const response = await fetch(`${SERVER_URL}/advanceTimeOneDay`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
              });

              setDisabled(false);
              setLoading(null);

              if (!response.ok) {
                throw new Error("Could not advance time");
              }
            }}
          >
            Advance - 1 Day
          </Button>
        </div>

        <div className="px-2">
          <Button
            size="lg"
            isLoading={loading === "advance30"}
            disabled={disabled}
            onClick={async () => {
              setDisabled(true);
              setLoading("advance30");

              const response = await fetch(
                `${SERVER_URL}/advanceTimeThirtyDays`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                }
              );

              setDisabled(false);
              setLoading(null);

              if (!response.ok) {
                throw new Error("Could not advance time");
              }
            }}
          >
            Advance - 30 Days
          </Button>
        </div>
      </div>

      <h5 className="mb-3 font-bold">Additional Tools</h5>
      <div className="-mx-2 flex">
        <div className="px-2">
          <Button
            size="lg"
            disabled={disabled}
            onClick={() => {
              setPanel("kyc");
            }}
          >
            Set KYC
          </Button>
        </div>

        <div className="px-2">
          <Button size="lg" disabled={true}>
            Set User Address
          </Button>
        </div>

        <div className="px-2">
          <Button size="lg" onClick={() => openVerificationModal()}>
            Begin verification flow
          </Button>
        </div>
      </div>
    </div>
  );
}
