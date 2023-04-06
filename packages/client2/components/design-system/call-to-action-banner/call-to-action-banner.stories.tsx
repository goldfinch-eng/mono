import { ComponentStory, ComponentMeta } from "@storybook/react";

import { CallToActionBanner, CallToActionBannerProps } from "./index";

export default {
  title: "Components/CallToActionBanner",
  component: CallToActionBanner,
} as ComponentMeta<typeof CallToActionBanner>;

export const CallToActionBannerStory: ComponentStory<
  typeof CallToActionBanner
> = (args: CallToActionBannerProps) => {
  return <CallToActionBanner {...args} />;
};

CallToActionBannerStory.args = {
  buttonRight: {
    onClick: () => {
      alert("Yay!");
    },
    name: "Click me!",
  },
  title: "Have a moment?",
};
