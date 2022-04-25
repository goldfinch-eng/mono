import { ComponentStory, ComponentMeta } from "@storybook/react";

import { Marquee } from "./index";

export default {
  title: "Components/Marquee",
  component: Marquee,
} as ComponentMeta<typeof Marquee>;

export const MarqueeStory: ComponentStory<typeof Marquee> = (args) => {
  return (
    <div>
      <Marquee className="fixed top-0 left-0" {...args} />
    </div>
  );
};

MarqueeStory.args = {
  children: "OPENING SOON",
  colorScheme: "blue",
};
