import { gql } from "@apollo/client";
import Image from "next/image";
import { ReactNode } from "react";

import { Button } from "@/components/design-system";
import goldfinchLogo from "@/constants/metadata/icons/goldfinch.png";
import {
  BackerSecondaryMarketStatQuery,
  useBackerSecondaryMarketStatQuery,
} from "@/lib/graphql/generated";
import { PoolStatus } from "@/lib/pools";

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
  iconSrc: string;
  body: ReactNode;
  buttonText: ReactNode;
  buttonHref: string;
}

function Panel({ title, iconSrc, body, buttonText, buttonHref }: PanelProps) {
  return (
    <div className="flex flex-col rounded-xl bg-clay-50">
      <div className="mx-5 px-5 py-10">
        <div className="mb-3 flex flex-row items-center justify-between gap-3 text-xl font-semibold">
          <p>{title}</p>
          <Image src={iconSrc} alt={`Lark icon`} width={40} height={40} />
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
      </div>
    </div>
  );
}

function larkUrl(poolAddress?: string): string {
  const baseUrl = "https://purple-shadow-0471.on.fleek.co/";
  const attributeString = poolAddress
    ? `?attributes[Pool+Address]=${poolAddress}`
    : "";
  return `${baseUrl}${attributeString}`;
}

enum PanelState {
  SELL_POSITIONS,
  NO_POSITIONS,
  BUY_POSITIONS,
  BUY_OTHER_POSITIONS,
}

function getPanelState({
  poolStatus,
  hasBacked,
  data,
}: {
  poolStatus: PoolStatus;
  hasBacked: boolean;
  data: BackerSecondaryMarketStatQuery;
}): PanelState {
  const collectionPositionsAvailable =
    data.backerSecondaryMarket.collectionStats.onSaleCount > 0;

  const poolPositionsAvailable =
    data.backerSecondaryMarket.poolStats.onSaleCount > 0;

  // These are intentionally non-nestd to make the switching logic easier to follow
  if (poolStatus === PoolStatus.ComingSoon && collectionPositionsAvailable) {
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
  hasBacked: boolean;
  poolStatus: PoolStatus;
  poolAddress: string;
}

export default function SecondaryMarketPanel({
  hasBacked,
  poolStatus,
  poolAddress,
}: SecondaryMarketPanelProps) {
  const { data, loading, error } = useBackerSecondaryMarketStatQuery({
    variables: { poolAddress },
  });

  const panelProps: Record<PanelState, Omit<PanelProps, "iconSrc">> = {
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
        iconSrc={goldfinchLogo.src}
      />
    );
  }

  if (!data) {
    return null;
  }

  const panelState = getPanelState({ poolStatus, hasBacked, data });
  const props = panelProps[panelState];

  return <Panel {...props} iconSrc={goldfinchLogo.src} />;
}
