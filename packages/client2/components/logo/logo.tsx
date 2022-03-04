import GoldfinchLogoSvg from "./goldfinch-logo.svg";

interface GoldfinchLogoProps {
  width?: number;
  height?: number;
  className?: string;
}

export function GoldfinchLogo(props: GoldfinchLogoProps) {
  return <GoldfinchLogoSvg {...props} />;
}
