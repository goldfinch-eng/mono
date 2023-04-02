import { useEffect, useState } from "react";
import {
  useAccount,
  useEnsAvatar,
  useEnsName,
  useNetwork,
  useSwitchNetwork,
} from "wagmi";

import { Button, Popover } from "@/components/design-system";
import { DESIRED_CHAIN_ID } from "@/constants";
import { openWalletModal } from "@/lib/state/actions";
import { abbreviateAddress } from "@/lib/wallet";

import { Identicon } from "../identicon";
import { WalletStatus } from "./wallet-status";

export function WalletButton() {
  // Since autoConnect to on, useAccount returns an address immediately on first render in the client. This causes a conflict between client and server on first render (the hydration step)
  // In order to resolve this conflict, we only render this component on the client
  const [isRenderingOnClient, setIsRenderingOnClient] = useState(false);
  useEffect(() => {
    setIsRenderingOnClient(true);
  }, []);
  const { address } = useAccount();
  const network = useNetwork();
  const skipENS = network.chain?.id === 31337;
  // ENS doesn't exist on Hardhat so we purposefully withhold `address` here to make this skip, otherwise you get an annoying but non-blocking error
  const { data: ENSName } = useEnsName({
    address: skipENS ? undefined : address,
  });
  const { data: ENSAvatar } = useEnsAvatar({
    address: skipENS ? undefined : address,
  });
  const isWrongNetwork = network.chain?.unsupported;
  const { switchNetwork } = useSwitchNetwork();

  return !isRenderingOnClient ? null : isWrongNetwork ? (
    <Button
      variant="rounded"
      className="h-10 !text-clay-500"
      iconRight="Exclamation"
      colorScheme="sand"
      onClick={() => switchNetwork?.(DESIRED_CHAIN_ID)}
    >
      Wrong network
    </Button>
  ) : address ? (
    <Popover
      placement="bottom-end"
      content={({ close }) => <WalletStatus onWalletDisconnect={close} />}
    >
      <Button
        className="inline-flex h-10 items-center gap-3 !px-2 md:!px-4"
        variant="rounded"
        colorScheme="sand"
      >
        <span className="hidden md:block">
          {ENSName ? ENSName : abbreviateAddress(address)}
        </span>
        {ENSAvatar ? (
          // Not using next/image because we can't know the origin of this image ahead of time
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt="Your avatar"
            aria-hidden="true"
            src={ENSAvatar}
            className="h-6 w-6 rounded-full object-cover"
          />
        ) : (
          <Identicon account={address} scale={3} />
        )}
      </Button>
    </Popover>
  ) : (
    <Button
      className="h-10"
      variant="rounded"
      colorScheme="primary"
      onClick={openWalletModal}
    >
      Connect Wallet
    </Button>
  );
}
