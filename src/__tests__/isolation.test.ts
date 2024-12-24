import { Knex, knex } from "knex";
import { initializeTransactions, Transactional } from "../index";

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
          max: 4,
          acquireTimeoutMillis: 1000,
        },
      },
    });

    db = initializeTransactions(db);
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
        await db.into("isolation_test").insert({ name: "test", count: 1 });
        // Wait to see if another transaction can read uncommitted data
        await new Promise((resolve) => setTimeout(resolve, 1000));
        throw new Error("Rollback");
      }

      @Transactional({ isolationLevel: "read uncommitted" })
      async transaction2() {
        const result = await db("isolation_test").select("*");
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
        await db.into("isolation_test").insert({ name: "test", count: 1 });
        await new Promise((resolve) => setTimeout(resolve, 1000));
        throw new Error("Rollback");
      }

      @Transactional({ isolationLevel: "read committed" })
      async transaction2() {
        const result = await db("isolation_test").select("*");
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
});
