import { Gfi } from "@/lib/graphql/generated";

import { gfiVar } from "../vars";

const COINGECKO_API_GFI_PRICE_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=goldfinch&vs_currencies=usd";
const COINBASE_API_GFI_PRICE_URL =
  "https://api.coinbase.com/v2/prices/GFI-USD/spot";

async function fetchCoingeckoPrice(): Promise<Gfi["price"]> {
  const coingeckoResponse = await (
    await fetch(COINGECKO_API_GFI_PRICE_URL)
  ).json();

  if (
    !coingeckoResponse ||
    !coingeckoResponse.goldfinch ||
    !coingeckoResponse.goldfinch.usd
  ) {
    throw new Error("Coingecko response JSON failed type guard");
  }
  return { usd: coingeckoResponse.goldfinch.usd };
}

async function fetchCoinbasePrice(): Promise<Gfi["price"]> {
  const coinbaseResponse = await (
    await fetch(COINBASE_API_GFI_PRICE_URL)
  ).json();

  if (
    !coinbaseResponse ||
    !coinbaseResponse.data ||
    !coinbaseResponse.data.amount
  ) {
    throw new Error("Coinbase response JSON failed type guard");
  }
  return { usd: parseFloat(coinbaseResponse.data.amount) };
}

export async function refreshGfiPrice() {
  try {
    const price = await fetchCoingeckoPrice();
    gfiVar({ price, lastUpdated: Date.now() });
  } catch (e) {
    const price = await fetchCoinbasePrice();
    gfiVar({ price, lastUpdated: Date.now() });
  }
}
