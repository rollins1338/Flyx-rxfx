/**
 * Database Module
 * Central export for all database functionality
 */

export { getDB, DatabaseConnection } from './connection';
export { queries, AnalyticsQueries, MetricsQueries, ContentStatsQueries, AdminQueries } from './queries';
export { getMigrationManager, MigrationManager, type Migration } from './migrations';
export { TABLES, SCHEMA_VERSION, ALL_TABLES } from './schema';

/**
 * Initialize database with all tables and migrations
 */
export async function initializeDatabase() {
  const { initializeDB } = await import('./connection');
  const { getMigrationManager } = await import('./migrations');
  
  // Initialize connection and create tables
  await initializeDB();
  
  // Run any pending migrations
  const migrationManager = getMigrationManager();
  await migrationManager.runMigrations();
  
  const { getDB } = await import('./connection');
  return getDB();
}

/**
 * Close database connection
 */
export function closeDatabase() {
  const { getDB } = require('./connection');
  getDB().close();
}

/**
 * Health check for database
 */
export function checkDatabaseHealth(): boolean {
  const { getDB } = require('./connection');
  return getDB().healthCheck();
}
