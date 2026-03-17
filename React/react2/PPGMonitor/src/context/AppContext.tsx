import React, {createContext, useCallback, useContext, useRef, useState} from 'react';

interface AppContextValue {
  apiUrl: string;
  setApiUrl: (url: string) => void;
  exitSession: () => void;
  setExitSession: (fn: () => void) => void;
}

const AppContext = createContext<AppContextValue>({
  apiUrl: 'http://192.168.137.1:8000',
  setApiUrl: () => {},
  exitSession: () => {},
  setExitSession: () => {},
});

export const AppContextProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [apiUrl, setApiUrl] = useState('http://192.168.137.1:8000');
  const exitSessionRef = useRef<() => void>(() => {});
  const exitSession = useCallback(() => exitSessionRef.current(), []);
  const setExitSession = useCallback((fn: () => void) => {
    exitSessionRef.current = fn;
  }, []);

  return (
    <AppContext.Provider value={{apiUrl, setApiUrl, exitSession, setExitSession}}>
      {children}
    </AppContext.Provider>
  );
};

export function useAppContext(): AppContextValue {
  return useContext(AppContext);
}
