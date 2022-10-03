import clsx from "clsx";
import { BigNumber } from "ethers";

import { Button, InfoIconTooltip } from "@/components/design-system";
import { formatCrypto } from "@/lib/format";
import { SupportedCrypto } from "@/lib/graphql/generated";

interface Asset {
  name: string;
  description: string;
  tooltip?: string;
  dollarValue: BigNumber;
}

interface AssetGroupProps {
  className?: string;
  assets: Asset[];
  background: "sand" | "gold";
  heading: string;
  buttonText: string;
  onButtonClick: () => void;
}

export function AssetGroup({
  className,
  assets,
  background,
  heading,
  buttonText,
  onButtonClick,
}: AssetGroupProps) {
  return (
    <div
      className={clsx(
        className,
        "rounded-xl border p-5",
        background === "sand"
          ? "border-sand-200 bg-sand-100"
          : "border-mustard-200 bg-mustard-200"
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-8 text-lg font-semibold">
        <div>{heading}</div>
        <div>$ total</div>
      </div>
      {assets.length === 0 ? (
        <div>No assets</div>
      ) : (
        <div className="flex flex-col items-stretch gap-2">
          {assets.map((asset, index) => (
            <AssetDisplay key={`${asset.name}-${index}`} asset={asset} />
          ))}
        </div>
      )}
      <Button
        className="mt-4 w-full"
        colorScheme={background === "sand" ? "primary" : "mustard"}
        size="xl"
        onClick={onButtonClick}
      >
        {buttonText}
      </Button>
    </div>
  );
}

function AssetDisplay({ asset }: { asset: Asset }) {
  const { name, description, tooltip, dollarValue } = asset;
  return (
    <div className="flex items-center justify-between rounded bg-white py-6 px-5">
      <div>
        <div className="flex items-center gap-2">
          <div className="mb-1 text-lg">{name}</div>
          {tooltip ? <InfoIconTooltip content={tooltip} /> : null}
        </div>
        <div className="font-medium text-sand-400">{description}</div>
      </div>

      <div className="text-lg font-medium">
        {formatCrypto(
          { amount: dollarValue, token: SupportedCrypto.Usdc },
          { includeToken: true, includeSymbol: true }
        )}
      </div>
    </div>
  );
}
