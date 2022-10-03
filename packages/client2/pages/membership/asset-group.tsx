import clsx from "clsx";
import { BigNumber } from "ethers";
import { ReactNode } from "react";

import { Button, InfoIconTooltip } from "@/components/design-system";
import { formatCrypto } from "@/lib/format";
import { SupportedCrypto } from "@/lib/graphql/generated";
import { sum } from "@/lib/pools";

export interface Asset {
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
  hideButton?: boolean;
  beforeAssets?: ReactNode;
  afterAssets?: ReactNode;
}

export function AssetGroup({
  className,
  assets,
  background,
  heading,
  buttonText,
  onButtonClick,
  hideButton = false,
  beforeAssets = null,
  afterAssets = null,
}: AssetGroupProps) {
  const totalValue = sum("dollarValue", assets);
  return (
    <div
      className={clsx(
        className,
        "space-y-4 rounded-xl border p-5",
        background === "sand"
          ? "border-sand-200 bg-sand-100"
          : "border-mustard-200 bg-mustard-200"
      )}
    >
      <div className="flex items-center justify-between gap-8 text-lg font-semibold">
        <div>{heading}</div>
        <div>
          {formatCrypto(
            { amount: totalValue, token: SupportedCrypto.Usdc },
            { includeSymbol: true, includeToken: false }
          )}
        </div>
      </div>
      {beforeAssets}
      {assets.length === 0 ? null : (
        <div className="flex flex-col items-stretch gap-2">
          {assets.map((asset, index) => (
            <AssetDisplay key={`${asset.name}-${index}`} asset={asset} />
          ))}
        </div>
      )}
      {afterAssets}
      {hideButton ? null : (
        <Button
          className="mt-4 w-full"
          colorScheme={background === "sand" ? "primary" : "mustard"}
          size="xl"
          onClick={onButtonClick}
        >
          {buttonText}
        </Button>
      )}
    </div>
  );
}

function AssetDisplay({ asset }: { asset: Asset }) {
  const { name, description, tooltip, dollarValue } = asset;
  return (
    <div className="flex items-center justify-between rounded bg-white py-6 px-5">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <div className="text-lg">{name}</div>
          {tooltip ? <InfoIconTooltip content={tooltip} /> : null}
        </div>
        <div className="font-medium text-sand-400">{description}</div>
      </div>

      <div className="text-lg font-medium">
        {formatCrypto(
          { amount: dollarValue, token: SupportedCrypto.Usdc },
          { includeSymbol: true }
        )}
      </div>
    </div>
  );
}
