import React from 'react';
import {SafeAreaView, StyleSheet} from 'react-native';
import PPGMonitorScreen from './src/screens/PPGMonitorScreen';

const App: React.FC = () => {
  return (
    <SafeAreaView style={styles.root}>
      <PPGMonitorScreen />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0d0d1a',
  },
});

export default App;
