export * from "./get-wallet";
export * from "./use-wallet";
export function abbreviateAddress(address: string) {
  return (
    address.substring(0, 6) + "..." + address.substring(address.length - 4)
  );
}
