/**
 * Database Migration System
 * Handles schema updates and versioning
 */

import Database from 'better-sqlite3';
import { getDB, initializeDB } from './connection';
import { TABLES, SCHEMA_VERSION } from './schema';

export interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
  down?: (db: Database.Database) => void;
}

/**
 * Migration registry
 * Add new migrations here as the schema evolves
 */
const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: (_db: Database.Database) => {
      // Initial schema is created by connection.ts
      console.log('✓ Initial schema already created');
    },
  },
  // Future migrations go here
  // Example:
  // {
  //   version: 2,
  //   name: 'add_user_preferences',
  //   up: (db: Database.Database) => {
  //     db.exec(`
  //       CREATE TABLE user_preferences (
  //         user_id TEXT PRIMARY KEY,
  //         theme TEXT DEFAULT 'dark',
  //         language TEXT DEFAULT 'en'
  //       );
  //     `);
  //   },
  //   down: (db: Database.Database) => {
  //     db.exec('DROP TABLE IF EXISTS user_preferences;');
  //   },
  // },
];

/**
 * Migration Manager
 */
export class MigrationManager {
  private db: Database.Database;

  constructor() {
    this.db = getDB();
  }

  /**
   * Get current schema version
   */
  getCurrentVersion(): number {
    try {
      const result = this.db
        .prepare(`SELECT MAX(version) as version FROM ${TABLES.SCHEMA_MIGRATIONS}`)
        .get() as { version: number | null };
      
      return result.version || 0;
    } catch (error) {
      console.error('Failed to get current version:', error);
      return 0;
    }
  }

  /**
   * Get all applied migrations
   */
  getAppliedMigrations(): Array<{ version: number; name: string; appliedAt: number }> {
    try {
      const rows = this.db
        .prepare(`SELECT * FROM ${TABLES.SCHEMA_MIGRATIONS} ORDER BY version ASC`)
        .all() as any[];
      
      return rows.map(row => ({
        version: row.version,
        name: row.name,
        appliedAt: row.applied_at,
      }));
    } catch (error) {
      console.error('Failed to get applied migrations:', error);
      return [];
    }
  }

  /**
   * Check if a migration has been applied
   */
  isMigrationApplied(version: number): boolean {
    try {
      const result = this.db
        .prepare(`SELECT COUNT(*) as count FROM ${TABLES.SCHEMA_MIGRATIONS} WHERE version = ?`)
        .get(version) as { count: number };
      
      return result.count > 0;
    } catch (error) {
      console.error('Failed to check migration:', error);
      return false;
    }
  }

  /**
   * Record a migration as applied
   */
  private recordMigration(version: number, name: string): void {
    this.db
      .prepare(`INSERT INTO ${TABLES.SCHEMA_MIGRATIONS} (version, name) VALUES (?, ?)`)
      .run(version, name);
  }

  /**
   * Remove a migration record
   */
  private removeMigration(version: number): void {
    this.db
      .prepare(`DELETE FROM ${TABLES.SCHEMA_MIGRATIONS} WHERE version = ?`)
      .run(version);
  }

  /**
   * Run pending migrations
   */
  async runMigrations(): Promise<void> {
    const currentVersion = this.getCurrentVersion();
    const pendingMigrations = migrations.filter(m => m.version > currentVersion);

    if (pendingMigrations.length === 0) {
      console.log('✓ No pending migrations');
      return;
    }

    console.log(`Running ${pendingMigrations.length} pending migration(s)...`);

    for (const migration of pendingMigrations) {
      try {
        console.log(`  Applying migration ${migration.version}: ${migration.name}`);
        
        // Run migration in transaction
        this.db.exec('BEGIN TRANSACTION;');
        migration.up(this.db);
        this.recordMigration(migration.version, migration.name);
        this.db.exec('COMMIT;');
        
        console.log(`  ✓ Migration ${migration.version} applied successfully`);
      } catch (error) {
        this.db.exec('ROLLBACK;');
        console.error(`  ✗ Migration ${migration.version} failed:`, error);
        throw new Error(`Migration ${migration.version} failed: ${error}`);
      }
    }

    console.log('✓ All migrations completed successfully');
  }

  /**
   * Rollback last migration
   */
  async rollbackLastMigration(): Promise<void> {
    const currentVersion = this.getCurrentVersion();
    
    if (currentVersion === 0) {
      console.log('No migrations to rollback');
      return;
    }

    const migration = migrations.find(m => m.version === currentVersion);
    
    if (!migration) {
      throw new Error(`Migration ${currentVersion} not found in registry`);
    }

    if (!migration.down) {
      throw new Error(`Migration ${currentVersion} does not have a rollback function`);
    }

    try {
      console.log(`Rolling back migration ${migration.version}: ${migration.name}`);
      
      this.db.exec('BEGIN TRANSACTION;');
      migration.down(this.db);
      this.removeMigration(migration.version);
      this.db.exec('COMMIT;');
      
      console.log(`✓ Migration ${migration.version} rolled back successfully`);
    } catch (error) {
      this.db.exec('ROLLBACK;');
      console.error(`Rollback failed:`, error);
      throw new Error(`Rollback failed: ${error}`);
    }
  }

  /**
   * Rollback to specific version
   */
  async rollbackToVersion(targetVersion: number): Promise<void> {
    const currentVersion = this.getCurrentVersion();
    
    if (targetVersion >= currentVersion) {
      console.log('Target version is current or higher, nothing to rollback');
      return;
    }

    const migrationsToRollback = migrations
      .filter(m => m.version > targetVersion && m.version <= currentVersion)
      .sort((a, b) => b.version - a.version); // Rollback in reverse order

    console.log(`Rolling back ${migrationsToRollback.length} migration(s) to version ${targetVersion}...`);

    for (const migration of migrationsToRollback) {
      if (!migration.down) {
        throw new Error(`Migration ${migration.version} does not have a rollback function`);
      }

      try {
        console.log(`  Rolling back migration ${migration.version}: ${migration.name}`);
        
        this.db.exec('BEGIN TRANSACTION;');
        migration.down(this.db);
        this.removeMigration(migration.version);
        this.db.exec('COMMIT;');
        
        console.log(`  ✓ Migration ${migration.version} rolled back`);
      } catch (error) {
        this.db.exec('ROLLBACK;');
        console.error(`  ✗ Rollback of migration ${migration.version} failed:`, error);
        throw new Error(`Rollback failed: ${error}`);
      }
    }

    console.log('✓ Rollback completed successfully');
  }

  /**
   * Get migration status
   */
  getStatus(): {
    currentVersion: number;
    latestVersion: number;
    pendingMigrations: number;
    appliedMigrations: Array<{ version: number; name: string; appliedAt: number }>;
  } {
    const currentVersion = this.getCurrentVersion();
    const latestVersion = SCHEMA_VERSION;
    const appliedMigrations = this.getAppliedMigrations();
    const pendingMigrations = migrations.filter(m => m.version > currentVersion).length;

    return {
      currentVersion,
      latestVersion,
      pendingMigrations,
      appliedMigrations,
    };
  }

  /**
   * Reset database (drop all tables and rerun migrations)
   * WARNING: This will delete all data!
   */
  async resetDatabase(): Promise<void> {
    console.warn('⚠️  Resetting database - all data will be lost!');
    
    try {
      // Drop all tables
      this.db.exec(`DROP TABLE IF EXISTS ${TABLES.ANALYTICS_EVENTS};`);
      this.db.exec(`DROP TABLE IF EXISTS ${TABLES.METRICS_DAILY};`);
      this.db.exec(`DROP TABLE IF EXISTS ${TABLES.CONTENT_STATS};`);
      this.db.exec(`DROP TABLE IF EXISTS ${TABLES.ADMIN_USERS};`);
      this.db.exec(`DROP TABLE IF EXISTS ${TABLES.SCHEMA_MIGRATIONS};`);
      
      console.log('✓ All tables dropped');
      
      // Reinitialize database
      await initializeDB();
      
      // Run all migrations
      await this.runMigrations();
      
      console.log('✓ Database reset complete');
    } catch (error) {
      console.error('Database reset failed:', error);
      throw new Error(`Database reset failed: ${error}`);
    }
  }
}

/**
 * Export migration manager instance
 */
export const getMigrationManager = () => new MigrationManager();
