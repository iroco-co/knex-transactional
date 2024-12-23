import Koa from "koa";
import { clsMiddleware } from "../middleware/cls.middleware";
import * as cls from "cls-hooked";
import request from "supertest";

describe("CLS Middleware", () => {
  it("should maintain context through async operations", async () => {
    const app = new Koa();
    app.use(clsMiddleware);

    const ns = (cls as any).getNamespace("koa-cls-transaction");

    app.use(async (ctx) => {
      // CLS 네임스페이스 내부에서 실행되는지 확인
      expect(ns.active).toBeTruthy();
      ctx.body = { success: true };
    });

    await request(app.callback())
      .get("/")
      .expect(200)
      .expect({ success: true });
  });
});
