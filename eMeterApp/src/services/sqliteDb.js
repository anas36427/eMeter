import * as SQLite from 'expo-sqlite';

let dbInstance = null;

/**
 * Get or open the SQLite database lazily
 */
export const getDb = () => {
    if (!dbInstance) {
        dbInstance = SQLite.openDatabaseSync('emeter.db');
    }
    return dbInstance;
};

// ─────────────────────────────────────────────────────────────────────────────
// MIGRATION SYSTEM
// Each entry = one migration. Never edit or remove existing entries.
// To add a new migration: append a new object at the end of the array.
// version: integer, must be sequential (1, 2, 3 ...)
// up:      async function that receives the db instance
// ─────────────────────────────────────────────────────────────────────────────
const MIGRATIONS = [
    {
        version: 1,
        description: 'Add phase_1_rent and phase_3_rent to billing_settings (replace meter_rent)',
        up: async (db) => {
            // Check which columns already exist so we never double-add
            const cols = await db.getAllAsync(`PRAGMA table_info(billing_settings)`);
            const colNames = cols.map(c => c.name);

            if (!colNames.includes('phase_1_rent')) {
                await db.runAsync(
                    `ALTER TABLE billing_settings ADD COLUMN phase_1_rent REAL DEFAULT 10.0`
                );
                console.log('✅ Migration 1: Added phase_1_rent column');
            }

            if (!colNames.includes('phase_3_rent')) {
                await db.runAsync(
                    `ALTER TABLE billing_settings ADD COLUMN phase_3_rent REAL DEFAULT 25.0`
                );
                console.log('✅ Migration 1: Added phase_3_rent column');
            }

            // Backfill: if old meter_rent exists, copy its value into phase_1_rent
            if (colNames.includes('meter_rent')) {
                await db.runAsync(`
                    UPDATE billing_settings
                    SET phase_1_rent = COALESCE(meter_rent, 10.0),
                        phase_3_rent = COALESCE(meter_rent * 2.5, 25.0)
                    WHERE phase_1_rent = 0 OR phase_1_rent IS NULL
                `);
                console.log('✅ Migration 1: Backfilled phase rent from meter_rent');
            }
        },
    },
    // ── Add future migrations here ────────────────────────────────────────────
    // {
    //     version: 2,
    //     description: 'Example: add new_column to consumers',
    //     up: async (db) => {
    //         const cols = await db.getAllAsync(`PRAGMA table_info(consumers)`);
    //         if (!cols.find(c => c.name === 'new_column')) {
    //             await db.runAsync(`ALTER TABLE consumers ADD COLUMN new_column TEXT DEFAULT ''`);
    //         }
    //     },
    // },
];

/**
 * Run all pending migrations in order.
 * Uses PRAGMA user_version as a simple version counter.
 * Each migration runs exactly once and is never repeated.
 */
const runMigrations = async (db) => {
    const [{ user_version: currentVersion }] = await db.getAllAsync(`PRAGMA user_version`);
    console.log(`📦 SQLite: DB is at schema version ${currentVersion}`);

    const pending = MIGRATIONS.filter(m => m.version > currentVersion);

    if (pending.length === 0) {
        console.log('✅ SQLite: Schema is up to date');
        return;
    }

    for (const migration of pending) {
        console.log(`⏳ SQLite: Running migration v${migration.version} — ${migration.description}`);
        try {
            await migration.up(db);
            // Advance the version counter AFTER the migration succeeds
            await db.runAsync(`PRAGMA user_version = ${migration.version}`);
            console.log(`✅ SQLite: Migration v${migration.version} complete`);
        } catch (err) {
            // Log and continue — don't crash the app over a non-critical migration.
            // The column check (PRAGMA table_info) at the start of each migration
            // makes it safe to retry on next launch.
            console.error(`❌ SQLite: Migration v${migration.version} failed:`, err.message);
        }
    }
};

/**
 * Initialize local SQL database tables and run any pending migrations.
 * Call this once at app startup before any other DB operation.
 *
 * Sequence:
 *   1. Open DB
 *   2. Run migrations (schema upgrades for existing users)
 *   3. CREATE TABLE IF NOT EXISTS (safe no-op for existing tables, creates for fresh installs)
 *   4. Seed default billing settings row
 */
export const initDatabase = async () => {
    try {
        const db = getDb();

        // Step 1: Run pending migrations FIRST (before CREATE TABLE IF NOT EXISTS)
        await runMigrations(db);

        // Step 2: Create base tables for fresh installs (no-op if they already exist)
        await db.execAsync(`
            CREATE TABLE IF NOT EXISTS consumers (
                id INTEGER PRIMARY KEY,
                consumer_number TEXT UNIQUE,
                name TEXT,
                email TEXT,
                phone TEXT,
                address TEXT,
                meter_number TEXT,
                meter_type TEXT,
                load_kw REAL,
                previous_reading REAL,
                status TEXT
            );
            CREATE TABLE IF NOT EXISTS meter_readings (
                id TEXT PRIMARY KEY,
                consumer_id INTEGER,
                consumer_number TEXT,
                consumer_name TEXT,
                meter_number TEXT,
                current_reading REAL,
                previous_reading REAL,
                reading_date TEXT,
                status TEXT,
                last_error TEXT,
                saved_at TEXT
            );
            CREATE TABLE IF NOT EXISTS billing_settings (
                id INTEGER PRIMARY KEY,
                rate_per_unit REAL,
                fixed_charge_per_kw REAL,
                duty_percentage REAL,
                phase_1_rent REAL DEFAULT 10.0,
                phase_3_rent REAL DEFAULT 25.0,
                surcharge_percentage REAL
            );
        `);

        // Step 3: Seed default settings row (INSERT OR IGNORE = safe no-op if already exists)
        await db.runAsync(`
            INSERT OR IGNORE INTO billing_settings
                (id, rate_per_unit, fixed_charge_per_kw, duty_percentage, phase_1_rent, phase_3_rent, surcharge_percentage)
            VALUES (1, 6.50, 50.00, 5.00, 10.00, 25.00, 2.00)
        `);

        console.log('📁 SQLite: Database ready');
        return true;
    } catch (err) {
        console.error('❌ Failed to initialize SQLite database:', err);
        throw err;
    }
};

/**
 * Execute a raw SQL query with parameters using modern async wrappers
 */
export const query = async (sql, params = []) => {
    try {
        const db = getDb();
        const isSelect = sql.trim().toLowerCase().startsWith('select');
        if (isSelect) {
            const rows = await db.getAllAsync(sql, params);
            return { rows, rowsAffected: 0 };
        } else {
            const result = await db.runAsync(sql, params);
            return {
                rows: [],
                rowsAffected: result.changes,
                insertId: result.lastInsertRowId
            };
        }
    } catch (err) {
        console.error('SQLite query execution error:', err, 'SQL:', sql);
        throw err;
    }
};

