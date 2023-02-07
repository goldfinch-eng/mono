import clsx from "clsx";
import { ReactNode } from "react";

import {
  Icon,
  IconNameType,
  InfoIconTooltip,
  Shimmer,
} from "@/components/design-system";
import { formatCrypto } from "@/lib/format";

export interface Asset {
  name: ReactNode;
  description: string;
  tooltip?: string;
  icon?: IconNameType;
  usdcAmount: CryptoAmount<"USDC">;
  nativeAmount?: CryptoAmount;
}
interface AssetBoxProps {
  asset: Asset;
  omitWrapperStyle?: boolean;
  /**
   * Whether or not the native token amount should be the primary bolded one in this box
   */
  nativeAmountIsPrimary?: boolean;
  notice?: ReactNode;
  faded?: boolean;
  changeAmount?: CryptoAmount;
}

export function AssetBox({
  asset,
  omitWrapperStyle = false,
  nativeAmountIsPrimary = false,
  notice,
  faded = false,
  changeAmount,
}: AssetBoxProps) {
  const { name, description, icon, tooltip, usdcAmount, nativeAmount } = asset;
  const wrapperStyle = clsx(
    "w-full rounded border border-white bg-white px-5 py-6",
    faded ? "opacity-50" : null
  );
  return (
    <div className={omitWrapperStyle ? "w-full" : wrapperStyle}>
      <div className="mb-1 flex justify-between gap-4">
        <div className="flex items-center gap-2">
          {icon ? <Icon size="md" name={icon} /> : null}
          <div className="text-lg">{name}</div>
          {tooltip ? <InfoIconTooltip content={tooltip} /> : null}
        </div>
        <div className="flex items-center">
          <div className="text-lg font-medium">
            {formatCrypto(
              nativeAmountIsPrimary && nativeAmount ? nativeAmount : usdcAmount
            )}
          </div>
          {changeAmount && !changeAmount.amount.isZero() ? (
            <div
              className={clsx(
                "ml-1 text-sm",

                changeAmount.amount.isNegative()
                  ? "text-clay-500"
                  : "text-mint-450"
              )}
            >
              ({formatCrypto(changeAmount)})
              <Icon
                size="xs"
                name={
                  changeAmount.amount.isNegative() ? "ArrowDown" : "ArrowUp"
                }
              />
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex justify-between gap-4 text-xs font-medium text-sand-400">
        <div>{description}</div>
        {nativeAmount ? (
          <div>
            {formatCrypto(nativeAmountIsPrimary ? usdcAmount : nativeAmount)}
          </div>
        ) : null}
      </div>
      {notice ? (
        <div className="mt-6 rounded bg-mustard-200 p-2.5 text-xs font-medium">
          {notice}
        </div>
      ) : null}
    </div>
  );
}

export function AssetBoxPlaceholder({
  asset = {},
}: {
  asset?: Partial<Asset>;
}) {
  const { name, description, usdcAmount, nativeAmount } = asset;
  return (
    <div className="w-full rounded border border-white bg-white px-5 py-6">
      <div className="mb-1 flex justify-between gap-4">
        {name ? (
          <div className="text-lg">{name}</div>
        ) : (
          <Shimmer style={{ width: "16ch" }} />
        )}
        {usdcAmount ? (
          <div className="text-lg font-medium">{formatCrypto(usdcAmount)}</div>
        ) : (
          <Shimmer style={{ width: "10ch" }} />
        )}
      </div>
      <div className="flex justify-between gap-4 text-xs font-medium text-sand-400">
        {description ? (
          <div>{description}</div>
        ) : (
          <Shimmer style={{ width: "32ch" }} />
        )}
        {nativeAmount ? (
          <div>{formatCrypto(nativeAmount)}</div>
        ) : (
          <Shimmer style={{ width: "16ch" }} />
        )}
      </div>
    </div>
  );
}
