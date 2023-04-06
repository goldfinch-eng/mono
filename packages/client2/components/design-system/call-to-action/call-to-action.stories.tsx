import { ComponentStory, ComponentMeta } from "@storybook/react";

import { CallToAction, CallToActionProps } from "./index";

// eslint-disable-next-line storybook/story-exports
export default {
  title: "Components/CallToAction",
  component: CallToAction,
} as ComponentMeta<typeof CallToAction>;

export const CallToActionStory: ComponentStory<typeof CallToAction> = (
  args: CallToActionProps
) => {
  return <CallToAction {...args} />;
};

CallToActionStory.args = {
  buttonRight: {
    onClick: () => {
      alert("Yay!");
    },
    name: "Click me!",
  },
  title: "Have a moment?",
};
