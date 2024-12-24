import { Knex, knex } from "knex";
import { Transactional } from "../index";
import { initializeTransactions } from "../initialize";
describe("Transactional Decorator", () => {
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
      pool: {
        min: 2,
        max: 4,
      },
    });

    db = initializeTransactions(db);

    await db.schema.dropTableIfExists("test_table");
  });

  beforeEach(async () => {
    try {
      await db.schema.dropTableIfExists("test_table");
      await db.schema.createTable("test_table", (table) => {
        table.increments("id");
        table.string("name");
        table.timestamps(true, true);
      });
    } catch (error) {
      console.log("Table creation error:", error);
      throw error;
    }
  });

  afterEach(async () => {
    await db.schema.dropTable("test_table");
  });

  afterAll(async () => {
    await db.destroy();
  });

  it("should successfully commit transaction", async () => {
    class TestService {
      @Transactional()
      async insertRecord() {
        await db("test_table").insert({ name: "test" });
        return true;
      }
    }

    const service = new TestService();
    await service.insertRecord();

    const records = await db("test_table").select("*");
    expect(records).toHaveLength(1);
    expect(records[0].name).toBe("test");
  });

  it("should rollback transaction on error", async () => {
    class TestService {
      @Transactional()
      async insertRecord() {
        await db.into("test_table").insert({ name: "rollback-test" });
        throw new Error("Test error");
      }
    }

    const service = new TestService();
    await expect(service.insertRecord()).rejects.toThrow("Test error");

    const records = await db("test_table").select("*").where({});
    expect(records).toHaveLength(0);
  });

  it("should persist data without transaction decorator", async () => {
    class TestService {
      async insertAndFail() {
        await db("test_table").insert({
          name: "no-transaction-test",
        });

        throw new Error("Test error");
      }
    }

    const service = new TestService();

    await expect(service.insertAndFail()).rejects.toThrow("Test error");

    const records = await db("test_table")
      .where({ name: "no-transaction-test" })
      .select("*");

    expect(records).toHaveLength(1);
    expect(records[0].name).toBe("no-transaction-test");
  });

  it("should respect transaction isolation level", async () => {
    class TestService {
      @Transactional({ isolationLevel: "serializable" })
      async insertWithIsolation() {
        const result = await db.raw("SHOW TRANSACTION ISOLATION LEVEL");
        const isolationLevel = result.rows[0].transaction_isolation;
        expect(isolationLevel.toLowerCase()).toBe("serializable");

        await db("test_table").insert({ name: "test" });
        return true;
      }
    }

    const service = new TestService();
    await service.insertWithIsolation();
  });

  describe("Proxy Detection Test", () => {
    it("should detect if db is a Proxy", () => {
      const dbProxy = db as any;
      expect(dbProxy.__isProxy).toBe(true);
    });

    it("should detect if db is not a Proxy", () => {
      expect((knex as any).__isProxy).toBe(undefined);
    });
  });
});
