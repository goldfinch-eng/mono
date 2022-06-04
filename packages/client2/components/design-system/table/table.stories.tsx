import { ComponentStory, ComponentMeta } from "@storybook/react";

import { Table } from "./table";

export default {
  title: "Components/Table",
  component: Table,
} as ComponentMeta<typeof Table>;

const row = ["One", "Two", "Three"];

export const TableStory: ComponentStory<typeof Table> = () => {
  return (
    <Table
      headings={["Alpha", "Beta", "Gamma"]}
      rows={[row, row, row, row, row, row, row, row]}
    />
  );
};
