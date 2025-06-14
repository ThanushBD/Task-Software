import type { User, UserRole } from '@/types';

// API Base URL - adjust this to match your server
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

// API functions for user management
export const userAPI = {
  // Get all users
  async getAllUsers(cookieHeader?: string): Promise<User[]> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    const response = await fetch(`${API_BASE_URL}/auth/users`, {
      method: 'GET',
      headers: headers,
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch users: ${response.statusText}`);
    }
    
    const users = await response.json();
    // Transform snake_case to camelCase for firstName and lastName
    return users.map((user: any) => ({
      ...user,
      firstName: user.first_name,
      lastName: user.last_name,
    }));
  },

  // Login user
  async loginUser(email: string, password?: string): Promise<{ user: User; token?: string }> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    
    if (!response.ok) {
      throw new Error(`Login failed: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Register new user
  async registerUser(name: string, email: string, role: UserRole, password?: string): Promise<{ user: User; token?: string }> {
    // Split name into firstName and lastName
    const nameParts = name.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || firstName; // Use firstName as lastName if only one word

    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ firstName, lastName, email, role, password }),
    });
    
    if (!response.ok) {
      throw new Error(`Registration failed: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Logout user
  async logoutUser(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`Logout failed: ${response.statusText}`);
    }
  },

  // Verify current session
  async verifySession(cookieHeader?: string): Promise<User | null> {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (cookieHeader) {
        headers['Cookie'] = cookieHeader;
      }

      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'GET',
        headers: headers,
        credentials: 'include',
      });
      
      if (!response.ok) {
        return null;
      }
      
      const data = await response.json();
      return data.data; // Access the nested user object
    } catch (error) {
      console.error('Session verification failed:', error);
      return null;
    }
  }
}; 