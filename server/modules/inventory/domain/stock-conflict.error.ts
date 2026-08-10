export class StockConflictError extends Error {
  constructor(public readonly productName: string) {
    super(`Product ${productName} is no longer available in the requested quantity.`);
    this.name = "StockConflictError";
  }
}
