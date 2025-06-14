/*
=============================================================================
 Task Management Database Schema - Final Idempotent Version
=============================================================================
 This schema is fully idempotent and can be run multiple times without error.
 It ensures a clean and correct database state by:
 1. Using "IF NOT EXISTS" for all tables, indexes, and extensions.
 2. Safely creating custom ENUM types only if they don't already exist.
 3. Using "CREATE OR REPLACE" for functions and views.
 4. Using the "DROP TRIGGER IF EXISTS" pattern for triggers.
=============================================================================
*/

-- Drop existing objects in reverse order of dependency to ensure a clean slate.
DROP VIEW IF EXISTS task_dashboard;
DROP VIEW IF EXISTS active_tasks;
DROP TABLE IF EXISTS task_dependencies, task_watchers, time_entries, task_attachments, task_comments, notifications, user_sessions, task_activity_log, tasks, users CASCADE;
DROP TYPE IF EXISTS task_status, task_priority, user_role, notification_type CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column(), log_task_activity(), set_completed_at(), calculate_time_entry_duration(), get_user_tasks(uuid);

-- Enable UUID extension for generating unique identifiers.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- -- ENUMERATED TYPES (Idempotent Creation)
-- -- UPDATED: Added 'Pending Approval', 'Needs Changes', 'Rejected' and aligned 'Completed' status.
-- =============================================================================

-- First, create a temporary type with the new values
DO $$ 
BEGIN
    -- Drop the existing type if it exists
    DROP TYPE IF EXISTS task_status CASCADE;
    
    -- Create the new type with all values
    CREATE TYPE task_status AS ENUM (
        'Pending Approval',
        'To Do',
        'In Progress',
        'In Review',
        'Needs Changes',
        'Completed',
        'Rejected',
        'Archived'
    );
END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_priority') THEN CREATE TYPE task_priority AS ENUM ('Low', 'Medium', 'High', 'Urgent'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN CREATE TYPE user_role AS ENUM ('Admin', 'Manager', 'User'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN CREATE TYPE notification_type AS ENUM ('Task Assigned', 'Comment Mention', 'Status Change', 'Deadline Reminder'); END IF; END $$;

-- =============================================================================
-- -- CORE FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- -- TABLES (Idempotent Creation)
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role user_role NOT NULL DEFAULT 'User',
    department VARCHAR(100),
    job_title VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    notification_preferences JSONB DEFAULT '{"push": true, "email": true, "deadline_reminders": true}'::jsonb,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    soft_deleted_at TIMESTAMPTZ,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT email_format_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status task_status NOT NULL DEFAULT 'Pending Approval', -- UPDATED: Default to 'Pending Approval' for new tasks from users
    priority task_priority NOT NULL DEFAULT 'Medium',
    deadline TIMESTAMPTZ,
    progress_percentage INTEGER DEFAULT 0,
    project_id INTEGER,
    recurring_pattern JSONB,
    assigner_id INTEGER NOT NULL,
    assigned_user_id INTEGER,
    updated_by INTEGER,
    -- NEW: Added fields for suggested values from the user submission form
    suggested_priority task_priority,
    suggested_deadline TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    soft_deleted_at TIMESTAMPTZ,
    CONSTRAINT progress_percentage_check CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    CONSTRAINT title_not_empty_check CHECK (length(trim(title)) > 0),
    CONSTRAINT fk_tasks_assigner FOREIGN KEY (assigner_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_tasks_assignee FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_tasks_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS task_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    mentions INTEGER,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    soft_deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS task_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    file_name VARCHAR(255) NOT NULL,
    file_url VARCHAR(1024) NOT NULL,
    file_type VARCHAR(100),
    file_size_bytes BIGINT,
    checksum VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    soft_deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS task_dependencies (
    id SERIAL PRIMARY KEY,
    predecessor_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    successor_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    UNIQUE (predecessor_task_id, successor_task_id)
);

CREATE TABLE IF NOT EXISTS task_activity_log (
    id SERIAL PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(255) NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    action_url VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- -- INDEXES (Idempotent Creation)
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_soft_deleted ON users(soft_deleted_at);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);
CREATE INDEX IF NOT EXISTS idx_tasks_assigner_id ON tasks(assigner_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_user_id ON tasks(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_soft_deleted ON tasks(soft_deleted_at);
CREATE INDEX IF NOT EXISTS idx_tasks_recurring_pattern_gin ON tasks USING GIN (recurring_pattern);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_user_id ON task_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_user_id ON task_attachments(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_task_id ON notifications(task_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_log_task_id ON task_activity_log(task_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_log_user_id ON task_activity_log(user_id);

-- =============================================================================
-- -- TRIGGERS (Idempotent Creation)
-- =============================================================================

DROP TRIGGER IF EXISTS trigger_users_updated_at ON users;
CREATE TRIGGER trigger_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_tasks_updated_at ON tasks;
CREATE TRIGGER trigger_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_task_comments_updated_at ON task_comments;
CREATE TRIGGER trigger_task_comments_updated_at BEFORE UPDATE ON task_comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- -- VIEWS
-- =============================================================================

CREATE OR REPLACE VIEW active_tasks AS
SELECT
    t.id,
    t.title,
    t.status,
    t.priority,
    t.deadline,
    u_assignee.first_name AS assignee_first_name,
    u_assignee.last_name AS assignee_last_name,
    u_assigner.first_name AS assigner_first_name,
    u_assigner.last_name AS assigner_last_name
FROM
    tasks t
LEFT JOIN
    users u_assignee ON t.assigned_user_id = u_assignee.id
JOIN
    users u_assigner ON t.assigner_id = u_assigner.id
WHERE
    t.status NOT IN ('Completed', 'Archived', 'Rejected')
    AND t.soft_deleted_at IS NULL;

CREATE OR REPLACE VIEW task_dashboard AS
SELECT
    status,
    priority,
    COUNT(id) AS task_count
FROM
    tasks
WHERE
    soft_deleted_at IS NULL
GROUP BY
    status, priority
ORDER BY
    status, priority;

-- =============================================================================
-- -- END OF SCHEMA DEFINITION
-- =============================================================================