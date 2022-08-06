import { Icon, Tooltip } from "@/components/design-system";
import { abbreviateAddress } from "@/lib/wallet";

import { Identicon } from "../identicon";

interface AddressProps {
  address: string;
}

export function Address({ address }: AddressProps) {
  const inner = (
    <div className="flex items-center gap-2">
      <Identicon account={address} className="h-6 w-6 shrink-0" />
      <span>{abbreviateAddress(address)}</span>
    </div>
  );

  if (process.env.NODE_ENV === "production") {
    return inner;
  }
  return (
    <Tooltip
      useWrapper
      content={
        <div className="flex items-center gap-2">
          {address}
          <button
            className="flex items-center justify-center"
            onClick={() => navigator.clipboard.writeText(address)}
          >
            <Icon name="Copy" />
          </button>
        </div>
      }
    >
      {inner}
    </Tooltip>
  );
}
