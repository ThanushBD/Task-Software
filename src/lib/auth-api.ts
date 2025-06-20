import type { User, UserRole } from '@/types';

// API Base URL - adjust this to match your server
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

// API functions for user management
export const userAPI = {
  // Get all users
  async getAllUsers(tokenOrCookie?: string): Promise<User[]> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Only use localStorage if in the browser
    let token: string | null = null;
    if (typeof window !== 'undefined') {
      token = localStorage.getItem('token');
    } else if (tokenOrCookie) {
      // On the server, accept token or cookieHeader
      if (tokenOrCookie.startsWith('Bearer ')) {
        headers['Authorization'] = tokenOrCookie;
      } else {
        headers['Cookie'] = tokenOrCookie;
      }
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    console.debug('[getAllUsers] headers:', headers);

    const response = await fetch(`${API_BASE_URL}/auth/users`, {
      method: 'GET',
      headers: headers,
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch users: ${response.statusText}`);
    }
    const users = await response.json();
    return users.map((user: any) => ({
      ...user,
      firstName: user.first_name,
      lastName: user.last_name,
    }));
  },

  // Helper to get token from localStorage (browser only)
  getToken() {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      console.debug('[auth-api] getToken:', token);
      return token;
    }
    return null;
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
    
    const result = await response.json();
    console.log('Login result:', result);
    if (result.token) {
      localStorage.setItem('token', result.token);
      console.debug('[auth-api] Stored token after login:', result.token);
    }
    return result;
  },

  // Register new user
  async registerUser(name: string, email: string, role: UserRole, password?: string): Promise<{ success: boolean; user?: User; error?: string; token?: string }> {
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
    
    if (response.ok) {
      const result = await response.json();
      console.log('Register result:', result);
      const token = result.token || result.data?.token;
      if (token) {
        localStorage.setItem('token', token);
        console.debug('[auth-api] Stored token after register:', token);
      }
      return { success: true, user: result.data?.user, token };
    } else {
      let errorMsg = 'Registration failed';
      try {
        const errorData = await response.json();
        errorMsg = errorData.error || errorMsg;
      } catch {}
      return { success: false, error: errorMsg };
    }
  },

  // Update user profile - ADDED MISSING METHOD
  async updateProfile(userId: string, updates: Partial<User>): Promise<User> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${API_BASE_URL}/auth/users/${userId}`, {
      method: 'PUT',
      headers: headers,
      credentials: 'include',
      body: JSON.stringify(updates),
    });
    
    if (!response.ok) {
      throw new Error(`Profile update failed: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Logout user
  async logoutUser(): Promise<void> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: headers,
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`Logout failed: ${response.statusText}`);
    }
  },

  // Verify current session (browser or server)
  async verifySession(token?: string): Promise<User | null> {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      // Use provided token (server) or get from localStorage (browser)
      let jwt: string | undefined = token;
      if (!jwt) {
        const t = this.getToken();
        jwt = t === null ? undefined : t;
      }
      if (jwt) {
        headers['Authorization'] = `Bearer ${jwt}`;
      }
      console.debug('[auth-api] verifySession headers:', headers);

      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'GET',
        headers: headers,
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
  },

  // Verify email code
  async verifyEmailCode(email: string, code: string): Promise<{ success: boolean }> {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      const token = this.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
        method: 'POST',
        headers: headers,
        credentials: 'include',
        body: JSON.stringify({ email, code }),
      });

      if (!response.ok) {
        throw new Error(`Failed to verify email code: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error verifying email code:', error);
      throw error;
    }
  },

  // Send verification email
  async sendVerificationEmail(email: string): Promise<void> {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      const token = this.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(`${API_BASE_URL}/auth/send-verification-email`, {
        method: 'POST',
        headers: headers,
        credentials: 'include',
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        throw new Error(`Failed to send verification email: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error sending verification email:', error);
      throw error;
    }
  },

  // Resend verification email (for backward compatibility)
  async resendVerificationEmail(email: string): Promise<void> {
    return this.sendVerificationEmail(email);
  },
};