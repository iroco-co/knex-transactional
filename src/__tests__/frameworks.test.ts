import { Knex, knex } from "knex";
import express from "express";
import Koa from "koa";
import request from "supertest";
import { TransactionManager } from "../core/transaction-manager";
import { koaTransactionMiddleware } from "../adapters/koa/middleware";
import { expressTransactionMiddleware } from "../adapters/express/middleware";
import { initializeTransactions } from "../initialize";

describe("Framework Integration Tests", () => {
  let db: Knex;

  beforeAll(async () => {
    db = knex({
      client: "postgresql",
      connection: {
        host: "localhost",
        port: 5433,
        user: "test",
        password: "test1234",
        database: "test_db",
      },
    });

    initializeTransactions(db);
    // Drop table if exists
    await db.schema.dropTableIfExists("test_table");

    // Create table
    await db.schema.createTable("test_table", (table) => {
      table.increments("id");
      table.string("name");
      table.timestamps(true, true);
    });
  }, 30000);

  afterAll(async () => {
    await db.schema.dropTableIfExists("test_table");
    await db.destroy();
    // Add delay to ensure connections are closed
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }, 30000);

  describe("Koa Integration", () => {
    it("should handle transactions in Koa middleware", async () => {
      const app = new Koa();
      app.use(koaTransactionMiddleware);
      app.use(async (ctx) => {
        const trx = TransactionManager.getTransaction();
        await trx!.into("test_table").insert({ name: "koa-test" });
        ctx.body = { success: true };
      });

      await request(app.callback()).get("/").expect(200);

      const result = await db("test_table").where({ name: "koa-test" });
      expect(result).toHaveLength(1);
    });
  });

  describe("Express Integration", () => {
    it("should handle transactions in Express middleware", async () => {
      const app = express();
      app.use(expressTransactionMiddleware);
      app.get("/", async (req, res) => {
        const trx = TransactionManager.getTransaction();
        await trx!.into("test_table").insert({ name: "express-test" });
        res.json({ success: true });
      });

      await request(app).get("/").expect(200);

      const result = await db("test_table").where({ name: "express-test" });
      expect(result).toHaveLength(1);
    });
  });

  //   describe("Fastify Integration", () => {
  //     it("should handle transactions in Fastify plugin", async () => {
  //       const app = fastify();
  //       await app.register(fastifyTransactionPlugin);

  //       app.get("/", async () => {
  //         const trx = TransactionManager.getTransaction();
  //         await trx!.into("test_table").insert({ name: "fastify-test" });
  //         return { success: true };
  //       });

  //       await app.ready();

  //       await request(app.server).get("/").expect(200);

  //       const result = await db("test_table").where({ name: "fastify-test" });
  //       expect(result).toHaveLength(1);
  //     }, 30000);
  //   });

  describe("Error Handling", () => {
    it("should rollback transaction on error in express", async () => {
      const app = express();
      app.use(expressTransactionMiddleware);
      app.get("/", async (req, res) => {
        const trx = TransactionManager.getTransaction();
        await trx!.into("test_table").insert({ name: "error-test" });
        throw new Error("Test error");
      });

      await request(app).get("/").expect(500);

      const result = await db("test_table").where({ name: "error-test" });
      expect(result).toHaveLength(0);
    }, 30000);

    it("should rollback transaction on error in koa", async () => {
      const app = new Koa();
      app.use(koaTransactionMiddleware);
      app.use(async (ctx) => {
        throw new Error("Test error");
      });
    });

    // it("should rollback transaction on error in fastify", async () => {
    //   const app = fastify();
    //   await app.register(fastifyTransactionPlugin);
    //   app.get("/", async () => {
    //     throw new Error("Test error");
    //   });
    // });
  });
});
