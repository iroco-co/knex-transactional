import { Knex, knex } from "knex";
import { Transactional, initializeKnex } from "../index";
import { getCurrentTransaction } from "../decorators/Transactional";

describe("Transaction Isolation Levels", () => {
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
        pool: {
          min: 0,
          max: 10,
          acquireTimeoutMillis: 1000,
        },
      },
    });

    initializeKnex(db);
    await db.schema.dropTableIfExists("isolation_test");
  });

  beforeEach(async () => {
    const exists = await db.schema.hasTable("isolation_test");
    if (!exists) {
      await db.schema.createTable("isolation_test", (table) => {
        table.increments("id");
        table.string("name");
        table.integer("count").defaultTo(0);
        table.timestamps(true, true);
      });
    }
  });

  afterEach(async () => {
    await db.schema.dropTableIfExists("isolation_test");
  });

  afterAll(async () => {
    await db.destroy();
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  // Test Read Uncommitted
  it("should demonstrate read committed behavior instead of read uncommitted in PostgreSQL", async () => {
    class TestService {
      @Transactional({ isolationLevel: "read uncommitted" })
      async transaction1() {
        const trx = getCurrentTransaction();
        if (!trx) throw new Error("Transaction not found");

        await trx.into("isolation_test").insert({ name: "test", count: 1 });
        // Wait to see if another transaction can read uncommitted data
        await new Promise((resolve) => setTimeout(resolve, 1000));
        throw new Error("Rollback");
      }

      @Transactional({ isolationLevel: "read uncommitted" })
      async transaction2() {
        const trx = getCurrentTransaction();
        if (!trx) throw new Error("Transaction not found");

        const result = await trx("isolation_test").select("*");
        return result;
      }
    }

    const service = new TestService();

    const promise1 = service.transaction1().catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 500));
    const result = await service.transaction2();

    // In PostgreSQL, read uncommitted behaves like read committed,
    // so we cannot read uncommitted data
    expect(result).toHaveLength(0);

    await promise1;
  });

  // Test Read Committed
  it("should prevent dirty read in read committed", async () => {
    class TestService {
      @Transactional({ isolationLevel: "read committed" })
      async transaction1() {
        const trx = getCurrentTransaction();
        if (!trx) throw new Error("Transaction not found");

        await trx.into("isolation_test").insert({ name: "test", count: 1 });
        await new Promise((resolve) => setTimeout(resolve, 1000));
        throw new Error("Rollback");
      }

      @Transactional({ isolationLevel: "read committed" })
      async transaction2() {
        const trx = getCurrentTransaction();
        if (!trx) throw new Error("Transaction not found");

        const result = await trx("isolation_test").select("*");
        return result;
      }
    }

    const service = new TestService();

    const promise1 = service.transaction1().catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 500));
    const result = await service.transaction2();

    // In Read Committed, we cannot read uncommitted data
    expect(result).toHaveLength(0);

    await promise1;
  });

  // Test Repeatable Read
  it("should prevent non-repeatable read in repeatable read", async () => {
    class TestService {
      @Transactional({ isolationLevel: "repeatable read" })
      async longRunningTransaction() {
        const trx = getCurrentTransaction();
        if (!trx) throw new Error("Transaction not found");

        // First read
        const result1 = await trx("isolation_test").select("*");

        // Give time for another transaction to modify data
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Second read
        const result2 = await trx("isolation_test").select("*");

        // In Repeatable Read, both results should be identical
        expect(result1).toEqual(result2);
        return { result1, result2 };
      }

      @Transactional()
      async modifyData() {
        const trx = getCurrentTransaction();
        if (!trx) throw new Error("Transaction not found");

        await trx.into("isolation_test").insert({ name: "test", count: 1 });
      }
    }

    const service = new TestService();

    const promise1 = service.longRunningTransaction();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await service.modifyData();

    const { result1, result2 } = await promise1;
    expect(result1).toEqual(result2);
  });

  // Test Serializable
  it("should prevent phantom read in serializable", async () => {
    class TestService {
      @Transactional({ isolationLevel: "serializable" })
      async transaction1() {
        const trx = getCurrentTransaction();
        if (!trx) throw new Error("Transaction not found");

        // Range query
        const count1 = await trx("isolation_test")
          .where("count", ">", 0)
          .count("* as cnt")
          .first();

        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Same range query again
        const count2 = await trx("isolation_test")
          .where("count", ">", 0)
          .count("* as cnt")
          .first();

        // In Serializable, both results should be identical
        expect(count1).toEqual(count2);
        return { count1, count2 };
      }

      @Transactional()
      async insertData() {
        const trx = getCurrentTransaction();
        if (!trx) throw new Error("Transaction not found");

        await trx.into("isolation_test").insert({ name: "test", count: 5 });
      }
    }

    const service = new TestService();

    const promise1 = service.transaction1();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await service.insertData();

    const { count1, count2 } = await promise1;
    expect(count1).toEqual(count2);
  });
});
