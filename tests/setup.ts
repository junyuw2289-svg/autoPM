import { createDb } from '../src/db/connection.js';
import type Database from 'better-sqlite3';

export function createTestDb(): Database.Database {
  return createDb(':memory:');
}
