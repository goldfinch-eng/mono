import { Popover } from "@headlessui/react";
import { useEffect, useState } from "react";
import { usePopper } from "react-popper";

import { Button } from "@/components/designsystem/button";
import { useUsdcContract } from "@/lib/contracts";
import { updateCurrentUserAttributes } from "@/lib/graphql/local-state/actions";
import { useWallet } from "@/lib/wallet";

import { MetaMaskButton } from "./metamask-button";
import { WalletInfo } from "./wallet-info";
import { WalletConnectButton } from "./walletconnect-button";

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

  const { usdcContract } = useUsdcContract();
  useEffect(() => {
    if (account && usdcContract) {
      usdcContract.balanceOf(account).then((value) =>
        updateCurrentUserAttributes({
          account: account,
          usdcBalance: value,
        })
      );
    }
  }, [usdcContract, account]);

  return (
    <Popover>
      <Popover.Button
        // @ts-expect-error the ref type doesn't cover callback refs, which are still valid
        ref={setReferenceElement}
        as={Button}
        iconLeft={account ? undefined : "Wallet"}
      >
        {account
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
      <div className="flex space-x-4">
        <MetaMaskButton />
        <WalletConnectButton />
      </div>
    </div>
  );
}
