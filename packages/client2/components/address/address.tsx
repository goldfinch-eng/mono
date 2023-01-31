import { useState } from "react";

import { Icon, Tooltip } from "@/components/design-system";
import { abbreviateAddress } from "@/lib/wallet";

import { Identicon } from "../identicon";

interface AddressProps {
  address: string;
  ENSName?: string | null;
  ENSAvatar?: string | null;
}

export function Address({ address, ENSName, ENSAvatar }: AddressProps) {
  const [showCopied, setShowCopied] = useState(false);
  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 3000);
  };

  return (
    <Tooltip
      placement="right"
      content={
        showCopied ? (
          "Copied address to clipboard"
        ) : (
          <button
            className="flex items-center justify-center"
            onClick={copyAddress}
          >
            <Icon size="sm" name="Copy" />
          </button>
        )
      }
    >
      <button className="flex items-center gap-2" onClick={copyAddress}>
        {ENSAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            src={ENSAvatar}
            className="h-6 w-6 shrink-0 rounded-full object-cover"
          />
        ) : (
          <Identicon account={address} className="h-6 w-6 shrink-0" />
        )}
        <span>{ENSName ? ENSName : abbreviateAddress(address)}</span>
      </button>
    </Tooltip>
  );
}
