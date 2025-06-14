// db/init.ts
import { Pool, PoolClient } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
});

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
async function checkDatabaseObjects(client: PoolClient): Promise<{
  enumTypes: string[];
  tables: string[];
  functions: string[];
  indexes: string[];
}> {
  const [enumResult, tableResult, functionResult, indexResult] = await Promise.all([
    // Check ENUM types
    client.query(`
      SELECT typname 
      FROM pg_type 
      WHERE typname IN ('task_status', 'task_priority', 'user_role', 'notification_type')
    `),
    
    // Check tables
    client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'tasks', 'task_attachments', 'task_comments', 'task_dependencies', 'task_activity_log', 'notifications', 'user_sessions')
    `),
    
    // Check functions
    client.query(`
      SELECT proname 
      FROM pg_proc 
      WHERE proname IN ('update_updated_at_column')
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
  
  if (!trimmedStatement || (trimmedStatement.startsWith('--') && !trimmedStatement.includes('CREATE'))) {
    return statement;
  }
  
  let actualStatement = trimmedStatement;
  const lines = trimmedStatement.split('\n');
  let sqlStartIndex = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line && !line.startsWith('--')) {
      sqlStartIndex = i;
      break;
    }
  }
  
  const sqlPart = lines.slice(sqlStartIndex).join('\n').trim();
  const upperStatement = sqlPart.toUpperCase();
  
  console.log(`🔍 Processing statement type: ${upperStatement.split(' ').slice(0, 3).join(' ')}`);
  
  if (upperStatement.startsWith('CREATE TYPE')) {
    const typeMatch = sqlPart.match(/CREATE TYPE\s+([^\s]+)/i);
    if (typeMatch) {
      const typeName = typeMatch[1];
      if (existingObjects.enumTypes.includes(typeName)) {
        console.log(`⚠️  ENUM type '${typeName}' already exists, skipping...`);
        return '-- SKIPPED: ' + statement;
      }
    }
  }
  
  if (upperStatement.startsWith('CREATE TABLE')) {
    const tableMatch = sqlPart.match(/CREATE TABLE\s+([^\s\(]+)/i);
    if (tableMatch) {
      const tableName = tableMatch[1];
      if (existingObjects.tables.includes(tableName)) {
        console.log(`⚠️  Table '${tableName}' already exists, skipping...`);
        return '-- SKIPPED: ' + statement;
      }
    }
  }
  
  if (upperStatement.startsWith('CREATE FUNCTION') || upperStatement.startsWith('CREATE OR REPLACE FUNCTION')) {
    const functionMatch = sqlPart.match(/CREATE(?:\s+OR\s+REPLACE)?\s+FUNCTION\s+([^\s\(]+)/i);
    if (functionMatch) {
      const functionName = functionMatch[1];
      if (existingObjects.functions.includes(functionName) && !upperStatement.includes('OR REPLACE')) {
        console.log(`⚠️  Function '${functionName}' already exists, using CREATE OR REPLACE...`);
        return statement.replace(/CREATE\s+FUNCTION/i, 'CREATE OR REPLACE FUNCTION');
      }
    }
  }
  
  if (upperStatement.startsWith('CREATE INDEX') || upperStatement.startsWith('CREATE UNIQUE INDEX')) {
    const indexMatch = sqlPart.match(/CREATE(?:\s+UNIQUE)?\s+INDEX(?:\s+IF\s+NOT\s+EXISTS)?\s+([^\s]+)/i);
    if (indexMatch) {
      const indexName = indexMatch[1];
      if (existingObjects.indexes.includes(indexName)) {
        console.log(`⚠️  Index '${indexName}' already exists, skipping...`);
        return '-- SKIPPED: ' + statement;
      }
    }
  }

  if (upperStatement.startsWith('CREATE VIEW') || upperStatement.startsWith('CREATE OR REPLACE VIEW')) {
    const viewMatch = sqlPart.match(/CREATE(?:\s+OR\s+REPLACE)?\s+VIEW\s+([^\s]+)/i);
    if (viewMatch) {
      const viewName = viewMatch[1];
      console.log(`🔍 Processing view '${viewName}', using CREATE OR REPLACE...`);
      return statement.replace(/CREATE\s+VIEW/i, 'CREATE OR REPLACE VIEW');
    }
  }
  
  return statement;
}

export async function initializeDatabase(): Promise<void> {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Initializing database...');
    
    await client.query('SELECT NOW()');
    console.log('✅ Database connection established');

    const existingObjects = await checkDatabaseObjects(client);
    console.log('📋 Existing database objects:', {
      enumTypes: existingObjects.enumTypes.length,
      tables: existingObjects.tables.length,
      functions: existingObjects.functions.length,
      indexes: existingObjects.indexes.length
    });

    const schemaPath = path.join(__dirname, 'schema.sql');
    
    if (!fs.existsSync(schemaPath)) {
      throw new DatabaseInitError(`Schema file not found at: ${schemaPath}`);
    }

    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    if (!schema.trim()) {
      throw new DatabaseInitError('Schema file is empty');
    }

    await client.query('BEGIN');
    
    try {
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
            if (statement.trim().startsWith('-- SKIPPED:')) {
              skippedCount++;
              console.log(`⏭️  Statement ${i + 1}/${processedStatements.length} skipped (already exists)`);
            } else {
              console.log(`🔍 Executing statement ${i + 1}: ${statement.trim().substring(0, 150)}...`);
              await client.query(statement);
              executedCount++;
              console.log(`✅ Statement ${i + 1}/${processedStatements.length} executed successfully`);
            }
          } catch (error) {
            console.error(`❌ Error in statement ${i + 1}:`, statement.substring(0, 100) + '...');
            console.error('Error details:', error);
            throw error;
          }
        }
      }
      
      await client.query('COMMIT');
      console.log(`✅ Database schema initialized successfully (${executedCount} executed, ${skippedCount} skipped)`);
      
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

async function verifyTables(client: PoolClient): Promise<void> {
  try {
    const requiredTables = ['users', 'tasks', 'task_attachments', 'task_comments', 'task_dependencies', 'task_activity_log', 'notifications', 'user_sessions']; //
    
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
    
    const enumTypes = ['task_status', 'task_priority', 'user_role', 'notification_type']; //
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
    
  } catch (error) {
    throw new DatabaseInitError('Failed to verify database tables', error instanceof Error ? error : undefined);
  }
}

export async function resetDatabase(): Promise<void> {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Resetting database...');
    
    await client.query('BEGIN');
    
    const dropQueries = [
      'DROP VIEW IF EXISTS task_dashboard CASCADE', //
      'DROP VIEW IF EXISTS active_tasks CASCADE', //
      'DROP TABLE IF EXISTS user_sessions CASCADE', //
      'DROP TABLE IF EXISTS notifications CASCADE', //
      'DROP TABLE IF EXISTS task_activity_log CASCADE', //
      'DROP TABLE IF EXISTS task_dependencies CASCADE', //
      'DROP TABLE IF EXISTS task_comments CASCADE', //
      'DROP TABLE IF EXISTS task_attachments CASCADE',  //
      'DROP TABLE IF EXISTS tasks CASCADE', //
      'DROP TABLE IF EXISTS users CASCADE', //
      'DROP TYPE IF EXISTS task_status CASCADE', //
      'DROP TYPE IF EXISTS task_priority CASCADE', //
      'DROP TYPE IF EXISTS user_role CASCADE', //
      'DROP TYPE IF EXISTS notification_type CASCADE', //
      'DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE', //
    ];
    
    for (const query of dropQueries) {
      await client.query(query);
    }
    
    await client.query('COMMIT');
    console.log('✅ Database reset completed');
    
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
      enumTypes: false,
      tables: false,
      functions: false,
      indexes: false,
      constraints: false,
      views: false
    };
    
    await client.query('SELECT 1');
    healthChecks.connection = true;

    const enumResult = await client.query(`
      SELECT count(*) as count 
      FROM pg_type 
      WHERE typname IN ('task_status', 'task_priority', 'user_role', 'notification_type')
    `); //
    healthChecks.enumTypes = parseInt(enumResult.rows[0].count) === 4; //

    const tableResult = await client.query(`
      SELECT count(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'tasks', 'task_attachments', 'task_comments', 'task_dependencies', 'task_activity_log', 'notifications', 'user_sessions')
    `); //
    healthChecks.tables = parseInt(tableResult.rows[0].count) === 8; //
    
    const functionResult = await client.query(`
      SELECT count(*) as count 
      FROM pg_proc 
      WHERE proname IN ('update_updated_at_column')
    `); //
    healthChecks.functions = parseInt(functionResult.rows[0].count) === 1; //

    const indexResult = await client.query(`
      SELECT count(*) as count 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND indexname LIKE 'idx_%'
    `); //
    healthChecks.indexes = parseInt(indexResult.rows[0].count) > 0;
    
    const constraintResult = await client.query(`
      SELECT count(*) as count 
      FROM information_schema.table_constraints 
      WHERE constraint_schema = 'public' 
      AND constraint_type = 'FOREIGN KEY'
    `); //
    healthChecks.constraints = parseInt(constraintResult.rows[0].count) >= 8;

    const viewResult = await client.query(`
      SELECT count(*) as count
      FROM information_schema.views
      WHERE table_schema = 'public'
      AND table_name IN ('active_tasks', 'task_dashboard')
    `); //
    healthChecks.views = parseInt(viewResult.rows[0].count) === 2; //

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