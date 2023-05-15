export function generateBinarySelect(
  name: string,
  label?: string,
  options?: { label: string; value: string }[]
) {
  return {
    name,
    label,
    type: "select" as const,
    admin: {
      isClearable: true,
    },
    options: options
      ? options
      : [
          { label: "Yes", value: "yes" },
          { label: "No", value: "no" },
        ],
  };
}
