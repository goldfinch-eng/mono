export const RPC_URLS: { [chainId: number]: string } = {
  1: `https://eth-mainnet.alchemyapi.io/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
  31337:
    process.env.NEXT_PUBLIC_NETWORK_NAME === "murmuration"
      ? "https://murmuration.goldfinch.finance/_chain"
      : "http://localhost:8545",
};
