import clsx from "clsx";

import { IconNameType, Icon, Button } from "@/components/design-system";

function CallToAction({
  className,
  mainText,
  icon,
  buttonText,
  href,
}: {
  className?: string;
  mainText: string;
  icon?: IconNameType;
  buttonText: string;
  href: string;
}) {
  const isExternal = href.startsWith("http");
  return (
    <div
      className={clsx(
        className,
        "flex items-center justify-between rounded-lg bg-white p-5"
      )}
    >
      <div className="flex items-center">
        <Icon name="LightningBolt" className="mr-2 text-mustard-400" />
        <div className="text-lg">{mainText}</div>
        {icon ? <Icon name={icon} size="md" className="ml-4" /> : null}
      </div>
      <Button
        colorScheme="mustard"
        variant="rounded"
        size="lg"
        as="a"
        href={href}
        rel={isExternal ? "noopener noreferrer" : undefined}
        target={isExternal ? "_blank" : undefined}
        iconRight={isExternal ? "ArrowTopRight" : "ArrowSmRight"}
      >
        {buttonText}
      </Button>
    </div>
  );
}

export function BuyGfiCta() {
  return (
    <CallToAction
      mainText="Buy GFI"
      icon="Gfi"
      buttonText="Buy now"
      href="https://coinmarketcap.com/currencies/goldfinch-protocol/markets/"
    />
  );
}

export function LpInSeniorPoolCta() {
  return (
    <CallToAction
      mainText="LP in the Senior Pool for FIDU"
      buttonText="Invest"
      href="/pools/senior"
    />
  );
}

export function BalancedIsBest({
  colorScheme = "sand",
  className,
}: {
  colorScheme?: "sand" | "tidepool";
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "rounded-xl border p-5",
        colorScheme === "sand"
          ? "border-sand-200 bg-sand-100"
          : "border-tidepool-200 bg-tidepool-100",
        className
      )}
    >
      <div className="mb-1 flex items-center gap-2 text-lg font-medium">
        <Icon name="LightningBolt" className="text-mustard-400" />
        Balanced is best
      </div>
      <div className="text-sm">
        To optimize Member rewards, aim to have balanced amounts of capital and
        GFI in your vault at all times.
      </div>
    </div>
  );
}
