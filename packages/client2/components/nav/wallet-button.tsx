import { useEffect, useState } from "react";

import { Button, Popover } from "@/components/design-system";
import { DESIRED_CHAIN_ID } from "@/constants";
import { openWalletModal } from "@/lib/state/actions";
import { abbreviateAddress, useWallet } from "@/lib/wallet";

import { Identicon } from "../identicon";
import { WalletStatus } from "./wallet-status";

export function WalletButton() {
  const { account, error, connector, provider, ENSName } = useWallet();
  const [ENSAvatar, setENSAvatar] = useState<string | null>(null);
  useEffect(() => {
    if (!provider || !account) {
      return;
    }
    const asyncEffect = async () => {
      try {
        const avatar = await provider.getAvatar(account);
        setENSAvatar(avatar);
      } catch (e) {
        // do nothing. an error would occur if the current network doesn't support ENS (this is true on localhost)
      }
    };
    asyncEffect();
  }, [provider, account]);

  return error ? (
    <Button
      variant="rounded"
      className="h-10 text-clay-500"
      iconRight="Exclamation"
      colorScheme="sand"
      onClick={
        error.name === "ChainIdNotAllowedError"
          ? () => connector.activate(DESIRED_CHAIN_ID)
          : openWalletModal
      }
    >
      {error.name === "ChainIdNotAllowedError"
        ? "Wrong network"
        : "Wallet error"}
    </Button>
  ) : account ? (
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
          {ENSName ? ENSName : abbreviateAddress(account)}
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
          <Identicon account={account} scale={3} />
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
