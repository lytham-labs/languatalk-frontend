# Rails JWT Authentication Integration

This document shows how to integrate JWT authentication between your Rails app and the React speak app.

## Rails API Endpoints Required

Add these endpoints to your Rails application:

### 1. Login API Endpoint

```ruby
# app/controllers/api/v1/auth_controller.rb
class Api::V1::AuthController < ApplicationController
  skip_before_action :verify_authenticity_token
  
  def login
    user = User.find_by(email: params[:email])
    
    if user&.authenticate(params[:password])
      # Generate JWT token
      token = generate_jwt_token(user)
      
      render json: {
        token: token,
        user: {
          id: user.id,
          uuid: user.uuid,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          onboarding_completed: user.onboarding_completed || false
        }
      }
    else
      render json: { 
        message: 'Invalid email or password' 
      }, status: :unauthorized
    end
  end
  
  def logout
    # Add token to blacklist if needed
    # TokenBlacklist.create(token: extract_token_from_header)
    
    render json: { message: 'Logged out successfully' }
  end
  
  def validate
    # Validate the JWT token
    current_user = authenticate_with_jwt
    
    if current_user
      render json: {
        id: current_user.id,
        uuid: current_user.uuid,
        email: current_user.email,
        first_name: current_user.first_name,
        last_name: current_user.last_name,
        onboarding_completed: current_user.onboarding_completed || false
      }
    else
      render json: { message: 'Invalid token' }, status: :unauthorized
    end
  end
  
  def session
    # Sync Rails session to JWT (when navigating from Rails to React)
    if user_signed_in?
      token = generate_jwt_token(current_user)
      
      render json: {
        token: token,
        user: {
          id: current_user.id,
          uuid: current_user.uuid,
          email: current_user.email,
          first_name: current_user.first_name,
          last_name: current_user.last_name,
          onboarding_completed: current_user.onboarding_completed || false
        }
      }
    else
      render json: { message: 'Not authenticated' }, status: :unauthorized
    end
  end
  
  private
  
  def generate_jwt_token(user)
    payload = {
      user_id: user.id,
      uuid: user.uuid,
      exp: 24.hours.from_now.to_i # Token expires in 24 hours
    }
    
    JWT.encode(payload, Rails.application.secret_key_base)
  end
  
  def authenticate_with_jwt
    token = extract_token_from_header
    return nil unless token
    
    begin
      decoded = JWT.decode(token, Rails.application.secret_key_base)[0]
      User.find_by(id: decoded['user_id'], uuid: decoded['uuid'])
    rescue JWT::DecodeError, JWT::ExpiredSignature
      nil
    end
  end
  
  def extract_token_from_header
    auth_header = request.headers['Authorization']
    auth_header&.split(' ')&.last
  end
end
```

### 2. Routes Configuration

```ruby
# config/routes.rb
Rails.application.routes.draw do
  namespace :api do
    namespace :v1 do
      namespace :auth do
        post :login
        post :logout
        get :validate
        get :session
      end
    end
  end
  
  # Your existing routes...
end
```

### 3. JWT Helper for Other Controllers

```ruby
# app/controllers/concerns/jwt_authenticatable.rb
module JwtAuthenticatable
  extend ActiveSupport::Concern
  
  def authenticate_with_jwt!
    current_user = authenticate_with_jwt
    
    unless current_user
      render json: { error: 'Unauthorized' }, status: :unauthorized
    end
    
    current_user
  end
  
  def authenticate_with_jwt
    token = extract_token_from_header
    return nil unless token
    
    begin
      decoded = JWT.decode(token, Rails.application.secret_key_base)[0]
      User.find_by(id: decoded['user_id'], uuid: decoded['uuid'])
    rescue JWT::DecodeError, JWT::ExpiredSignature
      nil
    end
  end
  
  private
  
  def extract_token_from_header
    auth_header = request.headers['Authorization']
    auth_header&.split(' ')&.last
  end
end
```

## Rails View Integration

### Setting JWT Token in Rails Views

When users log in through Rails routes, set the token in localStorage:

```erb
<!-- app/views/sessions/create.html.erb or after successful login -->
<script>
  // Set auth data after Rails login
  localStorage.setItem('languatalk_auth_token', '<%= generate_jwt_token(current_user) %>');
  localStorage.setItem('languatalk_auth_user', JSON.stringify({
    id: <%= current_user.id %>,
    uuid: '<%= current_user.uuid %>',
    email: '<%= current_user.email %>',
    first_name: '<%= current_user.first_name %>',
    last_name: '<%= current_user.last_name %>',
    onboarding_completed: <%= current_user.onboarding_completed || false %>
  }));
  
  // Dispatch event so React app knows about auth change
  window.dispatchEvent(new CustomEvent('auth-state-changed', {
    detail: { 
      token: '<%= generate_jwt_token(current_user) %>', 
      user: {
        id: <%= current_user.id %>,
        uuid: '<%= current_user.uuid %>',
        email: '<%= current_user.email %>',
        first_name: '<%= current_user.first_name %>',
        last_name: '<%= current_user.last_name %>',
        onboarding_completed: <%= current_user.onboarding_completed || false %>
      }, 
      isAuthenticated: true 
    }
  }));
</script>
```

### Navigation Links

Add a link to your React app that will have the user already authenticated:

```erb
<!-- In your Rails layout or navigation -->
<%= link_to "AI Chat", "/speak-react", class: "nav-link" %>
```

## Usage Flow

1. **User logs in via Rails**: Token is stored in localStorage
2. **User navigates to `/speak-react`**: React app reads token from localStorage
3. **React app validates token**: Calls `/api/v1/auth/validate` to ensure token is still valid
4. **User is authenticated**: Full access to React app features
5. **Cross-domain sync**: Any auth changes in React app update localStorage for Rails to see

## Security Considerations

1. **Token Expiration**: Tokens expire in 24 hours (configurable)
2. **Token Validation**: Always validate tokens on sensitive operations
3. **HTTPS Only**: Use HTTPS in production to protect tokens in transit
4. **Token Blacklisting**: Consider blacklisting tokens on logout for extra security
5. **Refresh Tokens**: Implement refresh tokens for better UX with longer sessions

## Testing

Test the integration:

```javascript
// In browser console
localStorage.setItem('languatalk_auth_token', 'your-test-jwt-token');
localStorage.setItem('languatalk_auth_user', JSON.stringify({
  id: 1, 
  uuid: 'test-uuid', 
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'User',
  onboarding_completed: true
}));

// Navigate to /speak-react - should be authenticated
```