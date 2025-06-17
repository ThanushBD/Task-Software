// routes/auth.ts
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { User, UserRole } from '../types';
import { pool } from '../config/db';
import { ValidationError } from '../utils/validationError';

const router = express.Router();

// JWT secret (use environment variable in production)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Add type for authenticated request
interface AuthenticatedRequest extends express.Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
  };
}

// Middleware to verify JWT token
const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  // Also check for token in cookies
  const cookieToken = req.cookies?.token;
  const finalToken = token || cookieToken;

  console.log('Backend: authenticateToken - Received cookieToken:', cookieToken);
  console.log('Backend: authenticateToken - Final token:', finalToken);

  if (!finalToken) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(finalToken, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      console.error('Backend: authenticateToken - JWT verification failed:', err);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    (req as AuthenticatedRequest).user = user;
    next();
  });
};

// POST /api/auth/register
router.post('/register', async (req: express.Request, res: express.Response) => {
  const client = await pool.connect();
  try {
    const { email, password, firstName, lastName, role = 'User' } = req.body;

    // Validate required fields
    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    // Validate email format
    if (!email.match(/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/)) {
      throw new ValidationError('Invalid email format');
    }

    // Validate password strength
    if (password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
    }

    // Check if user already exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1 AND soft_deleted_at IS NULL',
      [email]
    );

    if (existingUser.rows.length > 0) {
      throw new ValidationError('Email already registered');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Convert role to proper case
    const normalizedRole = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
    if (!['Admin', 'User'].includes(normalizedRole)) {
      throw new ValidationError('Invalid role. Must be one of: Admin, User');
    }

    // Create user with UUID
    const userId = uuidv4();
    const result = await client.query(
      `INSERT INTO users (
        id, email, password_hash, first_name, last_name, role,
        is_active, email_verified, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, email, first_name, last_name, role`,
      [userId, email, hashedPassword, firstName, lastName, normalizedRole]
    );

    const user = result.rows[0];

    // Generate JWT token with UUID
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role
        },
        token
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error instanceof ValidationError) {
      res.status(400).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Failed to register user' });
    }
  } finally {
    client.release();
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const client = await pool.connect();
  try {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user
    const result = await client.query(
      'SELECT id, email, password_hash, first_name, last_name, role FROM users WHERE email = $1',
      [email]
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password if provided
    if (password && user.password_hash) {
      const passwordMatch = await bcrypt.compare(password, user.password_hash);
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Set httpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    // Return user without password
    const { password_hash, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword, token });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
  res.json({ message: 'Logged out successfully' });
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: express.Response) => {
  const client = await pool.connect();
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const result = await client.query(
      `SELECT id, email, first_name, last_name, role, is_active, email_verified
       FROM users
       WHERE id = $1 AND soft_deleted_at IS NULL`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        isActive: user.is_active,
        emailVerified: user.email_verified
      }
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user data' });
  } finally {
    client.release();
  }
});

// GET /api/users
router.get('/users', authenticateToken, async (req: express.Request, res: express.Response) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT id, email, first_name, last_name, role FROM users'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

export default router;