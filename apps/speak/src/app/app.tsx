import '../styles.css';
import { AuthProvider } from '@languatalk-frontend/data-access-auth';
import { AuthDemo } from '../components/AuthDemo';
import { webAuthConfig } from '../adapters/WebAuthAdapters';

export function App() {
  return (
    <AuthProvider config={webAuthConfig}>
      <div>
        <div className="mt-8 p-4 space-y-6">
          <div>
            <h2 className="text-2xl font-bold mb-4">Speak App with Shared Auth</h2>
            <p className="mb-2">This app is now using shared authentication:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>✅ AuthProvider from @languatalk-frontend/data-access-auth</li>
              <li>✅ Web-specific adapters for localStorage and analytics</li>
              <li>✅ Ready to integrate with Rails API for login</li>
            </ul>
          </div>

          <AuthDemo />
        </div>
      </div>
    </AuthProvider>
  );
}

export default App;