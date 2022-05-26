declare module "*.graphql" {
  const s: string;
  export default s;
}

declare module "@download/blockies" {
  interface BlockiesConfig {
    size?: number | undefined;
    scale?: number | undefined;
    seed?: string | undefined;
    color?: string | undefined;
    bgcolor?: string | undefined;
    spotcolor?: string | undefined;
  }

  export function createIcon(config: BlockiesConfig): HTMLCanvasElement;
  export function renderIcon(config: BlockiesConfig, canvas: HTMLCanvasElement);
}
