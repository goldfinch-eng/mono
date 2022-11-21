export function generateBinarySelect(name: string, label?: string) {
  return {
    name,
    label,
    type: "select" as const,
    admin: {
      isClearable: true,
    },
    options: [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
    ],
  };
}
