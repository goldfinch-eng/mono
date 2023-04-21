import { ComponentStory, ComponentMeta } from "@storybook/react";

import { Button } from "../button";
import { CallToActionBanner, CallToActionBannerProps } from "./index";

export default {
  title: "Components/CallToActionBanner",
  component: CallToActionBanner,
} as ComponentMeta<typeof CallToActionBanner>;

export const CallToActionBannerStory: ComponentStory<
  typeof CallToActionBanner
> = (args: CallToActionBannerProps) => {
  return (
    <CallToActionBanner
      {...args}
      renderButton={(props) => (
        <Button {...props} as="a" href="https://example.com">
          Begin UID Setup
        </Button>
      )}
    />
  );
};

CallToActionBannerStory.args = {
  title: "Set up your UID to start",
  description:
    "UID is a non-transferrable NFT representing KYC-verification on-chain. A UID is required to participate in the Goldfinch lending protocol. No personal information is stored on-chain.",
};
