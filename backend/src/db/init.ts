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

export async function initializeDatabase(): Promise<void> {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Initializing database...');
    
    // Check if database connection is working
    await client.query('SELECT NOW()');
    console.log('✅ Database connection established');

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
      // Split schema by semicolon and execute each statement
      const statements = schema
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);

      for (const statement of statements) {
        if (statement.trim()) {
          await client.query(statement);
        }
      }
      
      await client.query('COMMIT');
      console.log('✅ Database schema initialized successfully');
      
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
    const requiredTables = ['tasks', 'task_attachments', 'task_comments'];
    
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
    const enumTypes = ['task_status', 'task_priority'];
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
    
    // Verify indexes
    const criticalIndexes = [
      'idx_tasks_status',
      'idx_tasks_deadline',
      'idx_tasks_created_at'
    ];
    
    for (const indexName of criticalIndexes) {
      const result = await client.query(
        `SELECT EXISTS (
          SELECT FROM pg_indexes 
          WHERE schemaname = 'public' 
          AND indexname = $1
        )`,
        [indexName]
      );
      
      if (!result.rows[0].exists) {
        console.warn(`⚠️  Index '${indexName}' was not created`);
      }
    }
    
    console.log('✅ Database verification completed');
    
  } catch (error) {
    throw new DatabaseInitError('Failed to verify database tables', error instanceof Error ? error : undefined);
  }
}

export async function resetDatabase(): Promise<void> {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Resetting database...');
    
    await client.query('BEGIN');
    
    // Drop tables in reverse order due to foreign key constraints
    const dropQueries = [
      'DROP TABLE IF EXISTS task_comments CASCADE',
      'DROP TABLE IF EXISTS task_attachments CASCADE', 
      'DROP TABLE IF EXISTS tasks CASCADE',
      'DROP TYPE IF EXISTS task_status CASCADE',
      'DROP TYPE IF EXISTS task_priority CASCADE',
      'DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE'
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
      tables: false,
      indexes: false,
      constraints: false
    };
    
    // Test connection
    await client.query('SELECT 1');
    healthChecks.connection = true;
    
    // Check tables exist
    const tableResult = await client.query(`
      SELECT count(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('tasks', 'task_attachments', 'task_comments')
    `);
    healthChecks.tables = parseInt(tableResult.rows[0].count) === 3;
    
    // Check indexes exist
    const indexResult = await client.query(`
      SELECT count(*) as count 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND indexname LIKE 'idx_%'
    `);
    healthChecks.indexes = parseInt(indexResult.rows[0].count) > 0;
    
    // Check foreign key constraints
    const constraintResult = await client.query(`
      SELECT count(*) as count 
      FROM information_schema.table_constraints 
      WHERE constraint_schema = 'public' 
      AND constraint_type = 'FOREIGN KEY'
    `);
    healthChecks.constraints = parseInt(constraintResult.rows[0].count) >= 2;
    
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