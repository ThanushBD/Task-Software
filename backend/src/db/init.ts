// db/init.ts
import pool from '../config/db';
import * as fs from 'fs';
import * as path from 'path';

export class DatabaseInitError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'DatabaseInitError';
  }
}

function smartSqlSplit(sql: string): string[] {
  const statements: string[] = [];
  let currentStatement = '';
  let inDollarQuote = false;
  let dollarTag = '';
  let inStringLiteral = false;
  let inComment = false;
  let lineComment = false;
  
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const nextChar = sql[i + 1];
    const prevChar = sql[i - 1];
    
    // Handle line comments
    if (!inDollarQuote && !inStringLiteral && char === '-' && nextChar === '-') {
      lineComment = true;
      currentStatement += char;
      continue;
    }
    
    // Handle end of line comment
    if (lineComment && (char === '\n' || char === '\r')) {
      lineComment = false;
      currentStatement += char;
      continue;
    }
    
    // Skip processing if in line comment
    if (lineComment) {
      currentStatement += char;
      continue;
    }
    
    // Handle block comments
    if (!inDollarQuote && !inStringLiteral && char === '/' && nextChar === '*') {
      inComment = true;
      currentStatement += char;
      continue;
    }
    
    if (inComment && char === '*' && nextChar === '/') {
      inComment = false;
      currentStatement += char + nextChar;
      i++; // Skip next character
      continue;
    }
    
    // Skip processing if in comment
    if (inComment) {
      currentStatement += char;
      continue;
    }
    
    // Handle dollar quoting
    if (!inStringLiteral && char === '$') {
      if (!inDollarQuote) {
        // Start of dollar quote - find the tag
        let tagEnd = i + 1;
        while (tagEnd < sql.length && sql[tagEnd] !== '$') {
          tagEnd++;
        }
        if (tagEnd < sql.length) {
          dollarTag = sql.substring(i, tagEnd + 1);
          inDollarQuote = true;
          currentStatement += char;
          continue;
        }
      } else {
        // Check if this is the end of the dollar quote
        const possibleEndTag = sql.substring(i, i + dollarTag.length);
        if (possibleEndTag === dollarTag) {
          inDollarQuote = false;
          currentStatement += possibleEndTag;
          i += dollarTag.length - 1;
          dollarTag = '';
          continue;
        }
      }
    }
    
    // Handle string literals
    if (!inDollarQuote && char === "'" && prevChar !== '\\') {
      inStringLiteral = !inStringLiteral;
    }
    
    // Handle statement termination
    if (!inDollarQuote && !inStringLiteral && !inComment && !lineComment && char === ';') {
      currentStatement += char;
      const trimmedStatement = currentStatement.trim();
      if (trimmedStatement.length > 0) {
        statements.push(trimmedStatement);
      }
      currentStatement = '';
      continue;
    }
    
    currentStatement += char;
  }
  
  // Add any remaining statement
  const trimmedStatement = currentStatement.trim();
  if (trimmedStatement.length > 0) {
    statements.push(trimmedStatement);
  }
  
  return statements;
}

// Check if database objects already exist
async function checkDatabaseObjects(client: any): Promise<{
  enumTypes: string[];
  tables: string[];
  functions: string[];
  indexes: string[];
}> {
  const [enumResult, tableResult, functionResult, indexResult] = await Promise.all([
    // Check ENUM types - UPDATED to include 'user_role' and 'notification_type'
    client.query(`
      SELECT typname 
      FROM pg_type 
      WHERE typname IN ('task_status', 'task_priority', 'user_role', 'notification_type')
    `),
    
    // Check tables - UPDATED to include 'users'
    client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'tasks', 'task_attachments', 'task_comments', 'task_dependencies', 'task_activity_log', 'notifications', 'user_sessions', 'task_watchers', 'time_entries')
    `),
    
    // Check functions - UPDATED to include new functions
    client.query(`
      SELECT proname 
      FROM pg_proc 
      WHERE proname IN ('update_updated_at_column', 'log_task_activity', 'set_completed_at', 'calculate_time_entry_duration', 'get_user_tasks')
    `),
    
    // Check indexes
    client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND indexname LIKE 'idx_%'
    `)
  ]);

  return {
    enumTypes: enumResult.rows.map((row: any) => row.typname),
    tables: tableResult.rows.map((row: any) => row.table_name),
    functions: functionResult.rows.map((row: any) => row.proname),
    indexes: indexResult.rows.map((row: any) => row.indexname)
  };
}

function makeStatementIdempotent(statement: string, existingObjects: any): string {
  const trimmedStatement = statement.trim();
  
  // Skip empty statements
  if (!trimmedStatement) {
    return statement;
  }
  
  // Skip pure comment lines
  if (trimmedStatement.startsWith('--') && !trimmedStatement.includes('CREATE')) {
    return statement;
  }
  
  // Extract the actual SQL command from statements that start with comments
  let actualStatement = trimmedStatement;
  const lines = trimmedStatement.split('\n');
  let sqlStartIndex = 0;
  
  // Find the first line that contains actual SQL (not just comments)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line && !line.startsWith('--')) {
      sqlStartIndex = i;
      break;
    }
  }
  
  // Get the SQL part without leading comments
  const sqlLines = lines.slice(sqlStartIndex);
  const sqlPart = sqlLines.join('\n').trim();
  const upperStatement = sqlPart.toUpperCase();
  
  console.log(`🔍 Processing statement type: ${upperStatement.split(' ').slice(0, 3).join(' ')}`);
  
  // Handle CREATE TYPE statements
  if (upperStatement.startsWith('CREATE TYPE')) {
    const typeMatch = sqlPart.match(/CREATE TYPE\s+([^\s]+)/i);
    if (typeMatch) {
      const typeName = typeMatch[1];
      console.log(`🔍 Checking if ENUM type '${typeName}' exists...`);
      if (existingObjects.enumTypes.includes(typeName)) {
        console.log(`⚠️  ENUM type '${typeName}' already exists, skipping...`);
        return '-- SKIPPED: ' + statement; // Correctly skip the statement
      } else {
        console.log(`✅ ENUM type '${typeName}' doesn't exist, will create...`);
      }
    }
  }
  
  // Handle CREATE TABLE statements
  if (upperStatement.startsWith('CREATE TABLE')) {
    const tableMatch = sqlPart.match(/CREATE TABLE\s+([^\s\(]+)/i);
    if (tableMatch) {
      const tableName = tableMatch[1];
      console.log(`🔍 Checking if table '${tableName}' exists...`);
      if (existingObjects.tables.includes(tableName)) {
        console.log(`⚠️  Table '${tableName}' already exists, skipping...`);
        return '-- SKIPPED: ' + statement;
      } else {
        console.log(`✅ Table '${tableName}' doesn't exist, will create...`);
      }
    }
  }
  
  // Handle CREATE FUNCTION statements
  if (upperStatement.startsWith('CREATE FUNCTION') || upperStatement.startsWith('CREATE OR REPLACE FUNCTION')) {
    const functionMatch = sqlPart.match(/CREATE(?:\s+OR\s+REPLACE)?\s+FUNCTION\s+([^\s\(]+)/i);
    if (functionMatch) {
      const functionName = functionMatch[1];
      console.log(`🔍 Checking if function '${functionName}' exists...`);
      if (existingObjects.functions.includes(functionName) && !upperStatement.includes('OR REPLACE')) {
        console.log(`⚠️  Function '${functionName}' already exists, using CREATE OR REPLACE...`);
        return statement.replace(/CREATE\s+FUNCTION/i, 'CREATE OR REPLACE FUNCTION');
      }
    }
  }
  
  // Handle CREATE INDEX statements
  if (upperStatement.startsWith('CREATE INDEX') || upperStatement.startsWith('CREATE UNIQUE INDEX')) {
    // Handle both "CREATE INDEX name" and "CREATE INDEX IF NOT EXISTS name"
    const indexMatch = sqlPart.match(/CREATE(?:\s+UNIQUE)?\s+INDEX(?:\s+IF\s+NOT\s+EXISTS)?\s+([^\s]+)/i);
    if (indexMatch) {
      const indexName = indexMatch[1];
      console.log(`🔍 Checking if index '${indexName}' exists...`);
      if (existingObjects.indexes.includes(indexName)) {
        console.log(`⚠️  Index '${indexName}' already exists, skipping...`);
        return '-- SKIPPED: ' + statement;
      } else {
        console.log(`✅ Index '${indexName}' doesn't exist, will create...`);
      }
    }
  }

  // Handle CREATE VIEW statements
  if (upperStatement.startsWith('CREATE VIEW') || upperStatement.startsWith('CREATE OR REPLACE VIEW')) {
    const viewMatch = sqlPart.match(/CREATE(?:\s+OR\s+REPLACE)?\s+VIEW\s+([^\s]+)/i);
    if (viewMatch) {
      const viewName = viewMatch[1];
      // Views are often created with CREATE OR REPLACE, so this is generally idempotent
      console.log(`🔍 Processing view '${viewName}', using CREATE OR REPLACE...`);
      return statement.replace(/CREATE\s+VIEW/i, 'CREATE OR REPLACE VIEW');
    }
  }
  
  // Handle CREATE TRIGGER statements
  if (upperStatement.startsWith('CREATE TRIGGER')) {
    // Triggers need to be idempotent as well. The schema uses DO $$ BEGIN IF NOT EXISTS... END $$; which makes them idempotent.
    // However, if it's a simple CREATE TRIGGER without IF NOT EXISTS, we should add logic here.
    // For now, given the schema uses DO blocks, we'll let it pass, but it's good to be aware.
    // If it were "CREATE TRIGGER name BEFORE UPDATE ON table...", we'd replace with "DROP TRIGGER IF EXISTS name ON table; CREATE TRIGGER..."
    console.log(`🔍 Processing CREATE TRIGGER statement...`);
    return statement; 
  }
  
  return statement;
}

export async function initializeDatabase(): Promise<void> {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Initializing database...');
    
    // Check if database connection is working
    await client.query('SELECT NOW()');
    console.log('✅ Database connection established');

    // Check existing database objects
    const existingObjects = await checkDatabaseObjects(client);
    console.log('📋 Existing database objects:', {
      enumTypes: existingObjects.enumTypes.length,
      tables: existingObjects.tables.length,
      functions: existingObjects.functions.length,
      indexes: existingObjects.indexes.length
    });
    console.log('🔍 Existing ENUM types:', existingObjects.enumTypes);
    console.log('🔍 Existing tables:', existingObjects.tables);

    // Read and execute schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    
    if (!fs.existsSync(schemaPath)) {
      throw new DatabaseInitError(`Schema file not found at: ${schemaPath}`);
    }

    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    if (!schema.trim()) {
      throw new DatabaseInitError('Schema file is empty');
    }

    // Execute schema within a transaction
    await client.query('BEGIN');
    
    try {
      // Use smart SQL splitting to handle dollar-quoted strings properly
      const statements = smartSqlSplit(schema);
      const processedStatements = statements.map(stmt => 
        makeStatementIdempotent(stmt, existingObjects)
      );

      console.log(`📝 Executing ${processedStatements.length} SQL statements...`);

      let executedCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < processedStatements.length; i++) {
        const statement = processedStatements[i];
        if (statement.trim()) {
          try {
            // Skip commented out statements
            if (statement.trim().startsWith('-- SKIPPED:')) {
              skippedCount++;
              console.log(`⏭️  Statement ${i + 1}/${processedStatements.length} skipped (already exists)`);
            } else {
              // Log the first 150 characters of each statement for debugging
              console.log(`🔍 Executing statement ${i + 1}: ${statement.trim().substring(0, 150)}...`);
              await client.query(statement);
              executedCount++;
              console.log(`✅ Statement ${i + 1}/${processedStatements.length} executed successfully`);
            }
          } catch (error) {
            console.error(`❌ Error in statement ${i + 1}:`, statement.substring(0, 100) + '...');
            console.error('Full statement:', statement);
            console.error('Error details:', error);
            throw error;
          }
        }
      }
      
      await client.query('COMMIT');
      console.log(`✅ Database schema initialized successfully (${executedCount} executed, ${skippedCount} skipped)`);
      
      // Verify tables were created
      await verifyTables(client);
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error initializing database:', errorMessage);
    
    if (error instanceof DatabaseInitError) {
      throw error;
    } else {
      throw new DatabaseInitError('Failed to initialize database', error instanceof Error ? error : undefined);
    }
  } finally {
    client.release();
  }
}

async function verifyTables(client: any): Promise<void> {
  try {
    // Updated to match actual tables in schema
    const requiredTables = ['users', 'tasks', 'task_attachments', 'task_comments', 'task_dependencies', 'task_activity_log', 'notifications', 'user_sessions'];
    
    for (const tableName of requiredTables) {
      const result = await client.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )`,
        [tableName]
      );
      
      if (!result.rows[0].exists) {
        throw new DatabaseInitError(`Required table '${tableName}' was not created`);
      }
    }
    
    console.log('✅ All required tables verified');
    
    // Verify ENUM types
    const enumTypes = ['task_status', 'task_priority', 'user_role', 'notification_type'];
    for (const enumType of enumTypes) {
      const result = await client.query(
        `SELECT EXISTS (
          SELECT FROM pg_type 
          WHERE typname = $1
        )`,
        [enumType]
      );
      
      if (!result.rows[0].exists) {
        throw new DatabaseInitError(`Required ENUM type '${enumType}' was not created`);
      }
    }
    
    console.log('✅ All required ENUM types verified');
    
    // Verify indexes (optional - don't fail if missing)
    const criticalIndexes = [
      'idx_users_role',
      'idx_users_soft_deleted',
      'idx_tasks_status',
      'idx_tasks_priority',
      'idx_tasks_deadline',
      'idx_tasks_assigner_id',
      'idx_tasks_assigned_user_id',
      'idx_tasks_project_id',
      'idx_tasks_soft_deleted',
      'idx_tasks_recurring_pattern_gin',
      'idx_task_comments_task_id',
      'idx_task_comments_user_id',
      'idx_task_attachments_task_id',
      'idx_task_attachments_user_id',
      'idx_notifications_user_unread',
      'idx_notifications_task_id',
      'idx_task_activity_log_task_id',
      'idx_task_activity_log_user_id'
    ];
    
    let indexCount = 0;
    for (const indexName of criticalIndexes) {
      const result = await client.query(
        `SELECT EXISTS (
          SELECT FROM pg_indexes 
          WHERE schemaname = 'public' 
          AND indexname = $1
        )`,
        [indexName]
      );
      
      if (result.rows[0].exists) {
        indexCount++;
      } else {
        console.warn(`⚠️  Index '${indexName}' was not found`);
      }
    }
    
    console.log(`✅ Database verification completed (${indexCount}/${criticalIndexes.length} indexes found)`);
    
  } catch (error) {
    throw new DatabaseInitError('Failed to verify database tables', error instanceof Error ? error : undefined);
  }
}

export async function resetDatabase(): Promise<void> {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Resetting database...');
    
    await client.query('BEGIN');
    
    // Drop tables in reverse order due to foreign key constraints - UPDATED with all new tables
    const dropQueries = [
      'DROP TABLE IF EXISTS time_entries CASCADE',
      'DROP TABLE IF EXISTS task_watchers CASCADE',
      'DROP TABLE IF EXISTS user_sessions CASCADE',
      'DROP TABLE IF EXISTS notifications CASCADE',
      'DROP TABLE IF EXISTS task_activity_log CASCADE',
      'DROP TABLE IF EXISTS task_dependencies CASCADE',
      'DROP TABLE IF EXISTS task_comments CASCADE',
      'DROP TABLE IF EXISTS task_attachments CASCADE', 
      'DROP TABLE IF EXISTS tasks CASCADE',
      'DROP TABLE IF EXISTS users CASCADE',
      'DROP TYPE IF EXISTS task_status CASCADE',
      'DROP TYPE IF EXISTS task_priority CASCADE',
      'DROP TYPE IF EXISTS user_role CASCADE', // Added
      'DROP TYPE IF EXISTS notification_type CASCADE', // Added
      'DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE',
      'DROP FUNCTION IF EXISTS log_task_activity() CASCADE', // Added
      'DROP FUNCTION IF EXISTS set_completed_at() CASCADE', // Added
      'DROP FUNCTION IF EXISTS calculate_time_entry_duration() CASCADE', // Added
      'DROP FUNCTION IF EXISTS get_user_tasks(INTEGER) CASCADE', // Added
      'DROP VIEW IF EXISTS active_tasks CASCADE', // Added
      'DROP VIEW IF EXISTS task_dashboard CASCADE' // Added
    ];
    
    for (const query of dropQueries) {
      await client.query(query);
    }
    
    await client.query('COMMIT');
    console.log('✅ Database reset completed');
    
    // Reinitialize
    await initializeDatabase();
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw new DatabaseInitError('Failed to reset database', error instanceof Error ? error : undefined);
  } finally {
    client.release();
  }
}

export async function checkDatabaseHealth(): Promise<{ healthy: boolean; details: any }> {
  const client = await pool.connect();
  
  try {
    const healthChecks = {
      connection: false,
      enumTypes: false, // Added
      tables: false,
      functions: false, // Added
      indexes: false,
      constraints: false,
      views: false // Added
    };
    
    // Test connection
    await client.query('SELECT 1');
    healthChecks.connection = true;

    // Check ENUM types exist - UPDATED to include new enum types
    const enumResult = await client.query(`
      SELECT count(*) as count 
      FROM pg_type 
      WHERE typname IN ('task_status', 'task_priority', 'user_role', 'notification_type')
    `);
    healthChecks.enumTypes = parseInt(enumResult.rows[0].count) === 4;

    // Check tables exist - UPDATED count for all new tables
    const tableResult = await client.query(`
      SELECT count(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'tasks', 'task_attachments', 'task_comments', 'task_dependencies', 'task_activity_log', 'notifications', 'user_sessions', 'task_watchers', 'time_entries')
    `);
    healthChecks.tables = parseInt(tableResult.rows[0].count) === 10;
    
    // Check functions exist - UPDATED to include new functions
    const functionResult = await client.query(`
      SELECT count(*) as count 
      FROM pg_proc 
      WHERE proname IN ('update_updated_at_column', 'log_task_activity', 'set_completed_at', 'calculate_time_entry_duration', 'get_user_tasks')
    `);
    healthChecks.functions = parseInt(functionResult.rows[0].count) === 5;

    // Check indexes exist - this is a generic check, a more detailed one is in verifyTables
    const indexResult = await client.query(`
      SELECT count(*) as count 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND indexname LIKE 'idx_%'
    `);
    healthChecks.indexes = parseInt(indexResult.rows[0].count) > 0;
    
    // Check foreign key constraints - UPDATED count (minimum expected based on new schema)
    const constraintResult = await client.query(`
      SELECT count(*) as count 
      FROM information_schema.table_constraints 
      WHERE constraint_schema = 'public' 
      AND constraint_type = 'FOREIGN KEY'
    `);
    healthChecks.constraints = parseInt(constraintResult.rows[0].count) >= 10; // At least 10 foreign keys from the schema

    // Check views exist - Added
    const viewResult = await client.query(`
      SELECT count(*) as count
      FROM information_schema.views
      WHERE table_schema = 'public'
      AND table_name IN ('active_tasks', 'task_dashboard')
    `);
    healthChecks.views = parseInt(viewResult.rows[0].count) === 2;

    const healthy = Object.values(healthChecks).every(check => check === true);
    
    return {
      healthy,
      details: {
        ...healthChecks,
        timestamp: new Date().toISOString(),
        poolConnections: {
          total: pool.totalCount,
          idle: pool.idleCount,
          waiting: pool.waitingCount
        }
      }
    };
    
  } catch (error) {
    return {
      healthy: false,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    };
  } finally {
    client.release();
  }
}