const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres:HeartSyncVersionWInner@db.cnewnmlodacuokqdoxqb.supabase.co:5432/postgres';

async function runMigrations() {
  const client = new Client({
    connectionString,
  });

  try {
    await client.connect();
    console.log('Connected to database successfully');

    const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
    const files = fs.readdirSync(migrationsDir).sort(); // Ensure order by filename

    for (const file of files) {
      if (file.endsWith('.sql')) {
        const filePath = path.join(migrationsDir, file);
        console.log(`Executing migration: ${file}`);
        const sql = fs.readFileSync(filePath, 'utf8');
        await client.query(sql);
        console.log(`Successfully applied ${file}`);
      }
    }
    
    console.log('All migrations applied successfully!');
  } catch (err) {
    console.error('Error during migration:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
