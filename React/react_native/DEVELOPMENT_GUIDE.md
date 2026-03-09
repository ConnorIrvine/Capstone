# DEVELOPMENT GUIDE

## Quick Start for React Native Beginners

If you're new to React Native but experienced with coding, this guide will help you get started.

## Understanding React Native

React Native lets you build mobile apps using JavaScript/TypeScript and React. It compiles to native Android/iOS code.

### Key Concepts

1. **Components**: UI building blocks (like HTML elements, but mobile-specific)
   - `View`: Container (like `<div>`)
   - `Text`: Text display (like `<p>`)
   - `TouchableOpacity`: Touchable button
   - `FlatList`: Scrollable list

2. **JSX**: JavaScript + HTML-like syntax
   ```tsx
   return (
     <View>
       <Text>Hello World</Text>
     </View>
   );
   ```

3. **State**: Dynamic data that triggers re-renders
   ```tsx
   const [count, setCount] = useState(0);
   ```

4. **Props**: Pass data to components
   ```tsx
   <MyComponent title="Hello" count={5} />
   ```

## Project Structure Explained

```
src/
├── types/          → TypeScript interfaces (data shapes)
├── services/       → Business logic (Bluetooth, processing, storage)
├── state/          → Global app state (Context API)
├── screens/        → Full-screen views
├── components/     → Reusable UI pieces
└── utils/          → Helper functions
```

## Development Phases

### Phase 1: Basic UI (Week 1-2)

**Goal**: Get the app displaying screens and navigating

1. **Install dependencies:**
   ```bash
   npm install
   npm install @react-navigation/native @react-navigation/stack
   npm install react-native-screens react-native-safe-area-context
   ```

2. **Implement basic HomeScreen:**
   - Uncomment code in `src/screens/HomeScreen.tsx`
   - Add basic styling
   - Test that it displays

3. **Set up navigation:**
   - Uncomment navigation code in `App.tsx`
   - Test moving between screens

4. **Use Mock data:**
   - Keep `MockCollector` as default
   - No real Bluetooth needed yet

### Phase 2: State Management (Week 2-3)

**Goal**: Connect screens to global state

1. **Implement AppProvider** in `src/state/AppState.tsx`:
   ```tsx
   export const AppProvider: React.FC<{children}> = ({children}) => {
     const [isConnected, setIsConnected] = useState(false);
     
     const scanForDevices = async () => {
       // Will implement later
     };
     
     return (
       <AppContext.Provider value={{isConnected, scanForDevices}}>
         {children}
       </AppContext.Provider>
     );
   };
   ```

2. **Use state in screens:**
   ```tsx
   const { isConnected, scanForDevices } = useAppState();
   ```

### Phase 3: Data Collection (Week 3-4)

**Goal**: Connect to real Bluetooth device

1. **Install BLE library:**
   ```bash
   npm install react-native-ble-plx
   npm install react-native-permissions
   ```

2. **Implement PolarH10Collector**:
   - Follow comments in `src/services/dataCollection/PolarH10Collector.ts`
   - Start with `initialize()` and `scanDevices()`
   - Test scanning before implementing connection

3. **Test with mock first**, then real device

### Phase 4: Processing (Week 4-5)

**Goal**: Calculate HRV from PPG data

**Option A - JavaScript (Easier to start):**
1. Implement basic RMSSD calculation
2. No external dependencies
3. Start with simple peak detection

**Option B - Python (Better algorithms):**
1. Complete Python script first
2. Test standalone: `python python/hrv_processor.py test.json out.json`
3. Then implement bridge

### Phase 5: Storage (Week 5-6)

**Goal**: Save and retrieve sessions

1. **Install storage:**
   ```bash
   npm install @react-native-async-storage/async-storage
   npm install react-native-fs
   ```

2. **Implement StorageService methods**:
   - Start with `saveSession()`
   - Then `loadAllSessions()`
   - Test data persistence

## React Native Basics

### Component Example

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export const MyButton: React.FC<{onPress: () => void}> = ({ onPress }) => {
  return (
    <TouchableOpacity onPress={onPress} style={styles.button}>
      <Text style={styles.text}>Click Me</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
  },
  text: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
```

### Using State

```tsx
const [count, setCount] = useState(0);

const increment = () => {
  setCount(count + 1);
};

return (
  <View>
    <Text>Count: {count}</Text>
    <MyButton onPress={increment} />
  </View>
);
```

### Using Effects

```tsx
useEffect(() => {
  // Runs when component mounts
  console.log('Component mounted');
  
  // Cleanup function
  return () => {
    console.log('Component unmounted');
  };
}, []); // Empty array = run once on mount
```

### Lists

```tsx
<FlatList
  data={sessions}
  renderItem={({item}) => (
    <View>
      <Text>{item.id}</Text>
    </View>
  )}
  keyExtractor={item => item.id}
/>
```

## Common Commands

```bash
# Start development server
npm start

# Run on Android
npm run android

# Clear cache
npm start -- --reset-cache

# Install new package
npm install package-name

# Check for errors
npm run lint
```

## Debugging

### React Native Debugger

1. Shake device (or Cmd+M in emulator)
2. Select "Debug"
3. Opens Chrome DevTools

### Console Logging

```tsx
console.log('Value:', myValue);
console.error('Error:', error);
```

### VS Code Debugging

Install "React Native Tools" extension for breakpoint debugging.

## Common Issues

### Metro Bundler Won't Start
```bash
rm -rf node_modules
npm install
npm start -- --reset-cache
```

### Android Build Errors
```bash
cd android
./gradlew clean
cd ..
npm run android
```

### Permissions Not Working
- Check `AndroidManifest.xml`
- Request at runtime with `react-native-permissions`

## Learning Resources

### Official Docs
- [React Native Docs](https://reactnative.dev/)
- [React Docs](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

### Video Tutorials
- React Native crash courses on YouTube
- React Navigation tutorials
- Bluetooth integration guides

### Example Projects
- Browse React Native examples on GitHub
- Check expo.io for demos

## Next Steps

1. **Week 1**: Get app running, display basic UI
2. **Week 2**: Implement navigation, connect screens
3. **Week 3**: Add mock data, test UI with fake data
4. **Week 4**: Connect real Bluetooth device
5. **Week 5**: Implement HRV processing
6. **Week 6**: Add data persistence
7. **Week 7**: Polish UI, add error handling
8. **Week 8**: Testing and refinement

## Tips for Success

1. **Start Small**: Get one screen working before adding complexity
2. **Use Mock Data**: Test UI without hardware dependencies
3. **Read Error Messages**: React Native errors are usually helpful
4. **Hot Reload**: Save files to see changes instantly
5. **Test Frequently**: Run app after each change
6. **Use TypeScript**: Types help catch errors early
7. **Follow Patterns**: The architecture is designed to be modular

## Getting Help

- React Native docs: Most comprehensive resource
- Stack Overflow: Search for error messages
- React Native Discord/Reddit: Community help
- This codebase: Follow the patterns already established

---

**Remember**: Every developer started somewhere. Take it step by step, and don't hesitate to experiment. The modular architecture means you can build and test each piece independently!
