// This type respects the GA4 standard for ecommerce events: https://developers.google.com/analytics/devguides/collection/ga4/reference/events?client_type=gtag#purchase_item
type EcommerceEventData = {
  currency: "USD";
  transaction_id: string;
  value: number;
  items: {
    item_id: string;
    item_name: string;
  }[];
};

type Event = {
  UID_FLOW_INITIATED: never;
  INVESTOR_TYPE_SELECTED: { type: "institutional" | "retail" };
  UID_MINTED: { transactionHash: string; uidType: string };
  DEPOSITED_IN_SENIOR_POOL: EcommerceEventData;
  DEPOSITED_IN_TRANCHED_POOL: EcommerceEventData;
  WALLET_CONNECTED: { account: string };
  UID_LOADED: { uidType: string };
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
