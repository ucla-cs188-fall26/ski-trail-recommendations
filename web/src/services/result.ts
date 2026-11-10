export interface AppError<C extends string = string> {
  code: C;
  message: string;
}

export type Result<T, C extends string = string> =
  | { ok: true; data: T }
  | { ok: false; error: AppError<C> };

export const ok = <T>(data: T): Result<T, never> => ({ ok: true, data });
export const fail = <C extends string>(code: C, message: string): Result<never, C> => ({ ok: false, error: { code, message } });
