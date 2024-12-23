import { Context, Next } from "koa";
import { TransactionManager } from "../../core/transaction-manager";

export async function koaTransactionMiddleware(ctx: Context, next: Next) {
  return TransactionManager.runInTransaction(() => next());
}
