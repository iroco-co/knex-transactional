# Transaction Management with Node.js

Knex ORM with Transactional decorator

# knex-transactional

A TypeScript decorator-based transaction management library for Knex.js that simplifies database transactions using the decorator pattern and AsyncLocalStorage.

## Features

- 🎯 Simple decorator-based transaction management
- 🔄 Automatic transaction handling (commit/rollback)
- 🔒 Transaction isolation level support
- 🎭 Proxy-based query interception
- 📦 Zero external dependencies (except Knex.js)
- 💪 TypeScript support out of the box
- Support for readonly transactions (requires Knex.js >= 2.5.0)

## Installation

```bash
npm install knex-transactional
```

### Options

- `isolationLevel`: Transaction isolation level ('read uncommitted' | 'read committed' | 'repeatable read' | 'serializable')
- `readOnly`
- Other Knex.TransactionConfig options

### Usage

```typescript
const knex = require("knex")({
  client: "mysql",
  connection: {
    host: "127.0.0.1",
    port: 3306,
    user: "your_database_user",
    password: "your_database_password",
    database: "myapp_test",
  },
});

const db = initializeTransactions(knex);

export default db;
```

## Performance Test Results

### Test Environment

- Testing Tool: Artillery
- Load Configuration:
  - Warm-up: 10 requests per second for 5 seconds
  - Peak Load: 100 requests per second for 120 seconds

### API Response Time Comparison

#### Decorator Approach (`/decorator`)

```typescript
@Transactional()
async insertUserWithTransaction(userId: number) {
    const result = await db("user")
    .insert({
        userId
    })
    .returning("*");

    await db("user")
      .update({
        userId
      })
      .where("id", result[0].id);
}
```

| Metric  | Response Time (ms) |
| ------- | ------------------ |
| Minimum | 2ms                |
| Median  | 6ms                |
| Mean    | 11.6ms             |
| p90     | 18ms               |
| p95     | 40.9ms             |
| p99     | 98.5ms             |
| Maximum | 355ms              |

#### Manual Transaction Approach (`/manual`)

```typescript
async insertUserManually(userId: number) {
    const trx = await db.transaction();
    try {
        const result = await trx("user")
            .insert({
                userId
            })
            .returning("*");

        await trx("user")
            .update({
                userId
            })
            .where("id", result[0].id);

        await trx.commit();
    } catch (error) {
        await trx.rollback();
        throw error;
    }
}
```

| Metric  | Response Time (ms) |
| ------- | ------------------ |
| Minimum | 2ms                |
| Median  | 7ms                |
| Mean    | 11.8ms             |
| p90     | 18ms               |
| p95     | 40ms               |
| p99     | 115.6ms            |
| Maximum | 356ms              |

### Key Findings

1. **General Performance**: Both approaches show similar performance in normal conditions (p50-p90), with differences of less than 1ms.
2. **High Load Stability**: The decorator approach shows slightly better stability under high load (p95-p99).
3. **Production Readiness**: Both methods demonstrate stable performance suitable for production environments.

### Test Statistics

- Total Requests: 12,050
- Success Rate: 100% (No Errors)
- Average RPS: 100
- Average Session Duration: 18.2ms

> Note: p95 indicates the response time for the 95th percentile of requests, meaning 95% of requests were processed within this time.

### Detailed Comparison

| Metric  | Decorator | Manual  | Difference |
| ------- | --------- | ------- | ---------- |
| Minimum | 2ms       | 2ms     | 0ms        |
| Median  | 6ms       | 7ms     | -1ms       |
| p90     | 18ms      | 18ms    | 0ms        |
| p95     | 40.9ms    | 40ms    | +0.9ms     |
| p99     | 98.5ms    | 115.6ms | -17.1ms    |
