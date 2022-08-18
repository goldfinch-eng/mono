import { useState } from "react";

import { Icon, Tooltip } from "@/components/design-system";
import { abbreviateAddress } from "@/lib/wallet";

import { Identicon } from "../identicon";

interface AddressProps {
  address: string;
}

export function Address({ address }: AddressProps) {
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
          "Copied to clipboard"
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
        <Identicon account={address} className="h-6 w-6 shrink-0" />
        <span>{abbreviateAddress(address)}</span>
      </button>
    </Tooltip>
  );
}
