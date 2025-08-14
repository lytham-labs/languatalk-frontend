import React, { useState } from 'react';
import { useAuth } from '@languatalk-frontend/data-access-auth';
import { railsJWTAuth } from '../adapters/WebAuthAdapters';

export const AuthDemo: React.FC = () => {
  const { isAuthenticated, isLoading, user, login, logout } = useAuth();
  const [email, setEmail] = useState('test@example.com');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoginError(null);
    try {
      await login(email, password);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Login failed');
    }
  };

  const handleTestToken = () => {
    // For testing: simulate a Rails login by setting token directly
    const testToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.test-token';
    const testUser = {
      id: 1,
      uuid: 'test-uuid-123',
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      onboarding_completed: true
    };
    
    railsJWTAuth.storeAuthData(testToken, testUser);
    window.location.reload(); // Reload to trigger AuthProvider initialization
  };

  if (isLoading) {
    return (
      <div className="p-4 border border-gray-300 rounded-lg">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          <p>Loading authentication state...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 border border-gray-300 rounded-lg">
      <h3 className="text-lg font-bold mb-4">Rails JWT Authentication</h3>
      
      <div className="mb-4">
        <p className="text-lg">
          <strong>Status:</strong> {isAuthenticated ? '🟢 Authenticated' : '🔴 Not Authenticated'}
        </p>
        
        {user && (
          <div className="mt-3 p-3 bg-green-50 rounded border">
            <p><strong>User ID:</strong> {user.id}</p>
            <p><strong>UUID:</strong> {user.uuid}</p>
            <p><strong>Email:</strong> {user.email}</p>
            {user.first_name && (
              <p><strong>Name:</strong> {user.first_name} {user.last_name}</p>
            )}
            <p><strong>Onboarding:</strong> {user.onboarding_completed ? 'Completed' : 'Pending'}</p>
          </div>
        )}

        {loginError && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-red-700">
            <strong>Error:</strong> {loginError}
          </div>
        )}
      </div>

      {!isAuthenticated ? (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Login with Rails API</h4>
            <div className="space-y-2">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your password"
                />
              </div>
              <button 
                onClick={handleLogin}
                disabled={isLoading || !email || !password}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Logging in...' : 'Login via Rails API'}
              </button>
            </div>
          </div>
          
          <div className="border-t pt-4">
            <h4 className="font-semibold mb-2">Test Integration</h4>
            <button 
              onClick={handleTestToken}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Simulate Rails Login
            </button>
            <p className="text-xs text-gray-600 mt-1">
              This simulates a user logging in through Rails and sets the JWT token
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded">
            <h4 className="font-semibold text-blue-800">JWT Integration Active</h4>
            <p className="text-sm text-blue-700 mt-1">
              This user session is now shared between Rails and React. 
              The JWT token is stored in localStorage and can be accessed by both systems.
            </p>
          </div>
          
          <button 
            onClick={logout}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            disabled={isLoading}
          >
            {isLoading ? 'Logging out...' : 'Logout'}
          </button>
        </div>
      )}
      
      <div className="mt-4 pt-4 border-t">
        <details className="text-sm">
          <summary className="font-medium cursor-pointer">Integration Details</summary>
          <div className="mt-2 text-gray-600 space-y-1">
            <p>• JWT tokens are stored in localStorage with key: <code>languatalk_auth_token</code></p>
            <p>• User data is stored with key: <code>languatalk_auth_user</code></p>
            <p>• Authentication state is synchronized between Rails routes and React app</p>
            <p>• API endpoints: <code>/api/v1/auth/login</code>, <code>/api/v1/auth/validate</code>, <code>/api/v1/auth/session</code></p>
          </div>
        </details>
      </div>
    </div>
  );
};