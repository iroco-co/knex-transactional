import * as cls from "cls-hooked";
import { Context, Next } from "koa";

const ns = cls.createNamespace("koa-cls-transaction");

export async function clsMiddleware(ctx: Context, next: Next) {
  return new Promise((resolve, reject) => {
    ns.run(() => {
      next().then(resolve).catch(reject);
    });
  });
}
