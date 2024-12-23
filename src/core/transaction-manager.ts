import * as cls from "cls-hooked";
import { Knex } from "knex";

interface KnexTransaction extends Knex.Transaction {
  connection: any;
}

export class TransactionManager {
  private static namespace = cls.createNamespace("transaction-namespace");
  private static db: Knex;

  static initialize(knexInstance: Knex) {
    this.db = knexInstance;

    // Proxy the entire Knex instance
    return new Proxy(knexInstance, {
      get: (target: any, prop: string | symbol) => {
        if (prop === "client") {
          // Proxy the client object
          return new Proxy(target.client, {
            get: (clientTarget: any, clientProp: string | symbol) => {
              if (clientProp === "query") {
                return function (conn: any, sql: any, status: any, value: any) {
                  const trx =
                    TransactionManager.getTransaction() as KnexTransaction;
                  if (trx) {
                    return clientTarget.query.call(
                      clientTarget,
                      trx.connection,
                      sql,
                      status,
                      value
                    );
                  }
                  return clientTarget.query.call(
                    clientTarget,
                    conn,
                    sql,
                    status,
                    value
                  );
                };
              }
              return clientTarget[clientProp];
            },
          });
        }
        return target[prop];
      },
    });
  }

  static getTransaction(): Knex.Transaction | undefined {
    return this.namespace.get("transaction");
  }

  static async runInTransaction<T>(
    callback: () => Promise<T>,
    isolationLevel?: Knex.IsolationLevels
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.namespace.run(async () => {
        const trx = await this.db.transaction({
          isolationLevel,
        });

        this.namespace.set("transaction", trx);

        try {
          const result = await callback();
          await trx.commit();
          resolve(result);
        } catch (error) {
          await trx.rollback();
          reject(error);
        }
      });
    });
  }
}
