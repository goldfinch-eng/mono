import { configureChains, mainnet, createClient } from "wagmi";
import { hardhat } from "wagmi/chains";
import { MetaMaskConnector } from "wagmi/connectors/metaMask";
import { alchemyProvider } from "wagmi/providers/alchemy";
import { publicProvider } from "wagmi/providers/public";

import { DESIRED_CHAIN_ID } from "@/constants";

if (!process.env.NEXT_PUBLIC_ALCHEMY_API_KEY) {
  throw new Error("NEXT_PUBLIC_ALCHEMY_API_KEY env var is not defined");
}
const { chains, provider, webSocketProvider } = configureChains(
  [mainnet, hardhat],
  [
    alchemyProvider({ apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY }),
    publicProvider(),
  ]
);

const metaMaskConnector = new MetaMaskConnector({
  chains: chains.filter((c) => c.id === DESIRED_CHAIN_ID),
});

export const wagmiClient = createClient({
  autoConnect: true,
  provider,
  webSocketProvider,
  connectors: [metaMaskConnector],
});
