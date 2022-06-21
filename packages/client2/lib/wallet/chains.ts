export const RPC_URLS: { [chainId: number]: string } = {
  1: process.env.NEXT_PUBLIC_MAINNET_RPC_URL as string,
  31337:
    process.env.NEXT_PUBLIC_NETWORK_NAME === "murmuration"
      ? "https://murmuration.goldfinch.finance/_chain"
      : "http://localhost:8545",
};
