import React from 'react';
import {StatusBar, View, StyleSheet} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import PPGMonitorScreen from './src/screens/PPGMonitorScreen';
import HRVScreen from './src/screens/HRVScreen';

const Tab = createBottomTabNavigator();

const App: React.FC = () => {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0d0d1a" />
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              backgroundColor: '#0d0d1a',
              borderTopColor: '#1a1a2e',
              borderTopWidth: 1,
            },
            tabBarActiveTintColor: '#00E676',
            tabBarInactiveTintColor: '#6666aa',
            tabBarLabelStyle: {
              fontSize: 12,
              fontWeight: '600',
            },
          }}>
          <Tab.Screen
            name="PPG Monitor"
            component={PPGMonitorScreen}
            options={{
              tabBarLabel: 'PPG Monitor',
            }}
          />
          <Tab.Screen
            name="HRV Analysis"
            component={HRVScreen}
            options={{
              tabBarLabel: 'HRV Analysis',
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0d0d1a',
  },
});

export default App;
