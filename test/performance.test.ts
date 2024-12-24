import { Knex, knex } from "knex";
import { Transactional, initializeTransactions } from "../index";
import { TransactionManager } from "../core/transaction-manager";
interface PerformanceStats {
  mean: number;
  median: number;
  min: number;
  max: number;
  p95: number;
  p99: number;
  standardDeviation: number;
}

describe("Transaction Performance Tests", () => {
  let db: Knex;
  const ITERATION_COUNT = 100000;

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

    db = initializeTransactions(db);
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
      const trx = TransactionManager.getTransaction();
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

  function calculateStats(durations: number[]): PerformanceStats {
    const sorted = [...durations].sort((a, b) => a - b);
    const mean = durations.reduce((a, b) => a + b, 0) / durations.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    const variance =
      durations.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
      durations.length;
    const standardDeviation = Math.sqrt(variance);

    return { mean, median, min, max, p95, p99, standardDeviation };
  }

  it("should compare decorator vs manual transaction performance", async () => {
    class TestService {
      @Transactional()
      async withDecorator() {
        await db("performance_test").insert({ name: "test" });
        await db("performance_test").select("*").where({ name: "test" });
        return true;
      }

      async withManualTransaction() {
        const trx = await db.transaction();
        try {
          await trx("performance_test").insert({ name: "test" });
          await trx("performance_test").select("*").where({ name: "test" });
          await trx.commit();
          return true;
        } catch (error) {
          await trx.rollback();
          throw error;
        }
      }
    }

    const service = new TestService();
    const decoratorDurations: number[] = [];
    const manualDurations: number[] = [];

    for (let i = 0; i < ITERATION_COUNT; i++) {
      const startDecorator = process.hrtime();
      await service.withDecorator();
      const endDecorator = process.hrtime(startDecorator);
      decoratorDurations.push(
        endDecorator[0] * 1000 + endDecorator[1] / 1000000
      );

      const startManual = process.hrtime();
      await service.withManualTransaction();
      const endManual = process.hrtime(startManual);
      manualDurations.push(endManual[0] * 1000 + endManual[1] / 1000000);
    }

    const decoratorStats = calculateStats(decoratorDurations);
    const manualStats = calculateStats(manualDurations);

    console.log("\nTransaction Performance Comparison:");
    console.log(`Number of iterations: ${ITERATION_COUNT}`);

    console.log("\nDecorator Transaction:");
    console.log(`Mean: ${decoratorStats.mean.toFixed(2)}ms`);
    console.log(`Median: ${decoratorStats.median.toFixed(2)}ms`);
    console.log(`Min: ${decoratorStats.min.toFixed(2)}ms`);
    console.log(`Max: ${decoratorStats.max.toFixed(2)}ms`);
    console.log(`P95: ${decoratorStats.p95.toFixed(2)}ms`);
    console.log(`P99: ${decoratorStats.p99.toFixed(2)}ms`);
    console.log(
      `Standard Deviation: ${decoratorStats.standardDeviation.toFixed(2)}ms`
    );

    console.log("\nManual Transaction:");
    console.log(`Mean: ${manualStats.mean.toFixed(2)}ms`);
    console.log(`Median: ${manualStats.median.toFixed(2)}ms`);
    console.log(`Min: ${manualStats.min.toFixed(2)}ms`);
    console.log(`Max: ${manualStats.max.toFixed(2)}ms`);
    console.log(`P95: ${manualStats.p95.toFixed(2)}ms`);
    console.log(`P99: ${manualStats.p99.toFixed(2)}ms`);
    console.log(
      `Standard Deviation: ${manualStats.standardDeviation.toFixed(2)}ms`
    );

    const performanceDiff =
      ((decoratorStats.mean - manualStats.mean) / manualStats.mean) * 100;
    console.log(
      `\nPerformance Difference: ${performanceDiff.toFixed(
        2
      )}% (+ means decorator is slower)`
    );
  }, 60000);
});
