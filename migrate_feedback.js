// migrate_feedback.js - Move feedback records from feedback.db to main db.sqlite
const path = require('path');
const BetterSqlite3 = require('better-sqlite3');

const mainDbPath = path.join(__dirname, 'db.sqlite');
const feedbackDbPath = path.join(__dirname, 'feedback.db');

console.log('Starting feedback migration...');

try {
  // Open both databases
  const mainDb = new BetterSqlite3(mainDbPath);
  const feedbackDb = new BetterSqlite3(feedbackDbPath);

  // Get all records from feedback.db
  const feedbackRecords = feedbackDb.prepare('SELECT * FROM feedback ORDER BY created_at').all();
  
  if (feedbackRecords.length === 0) {
    console.log('No records found in feedback.db to migrate.');
    feedbackDb.close();
    mainDb.close();
    return;
  }

  console.log(`Found ${feedbackRecords.length} records to migrate.`);

  // Prepare insert statement for main database
  const insertStmt = mainDb.prepare('INSERT INTO feedback (name, email, message, created_at) VALUES (?, ?, ?, ?)');

  // Begin transaction for better performance
  const insertMany = mainDb.transaction((records) => {
    let migrated = 0;
    for (const record of records) {
      try {
        insertStmt.run(record.name, record.email, record.message, record.created_at);
        migrated++;
      } catch (e) {
        console.warn(`Failed to migrate record ID ${record.id}:`, e.message);
      }
    }
    return migrated;
  });

  // Execute migration
  const migratedCount = insertMany(feedbackRecords);
  
  console.log(`✅ Successfully migrated ${migratedCount} out of ${feedbackRecords.length} records.`);

  // Close databases
  feedbackDb.close();
  mainDb.close();

  console.log('Migration completed successfully!');
  
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
}
