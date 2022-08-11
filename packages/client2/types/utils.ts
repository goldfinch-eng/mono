export class UnreachableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnreachableError";
  }
}

export function assertUnreachable(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  x: never
): never {
  throw new UnreachableError("Expected not to get here.");
}

export type ArrayItem<T> = T extends Array<infer U> ? U : never;
