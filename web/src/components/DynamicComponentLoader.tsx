"use client";

import { useState, useEffect, Suspense, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Loader2, AlertCircle, RefreshCw, CheckCircle } from 'lucide-react';

// Component cache to prevent unnecessary reloads
const componentCache = new Map<string, any>();

// WebSocket for hot reload notifications
let ws: WebSocket | null = null;

interface ComponentConfig {
  componentType?: string;
  componentName?: string;
  customComponent?: boolean;
  baseType?: string;
  programId?: string;
  templateUsed?: string;
  generatedAt?: string;
  version?: string;
  checksum?: string;
}

interface LoaderState {
  status: 'idle' | 'loading' | 'loaded' | 'error' | 'reloading';
  component: any;
  config: ComponentConfig | null;
  error: Error | null;
  lastLoadTime: number;
  retryCount: number;
}

function ComponentLoader({ message = "Loading application..." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
        <p className="text-gray-600 dark:text-gray-400">{message}</p>
      </div>
    </div>
  );
}

function ErrorFallback({ error, resetErrorBoundary }: any) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-md w-full p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <div className="flex items-center mb-4">
          <AlertCircle className="w-6 h-6 text-red-500 mr-2" />
          <h2 className="text-xl font-semibold">Component Load Error</h2>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {error?.message || 'Failed to load the application component'}
        </p>
        <div className="flex gap-2">
          <button
            onClick={resetErrorBoundary}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center justify-center"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Reload Page
          </button>
        </div>
      </div>
    </div>
  );
}

// Fallback to existing SolMintApp
const SolMintApp = dynamic(() => import('./defaults/SolMintApp').catch(() => {
  console.warn('[DynamicComponentLoader] SolMintApp not found in defaults');
  // If defaults fail, return a simple fallback component
  return Promise.resolve({
    default: () => (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold mb-4">Welcome to SolanaFlow</h1>
          <p className="text-gray-600">No component configured yet.</p>
        </div>
      </div>
    )
  });
}), {
  ssr: false,
  loading: () => <ComponentLoader message="Loading default component..." />
});

export default function DynamicComponentLoader() {
  const [state, setState] = useState<LoaderState>({
    status: 'idle',
    component: null,
    config: null,
    error: null,
    lastLoadTime: 0,
    retryCount: 0
  });
  
  const [hotReloadIndicator, setHotReloadIndicator] = useState(false);
  const mountedRef = useRef(true);
  const configCheckInterval = useRef<NodeJS.Timeout>();
  const lastConfigChecksum = useRef<string>('');
  
  // Initialize WebSocket for hot reload
  const initializeWebSocket = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (ws?.readyState === WebSocket.OPEN) return;
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = process.env.NEXT_PUBLIC_WS_URL || `${protocol}//${window.location.host}/ws`;
    
    try {
      ws = new WebSocket(wsHost);
      
      ws.onopen = () => {
        console.log('[DynamicComponentLoader] WebSocket connected for hot reload');
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'component-update' || message.type === 'config-update') {
            console.log('[DynamicComponentLoader] Component update detected via WebSocket');
            handleHotReload();
          }
        } catch (e) {
          console.error('[DynamicComponentLoader] WebSocket message parse error:', e);
        }
      };
      
      ws.onerror = (error) => {
        console.warn('[DynamicComponentLoader] WebSocket error:', error);
      };
      
      ws.onclose = () => {
        console.log('[DynamicComponentLoader] WebSocket closed, will retry in 5s');
        setTimeout(() => {
          if (mountedRef.current) {
            initializeWebSocket();
          }
        }, 5000);
      };
    } catch (error) {
      console.warn('[DynamicComponentLoader] WebSocket initialization failed:', error);
    }
  }, []);
  
  // Handle hot reload
  const handleHotReload = useCallback(async () => {
    console.log('[DynamicComponentLoader] Hot reload triggered');
    setHotReloadIndicator(true);
    setState(prev => ({ ...prev, status: 'reloading' }));
    
    // Clear component cache
    componentCache.clear();
    
    // Reload the component
    await loadComponent(true);
    
    setTimeout(() => setHotReloadIndicator(false), 2000);
  }, []);
  
  // Check for configuration changes
  const checkForConfigChanges = useCallback(async () => {
    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
      const response = await fetch(`${basePath}/api/component-config?t=${Date.now()}`);
      
      if (response.ok) {
        const config: ComponentConfig = await response.json();
        const checksum = config.checksum || JSON.stringify(config);
        
        if (lastConfigChecksum.current && lastConfigChecksum.current !== checksum) {
          console.log('[DynamicComponentLoader] Configuration change detected');
          handleHotReload();
        }
        
        lastConfigChecksum.current = checksum;
      }
    } catch (error) {
      console.error('[DynamicComponentLoader] Config check failed:', error);
    }
  }, [handleHotReload]);
  
  // Load component with enhanced error handling and caching
  const loadComponent = useCallback(async (forceReload = false) => {
    if (!mountedRef.current) return;
    
    setState(prev => ({ 
      ...prev, 
      status: prev.status === 'loaded' ? 'reloading' : 'loading' 
    }));
    
    try {
      // Check for component configuration
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
      const response = await fetch(`${basePath}/api/component-config?t=${Date.now()}`);
      
      if (response.ok) {
        const config: ComponentConfig = await response.json();
        console.log('[DynamicComponentLoader] Component config:', config);
        
        // Try to load generated component
        if (config.customComponent && config.componentName) {
          const cacheKey = `${config.componentName}-${config.version || 'latest'}`;
          
          // Check cache first
          if (!forceReload && componentCache.has(cacheKey)) {
            console.log('[DynamicComponentLoader] Using cached component:', cacheKey);
            const CachedComponent = componentCache.get(cacheKey);
            setState({
              status: 'loaded',
              component: CachedComponent,
              config,
              error: null,
              lastLoadTime: Date.now(),
              retryCount: 0
            });
            return;
          }
          
          try {
            // Attempt to load generated component with retry logic
            const loadGeneratedComponent = async (attempt = 1): Promise<any> => {
              try {
                // Since dynamic imports with variables aren't supported in Next.js,
                // we'll use a component registry approach
                const componentName = config.componentName;
                
                // Try to load from generated folder
                // Note: These imports will fail at build time but work at runtime
                // when the files are actually generated
                let loadedModule;
                try {
                  // @ts-ignore - Dynamic import with variable
                  loadedModule = await import(`./generated/${componentName}`);
                } catch {
                  try {
                    // @ts-ignore - Dynamic import with variable
                    loadedModule = await import(`./generated/${componentName}.tsx`);
                  } catch {
                    // @ts-ignore - Dynamic import with variable
                    loadedModule = await import(`./generated/index`);
                  }
                }
                
                return loadedModule?.default || loadedModule;
              } catch (error) {
                if (attempt < 3) {
                  console.log(`[DynamicComponentLoader] Retry attempt ${attempt + 1}`);
                  await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                  return loadGeneratedComponent(attempt + 1);
                }
                throw error;
              }
            };
            
            const GeneratedComponent = dynamic(
              () => loadGeneratedComponent(),
              { 
                ssr: false,
                loading: () => <ComponentLoader message={`Loading ${config.componentName}...`} />
              }
            );
            
            // Cache the component
            componentCache.set(cacheKey, GeneratedComponent);
            
            setState({
              status: 'loaded',
              component: GeneratedComponent,
              config,
              error: null,
              lastLoadTime: Date.now(),
              retryCount: 0
            });
            
            console.log('[DynamicComponentLoader] Loaded generated component:', config.componentName);
            return;
          } catch (err) {
            console.warn('[DynamicComponentLoader] Failed to load generated component:', err);
            // Fall through to default component
          }
        }
      }
      
      // Fallback to default SolMintApp
      console.log('[DynamicComponentLoader] Using default SolMintApp');
      setState({
        status: 'loaded',
        component: SolMintApp,
        config: null,
        error: null,
        lastLoadTime: Date.now(),
        retryCount: 0
      });
      
    } catch (error: any) {
      console.error('[DynamicComponentLoader] Error loading component:', error);
      
      // Implement exponential backoff for retries
      const nextRetryCount = state.retryCount + 1;
      const retryDelay = Math.min(1000 * Math.pow(2, nextRetryCount), 30000);
      
      if (nextRetryCount <= 3) {
        console.log(`[DynamicComponentLoader] Will retry in ${retryDelay}ms (attempt ${nextRetryCount}/3)`);
        setTimeout(() => loadComponent(), retryDelay);
        
        setState(prev => ({
          ...prev,
          status: 'error',
          error,
          retryCount: nextRetryCount
        }));
      } else {
        // Max retries reached, load fallback
        setState({
          status: 'loaded',
          component: SolMintApp,
          config: null,
          error,
          lastLoadTime: Date.now(),
          retryCount: 0
        });
      }
    }
  }, [state.retryCount]);
  
  // Initialize component loading
  useEffect(() => {
    mountedRef.current = true;
    loadComponent();
    
    // Initialize WebSocket for hot reload in development
    if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_HOT_RELOAD === 'true') {
      initializeWebSocket();
      
      // Poll for config changes as backup
      configCheckInterval.current = setInterval(checkForConfigChanges, 5000);
    }
    
    // Listen for manual reload events
    const handleManualReload = (event: CustomEvent) => {
      if (event.detail?.componentName) {
        console.log('[DynamicComponentLoader] Manual reload requested for:', event.detail.componentName);
        handleHotReload();
      }
    };
    
    window.addEventListener('reload-component' as any, handleManualReload);
    
    return () => {
      mountedRef.current = false;
      if (ws) {
        ws.close();
        ws = null;
      }
      if (configCheckInterval.current) {
        clearInterval(configCheckInterval.current);
      }
      window.removeEventListener('reload-component' as any, handleManualReload);
    };
  }, []);
  
  // Render based on state
  const AppComponent = state.component;
  
  return (
    <>
      {/* Hot reload indicator */}
      {hotReloadIndicator && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg shadow-lg animate-pulse">
          <CheckCircle className="w-4 h-4" />
          <span className="text-sm font-medium">Component Updated</span>
        </div>
      )}
      
      {/* Development tools overlay */}
      {(process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_HOT_RELOAD === 'true') && state.config && (
        <div className="fixed bottom-4 left-4 z-50 max-w-xs">
          <details className="bg-gray-900 text-white p-2 rounded-lg shadow-lg text-xs">
            <summary className="cursor-pointer font-mono">
              Component: {state.config.componentName || 'default'}
            </summary>
            <div className="mt-2 space-y-1">
              <p>Type: {state.config.componentType}</p>
              <p>Template: {state.config.templateUsed || 'none'}</p>
              <p>Generated: {state.config.generatedAt ? new Date(state.config.generatedAt).toLocaleTimeString() : 'N/A'}</p>
              <p>Status: {state.status}</p>
              <button
                onClick={() => handleHotReload()}
                className="mt-2 px-2 py-1 bg-blue-500 rounded hover:bg-blue-600 transition-colors"
              >
                Force Reload
              </button>
            </div>
          </details>
        </div>
      )}
      
      {/* Main component */}
      {state.status === 'loading' && <ComponentLoader />}
      {state.status === 'reloading' && AppComponent && (
        <div className="relative">
          <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 z-10 flex items-center justify-center">
            <ComponentLoader message="Reloading component..." />
          </div>
          <AppComponent />
        </div>
      )}
      {(state.status === 'loaded' || state.status === 'error') && AppComponent && (
        <Suspense fallback={<ComponentLoader />}>
          <AppComponent />
        </Suspense>
      )}
    </>
  );
}