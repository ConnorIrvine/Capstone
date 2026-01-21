/**
 * APP STATE MANAGER
 * ==================
 * Central state management for the application
 * 
 * ARCHITECTURE:
 * - Uses React Context API for global state
 * - Alternative: Consider Zustand or Redux if app grows complex
 * 
 * STATE STRUCTURE:
 * - Bluetooth connection status
 * - Current session state
 * - Real-time HRV metrics
 * - User preferences
 * - Historical data
 * 
 * USAGE:
 * const { startSession, hrvMetrics } = useAppState();
 */

import { createContext, useContext } from 'react';
import { DeviceInfo, HRVMetrics, MeditationSession } from '@/types';

/**
 * Application State Interface
 */
export interface AppState {
  // Bluetooth Connection
  isBluetoothEnabled: boolean;
  connectedDevice: DeviceInfo | null;
  availableDevices: DeviceInfo[];

  // Session State
  isSessionActive: boolean;
  currentSession: MeditationSession | null;
  sessionStartTime: number | null;

  // Real-time Metrics
  currentHRV: HRVMetrics | null;
  heartRate: number | null;

  // Historical Data
  recentSessions: MeditationSession[];
  
  // UI State
  isLoading: boolean;
  error: string | null;
}

/**
 * Application Actions Interface
 */
export interface AppActions {
  // Bluetooth Actions
  scanForDevices: () => Promise<void>;
  connectToDevice: (deviceId: string) => Promise<boolean>;
  disconnectDevice: () => Promise<void>;

  // Session Actions
  startSession: () => Promise<void>;
  stopSession: () => Promise<void>;
  pauseSession: () => void;
  resumeSession: () => void;

  // Data Actions
  loadRecentSessions: (count: number) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;

  // Error Handling
  clearError: () => void;
}

/**
 * Combined Context Type
 */
export type AppContextType = AppState & AppActions;

/**
 * React Context
 * This will be provided at the root of your app
 */
export const AppContext = createContext<AppContextType | undefined>(undefined);

/**
 * Custom Hook for accessing app state
 * 
 * USAGE in components:
 * const { isSessionActive, startSession } = useAppState();
 */
export function useAppState(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppState must be used within AppProvider');
  }
  return context;
}

/**
 * App State Provider Component
 * 
 * IMPLEMENTATION NOTES:
 * 1. Wrap your App component with this provider
 * 2. Use React hooks (useState, useEffect) to manage state
 * 3. Integrate with StorageService for persistence
 * 4. Integrate with DataCollector and HRVProcessor services
 * 
 * EXAMPLE STRUCTURE:
 * 
 * export const AppProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
 *   const [state, setState] = useState<AppState>(initialState);
 *   
 *   const scanForDevices = async () => {
 *     // Use DataCollectorFactory to scan
 *     // Update availableDevices state
 *   };
 *   
 *   const startSession = async () => {
 *     // Start data collection
 *     // Initialize session
 *     // Begin HRV processing
 *   };
 *   
 *   const value: AppContextType = {
 *     ...state,
 *     scanForDevices,
 *     startSession,
 *     // ... other actions
 *   };
 *   
 *   return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
 * };
 */
