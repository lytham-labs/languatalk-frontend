// Rails JWT Authentication Integration
// This handles JWT tokens shared between Rails routes and React app

export interface RailsAuthResponse {
  token: string;
  user: {
    id: number;
    uuid: string;
    email: string;
    first_name?: string;
    last_name?: string;
    onboarding_completed: boolean;
  };
}

export class RailsJWTAuth {
  private apiUrl: string;
  private tokenKey = 'languatalk_auth_token';
  private userKey = 'languatalk_auth_user';

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }

  // Get existing token from localStorage (set by Rails or React)
  getStoredToken(): string | null {
    const token = localStorage.getItem(this.tokenKey);
    console.log('RailsJWTAuth: Getting stored token:', token ? 'Found' : 'Not found');
    return token;
  }

  // Get existing user from localStorage
  getStoredUser(): RailsAuthResponse['user'] | null {
    const userStr = localStorage.getItem(this.userKey);
    if (!userStr) {
      console.log('RailsJWTAuth: No stored user found');
      return null;
    }
    
    try {
      const user = JSON.parse(userStr);
      console.log('RailsJWTAuth: Retrieved stored user:', user);
      return user;
    } catch {
      console.log('RailsJWTAuth: Failed to parse stored user');
      return null;
    }
  }

  // Store auth data (called by both Rails and React)
  storeAuthData(token: string, user: RailsAuthResponse['user']): void {
    localStorage.setItem(this.tokenKey, token);
    localStorage.setItem(this.userKey, JSON.stringify(user));
    
    // Dispatch custom event so other parts of the app can react to auth changes
    window.dispatchEvent(new CustomEvent('auth-state-changed', {
      detail: { token, user, isAuthenticated: true }
    }));
  }

  // Clear auth data (logout)
  clearAuthData(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    
    window.dispatchEvent(new CustomEvent('auth-state-changed', {
      detail: { token: null, user: null, isAuthenticated: false }
    }));
  }

  // Validate token with Rails API
  async validateToken(token: string): Promise<RailsAuthResponse['user'] | null> {
    try {
      const response = await fetch(`${this.apiUrl}/api/v1/auth/validate`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const userData = await response.json();
        return userData;
      } else if (response.status === 401) {
        // Token is invalid, clear it
        this.clearAuthData();
        return null;
      }
    } catch (error) {
      console.error('Token validation failed:', error);
    }
    
    return null;
  }

  // Login via Rails API
  async login(email: string, password: string): Promise<RailsAuthResponse> {
    const response = await fetch(`${this.apiUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        password
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Login failed: ${response.statusText}`);
    }

    const authData: RailsAuthResponse = await response.json();
    
    // Store the auth data
    this.storeAuthData(authData.token, authData.user);
    
    return authData;
  }

  // Logout via Rails API
  async logout(): Promise<void> {
    const token = this.getStoredToken();
    
    if (token) {
      try {
        await fetch(`${this.apiUrl}/api/v1/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      } catch (error) {
        console.error('Logout API call failed:', error);
      }
    }
    
    // Always clear local data regardless of API call success
    this.clearAuthData();
  }

  // Create authenticated request helper
  async createAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {
    const token = this.getStoredToken();
    
    if (!token) {
      throw new Error('No authentication token available');
    }

    const authHeaders = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    };

    const response = await fetch(url, {
      ...options,
      headers: authHeaders
    });

    // If token is expired, clear auth data and throw error
    if (response.status === 401) {
      this.clearAuthData();
      throw new Error('Authentication expired');
    }

    return response;
  }

  // Check if Rails session exists and sync to localStorage
  // This method can be called when navigating from Rails to React routes
  async syncFromRailsSession(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/api/v1/auth/session`, {
        method: 'GET',
        credentials: 'include', // Include Rails session cookies
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const authData: RailsAuthResponse = await response.json();
        this.storeAuthData(authData.token, authData.user);
        return true;
      }
    } catch (error) {
      console.error('Rails session sync failed:', error);
    }
    
    return false;
  }
}

// Global instance for use across the app
export const railsJWTAuth = new RailsJWTAuth(
  process.env.REACT_APP_API_URL || 'http://localhost:3000'
);