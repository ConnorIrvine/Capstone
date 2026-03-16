import React, {useState} from 'react';
import {View, StyleSheet} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import PPGMonitorScreen from './src/screens/PPGMonitorScreen';
import HRVScreen from './src/screens/HRVScreen';
import AmplitudeScreen from './src/screens/AmplitudeScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import SessionHistoryScreen from './src/screens/SessionHistoryScreen';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const Tab = createBottomTabNavigator();

type AppView = 'welcome' | 'session' | 'history';

const TabNavigator: React.FC = () => (
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
          tabBarIcon: ({color, size}) => (
            <Icon name="heart-pulse" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="HRV Analysis"
        component={HRVScreen}
        options={{
          tabBarLabel: 'HRV Analysis',
          tabBarIcon: ({color, size}) => (
            <Icon name="chart-line" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Amplitude"
        component={AmplitudeScreen}
        options={{
          tabBarLabel: 'Amplitude',
          tabBarIcon: ({color, size}) => (
            <Icon name="waveform" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  </NavigationContainer>
);

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('welcome');

  if (view === 'session') {
    return (
      <View style={styles.root}>
        <TabNavigator />
      </View>
    );
  }

  if (view === 'history') {
    return (
      <View style={styles.root}>
        <SessionHistoryScreen onBack={() => setView('welcome')} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <WelcomeScreen
        onSessionStart={() => setView('session')}
        onSessionHistory={() => setView('history')}
      />
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
