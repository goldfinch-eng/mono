import { ComponentStory, ComponentMeta } from "@storybook/react";

import { Link } from ".";

export default {
  title: "Components/Link",
  component: Link,
  argTypes: {
    nextLinkProps: {
      control: false,
    },
    className: {
      control: false,
    },
  },
} as ComponentMeta<typeof Link>;

export const LinkStory: ComponentStory<typeof Link> = (args) => {
  return <Link {...args} />;
};

LinkStory.args = {
  children: "Hello Goldfinch",
  href: "#",
};
