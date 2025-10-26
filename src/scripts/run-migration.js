import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Use service key for admin operations
);

async function runMigration() {
  try {
    console.log('🚀 Running migration: Rename sender_id to user_id...');
    
    // Read migration file
    const migrationPath = join(__dirname, '..', 'models', 'sql', 'migrations', '2025_10_26_rename_sender_id_to_user_id.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    console.log('📄 Migration SQL:');
    console.log(migrationSQL);
    console.log('');
    
    // Execute migration using Supabase SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });
    
    if (error) {
      // Try alternative method: direct SQL execution
      console.log('⚠️  RPC method failed, trying direct execution...');
      
      // For PostgreSQL, we need to use the REST API
      const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify({ sql: migrationSQL })
      });
      
      if (!response.ok) {
        throw new Error(`Migration failed: ${response.statusText}`);
      }
      
      console.log('✅ Migration executed successfully (direct method)');
    } else {
      console.log('✅ Migration executed successfully (RPC method)');
      console.log('Result:', data);
    }
    
    // Verify the change
    console.log('\n🔍 Verifying schema change...');
    const { data: columns, error: columnError } = await supabase
      .from('messages')
      .select('*')
      .limit(1);
    
    if (columnError) {
      console.log('⚠️  Could not verify schema (this is normal if table is empty)');
    } else {
      const columnNames = columns && columns.length > 0 ? Object.keys(columns[0]) : [];
      console.log('Table columns:', columnNames);
      
      if (columnNames.includes('user_id')) {
        console.log('✅ Column "user_id" exists - migration successful!');
      } else if (columnNames.includes('sender_id')) {
        console.log('❌ Column "sender_id" still exists - migration may have failed');
      } else {
        console.log('⚠️  Could not verify column existence');
      }
    }
    
    console.log('\n✅ Migration completed successfully!');
    console.log('📝 Note: You may need to run this migration manually in Supabase SQL Editor if automatic execution failed.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\n📝 To run manually, copy and paste the SQL from:');
    console.error('   src/models/sql/migrations/2025_10_26_rename_sender_id_to_user_id.sql');
    console.error('   into Supabase SQL Editor at: https://supabase.com/dashboard/project/_/sql');
    process.exit(1);
  }
}

// Run migration
runMigration();
