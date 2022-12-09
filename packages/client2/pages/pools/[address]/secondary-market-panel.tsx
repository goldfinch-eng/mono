import { gql } from "@apollo/client";
import { ReactNode } from "react";

import { Button } from "@/components/design-system";
import {
  BackerSecondaryMarketStatQuery,
  useBackerSecondaryMarketStatQuery,
} from "@/lib/graphql/generated";
import { PoolStatus } from "@/lib/pools";

import LarkLogo from "./lark-logo.svg";

gql`
  query BackerSecondaryMarketStat($poolAddress: String!) {
    backerSecondaryMarket @client {
      collectionStats {
        tokenCount
        onSaleCount
      }
      poolStats(poolAddress: $poolAddress) {
        tokenCount
        onSaleCount
      }
    }
  }
`;

interface PanelProps {
  title: ReactNode;
  icon: ReactNode;
  body: ReactNode;
  buttonText: ReactNode;
  buttonHref: string;
  footer?: ReactNode;
}

function Panel({
  title,
  icon,
  body,
  buttonText,
  buttonHref,
  footer,
}: PanelProps) {
  return (
    <div className="flex flex-col rounded-xl bg-clay-50">
      <div className="mx-5 px-5 py-10">
        <div className="mb-3 flex flex-row items-center justify-between gap-3 text-xl font-semibold">
          <p>{title}</p>
          {icon}
        </div>
        <p className="mb-5">{body}</p>
        <Button
          as="a"
          variant="rounded"
          iconRight="ArrowTopRight"
          target="_blank"
          rel="noreferrer"
          colorScheme="sky"
          size="xl"
          href={buttonHref}
          className="w-full"
        >
          {buttonText}
        </Button>
        <div className="mt-5 items-center text-sm opacity-50">{footer}</div>
      </div>
    </div>
  );
}

function larkUrl(poolAddress?: string): string {
  const baseUrl = "https://lark.market/";
  const attributeString = poolAddress
    ? `?attributes[Pool+Address]=${poolAddress}`
    : "";
  return `${baseUrl}${attributeString}`;
}

enum PanelState {
  NO_UID,
  US_UID,
  SELL_POSITIONS,
  NO_POSITIONS,
  BUY_POSITIONS,
  BUY_OTHER_POSITIONS,
}

function getPanelState({
  noUid,
  uidIsUs,
  poolStatus,
  hasBacked,
  data,
}: {
  noUid: boolean;
  uidIsUs: boolean | undefined;
  poolStatus: PoolStatus;
  hasBacked: boolean;
  data: BackerSecondaryMarketStatQuery;
}): PanelState {
  const collectionPositionsAvailable =
    data.backerSecondaryMarket.collectionStats.onSaleCount > 0;

  const poolPositionsAvailable =
    data.backerSecondaryMarket.poolStats.onSaleCount > 0;

  // These are intentionally non-nested to make the switching logic easier to follow
  if (noUid) {
    return PanelState.NO_UID;
  } else if (uidIsUs) {
    return PanelState.US_UID;
  } else if (
    poolStatus === PoolStatus.ComingSoon &&
    collectionPositionsAvailable
  ) {
    return PanelState.BUY_OTHER_POSITIONS;
  } else if (
    poolStatus === PoolStatus.ComingSoon &&
    !collectionPositionsAvailable
  ) {
    return PanelState.NO_POSITIONS;
  } else if (poolStatus === PoolStatus.Open) {
    return PanelState.SELL_POSITIONS;
  } else if (poolStatus === PoolStatus.Full && hasBacked) {
    return PanelState.SELL_POSITIONS;
  } else if (
    poolStatus === PoolStatus.Full &&
    !hasBacked &&
    poolPositionsAvailable
  ) {
    return PanelState.BUY_POSITIONS;
  } else if (
    poolStatus === PoolStatus.Full &&
    !hasBacked &&
    collectionPositionsAvailable
  ) {
    return PanelState.BUY_OTHER_POSITIONS;
  } else if (
    poolStatus === PoolStatus.Full &&
    !hasBacked &&
    !collectionPositionsAvailable
  ) {
    return PanelState.NO_POSITIONS;
  } else {
    return PanelState.SELL_POSITIONS;
  }
}

interface SecondaryMarketPanelProps {
  noUid: boolean;
  uidIsUs?: boolean;
  hasBacked: boolean;
  poolStatus: PoolStatus;
  poolAddress: string;
}

export default function SecondaryMarketPanel({
  noUid,
  uidIsUs,
  hasBacked,
  poolStatus,
  poolAddress,
}: SecondaryMarketPanelProps) {
  const { data, loading, error } = useBackerSecondaryMarketStatQuery({
    variables: { poolAddress },
  });

  const panelProps: Record<
    Exclude<PanelState, PanelState.US_UID>,
    Omit<PanelProps, "icon">
  > = {
    [PanelState.NO_UID]: {
      title: "Need liquidity? Sell your position on Lark.",
      body: "Do you know you can sell your position on lark.market?",
      buttonText: "View positions",
      buttonHref: larkUrl(poolAddress),
      footer:
        "Note: Lark Market is not available to people or companies who are residents of, or are located, incorporated or have a registered agent in, the United States or a restricted territory.",
    },
    [PanelState.SELL_POSITIONS]: {
      title: "Need liquidity? Sell your position on Lark.",
      body: "Do you know you can sell your position on lark.market?",
      buttonText: "View positions",
      buttonHref: larkUrl(poolAddress),
    },
    [PanelState.BUY_OTHER_POSITIONS]: {
      title: "Purchase positions on Lark",
      body: "This pool isn't open, but there are other positions available for purchase on lark.market",
      buttonText: "View positions",
      buttonHref: larkUrl(),
    },
    [PanelState.BUY_POSITIONS]: {
      title: "Back this pool by purchasing a position on Lark",
      body: "There are positions for this pool available for purchase on lark.market",
      buttonText: "View positions",
      buttonHref: larkUrl(poolAddress),
    },
    [PanelState.NO_POSITIONS]: {
      title: "Buy and sell positions on Lark",
      body: "Though no positions are available now, positions can be bought and sold on lark.market",
      buttonText: "View positions",
      buttonHref: larkUrl(),
    },
  };

  if (loading) {
    return null;
  }

  if (error) {
    return (
      <Panel
        {...panelProps[PanelState.SELL_POSITIONS]}
        icon={<LarkLogo className="h-8 w-8" />}
      />
    );
  }

  if (!data) {
    return null;
  }

  const panelState = getPanelState({
    noUid,
    uidIsUs,
    poolStatus,
    hasBacked,
    data,
  });

  if (panelState === PanelState.US_UID) {
    return null;
  }

  const props = panelProps[panelState];
  return <Panel {...props} icon={<LarkLogo className="h-8 w-8" />} />;
}
