// Cf. https://jpwilliams.dev/how-to-unpack-the-return-type-of-a-promise-in-typescript
export type AsyncReturnType<T extends (...args: any) => unknown> = T extends (...args: unknown[]) => Promise<infer U>
  ? U
  : never
