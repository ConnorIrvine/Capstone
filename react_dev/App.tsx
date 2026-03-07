import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { BLEProvider } from './src/context/BLEContext';
import { ConnectScreen } from './src/screens/ConnectScreen';
import { DataScreen } from './src/screens/DataScreen';

export type RootStackParamList = {
  Connect: undefined;
  Data: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <BLEProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Stack.Navigator
          initialRouteName="Connect"
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#0f172a' },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="Connect" component={ConnectScreen} />
          <Stack.Screen name="Data" component={DataScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </BLEProvider>
  );
}
