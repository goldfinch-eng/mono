import { useEffect } from "react";

type EventName =
  | "UID_FLOW_INITIATED"
  | "INVESTOR_TYPE_SELECTED"
  | "UID_MINTED"
  | "DEPOSITED_IN_SENIOR_POOL"
  | "DEPOSITED_IN_TRANCHED_POOL";

export function dataLayerPush(
  eventName: EventName,
  attributes?: Record<string, string | number>
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
  dataLayer.push({ event: eventName, ...attributes });
}

/**
 * Pushes a data layer event when this component mounts.
 */
export function useAnalyticsEvent(
  eventName: EventName,
  attributes?: Record<string, string | number>
) {
  useEffect(() => {
    dataLayerPush(eventName, attributes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
