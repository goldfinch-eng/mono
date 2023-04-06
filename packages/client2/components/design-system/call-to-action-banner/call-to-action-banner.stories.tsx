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
          Click me!
        </Button>
      )}
    />
  );
};

CallToActionBannerStory.args = {
  title: "Have a moment?",
};
