import { Popover } from "@headlessui/react";
import { useState } from "react";
import { usePopper } from "react-popper";

import { Button } from "@/components/button";
import { useWallet } from "@/lib/wallet";

import { MetaMaskButton } from "./metamask-button";

export function WalletButton() {
  const [referenceElement, setReferenceElement] = useState();
  const [popperElement, setPopperElement] = useState();
  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    strategy: "fixed",
    placement: "bottom",
    modifiers: [
      {
        name: "preventOverflow",
        options: { padding: 16 },
      },
      {
        name: "offset",
        options: {
          offset: [8, 12],
        },
      },
    ],
  });
  const { isActive, account } = useWallet();
  return (
    <Popover>
      {/* @ts-expect-error the ref type doesn't cover callback refs, which are still valid */}
      <Popover.Button ref={setReferenceElement} as={Button}>
        {isActive && account
          ? `${account.substring(0, 6)}...${account.substring(
              account.length - 4
            )}`
          : "Connect Wallet"}
      </Popover.Button>
      <Popover.Panel
        // @ts-expect-error the ref type doesn't cover callback refs, which are still valid
        ref={setPopperElement}
        style={styles.popper}
        {...attributes.popper}
        className="z-10 rounded bg-white p-4 shadow-lg"
      >
        {isActive ? <WalletInfo /> : <WalletSelection />}
      </Popover.Panel>
    </Popover>
  );
}

function WalletSelection() {
  return (
    <div>
      <div className="text-lg">Choose a wallet</div>
      <div>
        <MetaMaskButton />
      </div>
    </div>
  );
}

export function WalletInfo() {
  const { account, connector } = useWallet();
  return (
    <div className="space-y-2">
      <div>
        <div className="font-bold">Wallet address</div>
        <div>{account}</div>
      </div>
      <div className="flex justify-end">
        <Button colorScheme="sand" onClick={() => connector.deactivate()}>
          Disconnect Wallet
        </Button>
      </div>
    </div>
  );
}
