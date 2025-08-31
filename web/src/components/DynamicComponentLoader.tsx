"use client";

import { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

// Fallback to existing SolMintApp
const SolMintApp = dynamic(() => import('./SolMintApp'), {
  ssr: false,
  loading: () => <ComponentLoader />
});

function ComponentLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
        <p className="text-gray-600 dark:text-gray-400">Loading application...</p>
      </div>
    </div>
  );
}

interface ComponentConfig {
  componentType?: string;
  componentName?: string;
  customComponent?: boolean;
  baseType?: string;
  programId?: string;
}

export default function DynamicComponentLoader() {
  const [AppComponent, setAppComponent] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadComponent() {
      try {
        // Check for component configuration
        // Handle Next.js basePath properly
        const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
        const apiUrl = `${basePath}/api/component-config`;
        const response = await fetch(apiUrl).catch(() => null);
        
        if (response && response.ok) {
          const config: ComponentConfig = await response.json();
          console.log('[DynamicComponentLoader] Component config:', config);
          
          // Try to load generated component if it exists
          // Note: Dynamic imports with template literals are not supported in Next.js
          // We'll handle this differently in Phase 2 with a proper component registry
        }
        
        // Fallback to default SolMintApp
        console.log('[DynamicComponentLoader] Using default SolMintApp');
        setAppComponent(() => SolMintApp);
        setIsLoading(false);
        
      } catch (err) {
        console.error('[DynamicComponentLoader] Error loading component:', err);
        setError('Failed to load application component');
        // Still load default on error
        setAppComponent(() => SolMintApp);
        setIsLoading(false);
      }
    }

    loadComponent();
  }, []);

  // Error state with retry
  if (error && !AppComponent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <p className="text-red-500 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading || !AppComponent) {
    return <ComponentLoader />;
  }

  // Render the loaded component
  return (
    <Suspense fallback={<ComponentLoader />}>
      <AppComponent />
    </Suspense>
  );
}