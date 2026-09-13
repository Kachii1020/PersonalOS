export class PublicHttpError extends Error {
  constructor(message: string, readonly status: number, name = "PublicHttpError") {
    super(message);
    this.name = name;
  }
}

export function httpErrorResult(
  error: unknown,
  messages: { budget: string; unavailable: string },
): { status: number; message: string } {
  if (error instanceof PublicHttpError) return { status: error.status, message: error.message };
  if (error instanceof SyntaxError) return { status: 400, message: "요청 형식을 확인하세요." };
  if (error instanceof Error && error.name === "BudgetExceededError") return { status: 402, message: messages.budget };
  return { status: 503, message: messages.unavailable };
}
