export class ComponentSourceError extends Error {
  override readonly name = "ComponentSourceError";

  constructor(message: string) {
    super(message);
  }
}
