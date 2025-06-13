-- Enable UUID extension for better ID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create ENUM types for better data consistency
CREATE TYPE task_status AS ENUM ('To Do', 'In Progress', 'In Review', 'Completed', 'Cancelled');
CREATE TYPE task_priority AS ENUM ('Low', 'Medium', 'High', 'Critical');

-- Main tasks table with improved structure
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL CHECK (length(trim(title)) > 0),
    description TEXT,
    status task_status NOT NULL DEFAULT 'To Do',
    deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    priority task_priority NOT NULL DEFAULT 'Medium',
    assigned_user_id VARCHAR(255),
    assignee_name VARCHAR(255),
    assigner_id VARCHAR(255) NOT NULL CHECK (length(trim(assigner_id)) > 0),
    assigner_name VARCHAR(255) NOT NULL CHECK (length(trim(assigner_name)) > 0),
    timer_duration INTEGER DEFAULT 0 CHECK (timer_duration >= 0),
    suggested_deadline TIMESTAMP WITH TIME ZONE,
    suggested_priority task_priority,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- Add constraints
    CONSTRAINT deadline_in_future CHECK (deadline > created_at),
    CONSTRAINT suggested_deadline_valid CHECK (
        suggested_deadline IS NULL OR suggested_deadline > created_at
    )
);

-- Task attachments with better file handling
CREATE TABLE IF NOT EXISTS task_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL CHECK (length(trim(file_name)) > 0),
    file_type VARCHAR(100) NOT NULL CHECK (length(trim(file_type)) > 0),
    file_size INTEGER NOT NULL CHECK (file_size > 0 AND file_size <= 104857600), -- 100MB limit
    file_path TEXT, -- For actual file storage path
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Task comments with better structure
CREATE TABLE IF NOT EXISTS task_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL CHECK (length(trim(user_id)) > 0),
    user_name VARCHAR(255) NOT NULL CHECK (length(trim(user_name)) > 0),
    content TEXT NOT NULL CHECK (length(trim(content)) > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_user_id ON tasks(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigner_id ON tasks(assigner_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_created_at ON task_comments(created_at DESC);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_task_comments_updated_at BEFORE UPDATE ON task_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();