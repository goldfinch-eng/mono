import { useState } from "react";

import { Button, Icon } from "@/components/design-system";
import { useWallet } from "@/lib/wallet";

import DevToolsButtons from "./dev-tools-buttons";
import DevToolsDrainSeniorPool from "./dev-tools-drain-senior-pool";
import DevToolsKYC from "./dev-tools-kyc";
import { MembershipDevToolDrawer } from "./membership-devtool-drawer";

export function DevToolsPanel(): JSX.Element {
  const [open, setOpen] = useState<boolean>(false);
  const [panel, setPanel] = useState<string>("default");

  const { account } = useWallet();

  function toggleOpen() {
    if (panel === "default") {
      setOpen(false);
    } else {
      setPanel("default");
    }
  }

  const [isMembershipPanelOpen, setIsMembershipPanelOpen] = useState(false);

  if (!account) {
    return <></>;
  }

  return (
    <>
      <div className="fixed bottom-5 right-5 flex gap-5">
        <Button size="lg" onClick={() => setOpen(true)}>
          Dev Tools
        </Button>
        <Button
          size="lg"
          onClick={() => setIsMembershipPanelOpen(true)}
          colorScheme="mustard"
        >
          Membership Dev Tools
        </Button>
      </div>

      {open && (
        <div className="fixed right-5 bottom-20 rounded-xl border border-sand-400 bg-white p-6 shadow-sand-700 drop-shadow-lg ">
          <div className="mb-4 flex items-center justify-between">
            <h5 className="text-xl font-bold">Dev Tools</h5>

            <button onClick={toggleOpen}>
              <Icon name="X" size="md" />
            </button>
          </div>

          {panel === "default" && (
            <DevToolsButtons
              account={account}
              setPanel={(p) => {
                setPanel(p);
              }}
            />
          )}
          {panel === "kyc" && <DevToolsKYC />}
          {panel === "drain-senior-pool" && <DevToolsDrainSeniorPool />}
        </div>
      )}
      <MembershipDevToolDrawer
        size="sm"
        isOpen={isMembershipPanelOpen}
        onClose={() => setIsMembershipPanelOpen(false)}
      />
    </>
  );
}
