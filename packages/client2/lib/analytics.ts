type Event = {
  UID_FLOW_INITIATED: never;
  INVESTOR_TYPE_SELECTED: { type: "institutional" | "retail" };
  UID_MINTED: never;
  DEPOSITED_IN_SENIOR_POOL: { usdAmount: number };
  DEPOSITED_IN_TRANCHED_POOL: {
    tranchedPoolAddress: string;
    usdAmount: number;
  };
  WALLET_CONNECTED: { account: string };
};

function getDataLayer() {
  return (
    (
      window as unknown as {
        dataLayer: Array<unknown>;
      }
    ).dataLayer ?? []
  );
}

export function dataLayerPushEvent<T extends keyof Event>(
  ...[event, attributes]: Event[T] extends never
    ? [event: T]
    : [event: T, attributes: Event[T]]
): void {
  const dataLayer = getDataLayer();
  dataLayer.push({ event, ...attributes });
}

export function dataLayerPushAttributes(
  attributes: Record<string, string | number>
) {
  const dataLayer = getDataLayer();
  dataLayer.push(attributes);
}
