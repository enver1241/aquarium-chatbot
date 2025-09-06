// migrate_feedback.js - Move old feedback records from feedback.db to main db.sqlite
const path = require('path');
const fs = require('fs');
const BetterSqlite3 = require('better-sqlite3');

const mainDbPath = path.join(__dirname, 'db.sqlite');
const feedbackDbPath = path.join(__dirname, 'feedback.db');

console.log('🔄 Starting feedback migration...');

// Check if feedback.db exists
if (!fs.existsSync(feedbackDbPath)) {
  console.log('❌ feedback.db not found. Nothing to migrate.');
  process.exit(0);
}

// Check if main db exists
if (!fs.existsSync(mainDbPath)) {
  console.log('❌ Main database (db.sqlite) not found.');
  process.exit(1);
}

try {
  // Open both databases
  const mainDb = new BetterSqlite3(mainDbPath);
  const feedbackDb = new BetterSqlite3(feedbackDbPath);
  
  console.log('📂 Databases opened successfully');
  
  // Get all records from feedback.db
  const oldRecords = feedbackDb.prepare('SELECT * FROM feedback ORDER BY created_at ASC').all();
  console.log(`📊 Found ${oldRecords.length} records in feedback.db`);
  
  if (oldRecords.length === 0) {
    console.log('✅ No records to migrate.');
    feedbackDb.close();
    mainDb.close();
    process.exit(0);
  }
  
  // Prepare insert statement for main db
  const insertStmt = mainDb.prepare('INSERT INTO feedback (name, email, message, created_at) VALUES (?, ?, ?, ?)');
  
  // Begin transaction for better performance
  const transaction = mainDb.transaction((records) => {
    let migrated = 0;
    for (const record of records) {
      try {
        insertStmt.run(record.name, record.email, record.message, record.created_at);
        migrated++;
      } catch (err) {
        console.warn(`⚠️  Failed to migrate record ID ${record.id}: ${err.message}`);
      }
    }
    return migrated;
  });
  
  // Execute migration
  const migratedCount = transaction(oldRecords);
  
  console.log(`✅ Successfully migrated ${migratedCount}/${oldRecords.length} records`);
  
  // Close databases
  feedbackDb.close();
  mainDb.close();
  
  // Optionally backup and remove old database
  if (migratedCount === oldRecords.length) {
    const backupPath = feedbackDbPath + '.backup';
    fs.renameSync(feedbackDbPath, backupPath);
    console.log(`📦 Old database backed up as: ${backupPath}`);
    console.log('🎉 Migration completed successfully!');
  } else {
    console.log('⚠️  Migration completed with some errors. Old database preserved.');
  }
  
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
}
