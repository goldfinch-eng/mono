export const RPC_URLS: { [chainId: number]: string } =
  process.env.NODE_ENV === "production"
    ? {
        1: `https://eth-mainnet.alchemyapi.io/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
      }
    : {
        1: `https://eth-mainnet.alchemyapi.io/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
        31337: "http://localhost:8545",
      };

export const ALLOWED_CHAIN_IDS = Object.keys(RPC_URLS).map((chainId) =>
  parseInt(chainId)
);
