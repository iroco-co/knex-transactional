import { Knex, knex } from "knex";
import { Transactional, initializeKnex } from "../index";
import { getCurrentTransaction } from "../decorators/Transactional";

describe("Transaction Performance Tests", () => {
  let db: Knex;
  const ITERATION_COUNT = 1000;

  beforeAll(async () => {
    db = knex({
      client: "postgresql",
      connection: {
        host: "localhost",
        port: 5433,
        user: "test",
        password: "test1234",
        database: "test_db",
        pool: {
          min: 0,
          max: 10,
          acquireTimeoutMillis: 1000,
        },
      },
    });

    initializeKnex(db);
    await db.schema.dropTableIfExists("performance_test");

    await db.schema.createTable("performance_test", (table) => {
      table.increments("id");
      table.string("name");
      table.integer("value");
      table.timestamps(true, true);
    });
  }, 10000);

  afterAll(async () => {
    await db.schema.dropTableIfExists("performance_test");
    await db.destroy();
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }, 10000);

  // Traditional transaction approach
  async function traditionalTransaction() {
    const trx = await db.transaction();
    try {
      await trx("performance_test").insert({ name: "test", value: 1 });
      await trx("performance_test")
        .where({ name: "test" })
        .update({ value: 2 });
      const result = await trx("performance_test")
        .where({ name: "test" })
        .first();
      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  // Decorator approach
  class TestService {
    @Transactional()
    async decoratorTransaction() {
      const trx = getCurrentTransaction();
      if (!trx) throw new Error("Transaction not found");

      await trx("performance_test").insert({ name: "test", value: 1 });
      await trx("performance_test")
        .where({ name: "test" })
        .update({ value: 2 });
      return await trx("performance_test").where({ name: "test" }).first();
    }
  }

  it("should measure traditional transaction performance", async () => {
    const startTime = process.hrtime();

    for (let i = 0; i < ITERATION_COUNT; i++) {
      await traditionalTransaction();
    }

    const endTime = process.hrtime(startTime);
    const duration = endTime[0] * 1000 + endTime[1] / 1000000;
    console.log(
      `Traditional Transaction: ${duration}ms for ${ITERATION_COUNT} iterations (${
        duration / ITERATION_COUNT
      }ms per operation)`
    );
  }, 30000);

  it("should measure decorator transaction performance", async () => {
    const service = new TestService();
    const startTime = process.hrtime();

    for (let i = 0; i < ITERATION_COUNT; i++) {
      await service.decoratorTransaction();
    }

    const endTime = process.hrtime(startTime);
    const duration = endTime[0] * 1000 + endTime[1] / 1000000;
    console.log(
      `Decorator Transaction: ${duration}ms for ${ITERATION_COUNT} iterations (${
        duration / ITERATION_COUNT
      }ms per operation)`
    );
  }, 30000);

  it("should measure concurrent traditional transactions", async () => {
    const startTime = process.hrtime();

    // Smaller batch size and longer delay
    const batchSize = 5;
    for (let i = 0; i < ITERATION_COUNT; i += batchSize) {
      const batch = Array(Math.min(batchSize, ITERATION_COUNT - i))
        .fill(null)
        .map(() => traditionalTransaction());
      await Promise.all(batch);
      await new Promise((resolve) => setTimeout(resolve, 200)); // Increased delay
    }

    const endTime = process.hrtime(startTime);
    const duration = endTime[0] * 1000 + endTime[1] / 1000000;
    console.log(
      `Concurrent Traditional Transactions: ${duration}ms for ${ITERATION_COUNT} iterations (${
        duration / ITERATION_COUNT
      }ms per operation)`
    );
  }, 60000);

  it("should measure concurrent decorator transactions", async () => {
    const service = new TestService();
    const startTime = process.hrtime();

    const batchSize = 5;
    for (let i = 0; i < ITERATION_COUNT; i += batchSize) {
      const batch = Array(Math.min(batchSize, ITERATION_COUNT - i))
        .fill(null)
        .map(() => service.decoratorTransaction());
      await Promise.all(batch);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    const endTime = process.hrtime(startTime);
    const duration = endTime[0] * 1000 + endTime[1] / 1000000;
    console.log(
      `Concurrent Decorator Transactions: ${duration}ms for ${ITERATION_COUNT} iterations (${
        duration / ITERATION_COUNT
      }ms per operation)`
    );
  }, 60000);
});
