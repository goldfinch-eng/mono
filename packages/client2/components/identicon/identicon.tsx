import clsx from "clsx";
import Blockies from "react-blockies";

interface IdenticonProps {
  account: string;
  className?: string;
  /**
   * Determines the size of the icon. This number * 8 will be the height and width in pixels
   */
  scale?: number;
}

export function Identicon({ account, className, scale = 3 }: IdenticonProps) {
  return (
    <Blockies
      seed={account}
      className={clsx("rounded-full", className)}
      size={8}
      scale={scale}
    />
  );
}
