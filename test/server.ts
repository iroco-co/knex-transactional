import express from "express";
import { Knex, knex } from "knex";
import { Transactional, initializeTransactions } from "../src/index";

const app = express();
app.use(express.json());

const db: Knex = knex({
  client: "postgresql",
  connection: {
    host: "localhost",
    port: 5433,
    user: "test",
    password: "test1234",
    database: "test_db",
  },
  pool: { min: 2, max: 10 },
});

const proxiedDb = initializeTransactions(db);

class TestService {
  @Transactional()
  async insertWithDecorator(data: { name: string }) {
    await proxiedDb("test_table").insert(data);
    const result = await proxiedDb("test_table")
      .select("*")
      .where({ name: data.name })
      .first();
    return result;
  }

  async insertWithManualTransaction(data: { name: string }) {
    const trx = await db.transaction();
    try {
      await trx("test_table").insert(data);
      const result = await trx("test_table")
        .select("*")
        .where({ name: data.name })
        .first();
      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }
}

const testService = new TestService();

app.post("/decorator-transaction", async (req, res) => {
  try {
    const result = await testService.insertWithDecorator({
      name: "test-decorator",
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/manual-transaction", async (req, res) => {
  try {
    const result = await testService.insertWithManualTransaction({
      name: "test-manual",
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

async function initializeTable() {
  try {
    await db.schema.dropTableIfExists("test_table");
    await db.schema.createTable("test_table", (table) => {
      table.increments("id");
      table.string("name");
      table.timestamps(true, true);
    });
    console.log("Table initialized successfully");
  } catch (error) {
    console.error("Error initializing table:", error);
    process.exit(1);
  }
}

const PORT = 3000;
app.listen(PORT, async () => {
  await initializeTable();
  console.log(`Server is running on port ${PORT}`);
});

process.on("SIGTERM", async () => {
  await db.destroy();
  process.exit(0);
});
