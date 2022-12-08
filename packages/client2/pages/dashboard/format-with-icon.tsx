import { Icon } from "@/components/design-system";
import { formatCrypto } from "@/lib/format";
import { SupportedCrypto } from "@/lib/graphql/generated";
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
    cryptoAmount.token === SupportedCrypto.Usdc ? (
      <Icon size="md" name="Usdc" />
    ) : cryptoAmount.token === SupportedCrypto.Gfi ? (
      <Icon size="md" name="Gfi" />
    ) : cryptoAmount.token === SupportedCrypto.CurveLp ? (
      <Icon size="md" name="Curve" />
    ) : cryptoAmount.token === SupportedCrypto.Fidu ? (
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
