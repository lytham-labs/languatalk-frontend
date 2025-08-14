import React from 'react';
import { SharedLayoutProps } from './types';

export const SharedLayoutProvider: React.FC<SharedLayoutProps> = ({
  children,
  platform,
  config
}) => {
  // This is the base shared layout that all apps can use
  // Platform-specific implementations will need to inject their own dependencies
  
  return (
    <div className="shared-layout-provider">
      {/* Platform-specific providers will be wrapped around this */}
      {children}
    </div>
  );
};