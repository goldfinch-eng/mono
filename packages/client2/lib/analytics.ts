type Event = {
  UID_FLOW_INITIATED: never;
  INVESTOR_TYPE_SELECTED: { type: "institutional" | "retail" };
  UID_MINTED: never;
  DEPOSITED_IN_SENIOR_POOL: { usdAmount: number };
  DEPOSITED_IN_TRANCHED_POOL: {
    tranchedPoolAddress: string;
    usdAmount: number;
  };
};

export function dataLayerPush<T extends keyof Event>(
  ...[event, attributes]: Event[T] extends never
    ? [event: T]
    : [event: T, attributes: Event[T]]
): void {
  const dataLayer = (
    window as unknown as {
      dataLayer: {
        push: (attributes: Record<string, string | number>) => void;
      };
    }
  ).dataLayer;
  if (!dataLayer) {
    return;
  }
  dataLayer.push({ event, ...attributes });
}
