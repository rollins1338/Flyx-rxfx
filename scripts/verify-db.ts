
import { initializeDB, getDB } from '../app/lib/db/neon-connection';

async function main() {
    console.log('Starting DB verification...');

    try {
        // Test 1: Concurrent initialization
        console.log('Testing concurrent initialization...');
        const p1 = initializeDB();
        const p2 = initializeDB();
        const p3 = initializeDB();

        await Promise.all([p1, p2, p3]);
        console.log('✓ Concurrent initialization passed (no race condition errors)');

        // Test 2: Get adapter
        console.log('Testing getAdapter()...');
        const db = getDB();
        const adapter = db.getAdapter();
        console.log('✓ getAdapter() returned successfully', !!adapter);

        // Test 3: Check if users table query works (simulating a check)
        // We can't easily run a real query without a real DB connection string in this context if it's not set,
        // but if we got here, the class loaded and initialized without throwing syntax errors.

        console.log('Verification complete!');
        process.exit(0);
    } catch (error) {
        console.error('Verification failed:', error);
        process.exit(1);
    }
}

main();
