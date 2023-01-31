import { Icon } from "@/components/design-system";
import { formatCrypto } from "@/lib/format";
import { assertUnreachable } from "@/lib/utils";

/**
 * Simple helper component that acts like formatWithCrypto() but provides an icon
 */
export function FormatWithIcon({
  cryptoAmount,
  prefix,
}: {
  cryptoAmount: CryptoAmount;
  prefix?: string;
}) {
  const formatted =
    (prefix ?? "") +
    formatCrypto(cryptoAmount, {
      includeSymbol: false,
      includeToken: false,
    });
  const icon =
    cryptoAmount.token === "USDC" ? (
      <Icon size="md" name="Usdc" />
    ) : cryptoAmount.token === "GFI" ? (
      <Icon size="md" name="Gfi" />
    ) : cryptoAmount.token === "CURVE_LP" ? (
      <Icon size="md" name="Curve" />
    ) : cryptoAmount.token === "FIDU" ? (
      "FIDU"
    ) : (
      assertUnreachable(cryptoAmount.token)
    );

  return (
    <div className="flex items-center gap-2">
      <div>{formatted}</div>
      {icon}
    </div>
  );
}
