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
  children: "opening soon",
  colorScheme: "blue",
};

export const MarqueeWithChildrenArray: ComponentStory<typeof Marquee> = (
  args
) => {
  return (
    <div>
      <Marquee className="fixed top-0 left-0" {...args} />
    </div>
  );
};

MarqueeWithChildrenArray.args = {
  children: ["open", "3,500 backers"],
  colorScheme: "purple",
};
