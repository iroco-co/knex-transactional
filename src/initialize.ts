import { Knex } from "knex";

let knexInstance: Knex;

export function initializeKnex(knex: Knex) {
  knexInstance = knex;
}

export function getKnexInstance(): Knex {
  if (!knexInstance) {
    throw new Error(
      "Knex instance not initialized. Call initializeKnex first."
    );
  }
  return knexInstance;
}
