export interface SharedLayoutProps {
  children: React.ReactNode;
  platform: 'web' | 'mobile';
  config: {
    apiUrl: string;
    wsUrl?: string;
    socialAuthConfig?: {
      google?: any;
      apple?: any;
    };
    analytics?: {
      posthogApiKey?: string;
      posthogHost?: string;
    };
    sentry?: {
      dsn?: string;
      enabled?: boolean;
    };
  };
}