import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ImageBackground,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {bleService} from '../services/BleService';

interface Props {
  onSessionStart: () => void;
  onSessionHistory: () => void;
}

const WelcomeScreen: React.FC<Props> = ({onSessionStart, onSessionHistory}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = useCallback(async () => {
    if (isConnected) return;
    setIsConnecting(true);
    try {
      await bleService.scanAndConnect();
      setIsConnected(true);
    } catch (e: any) {
      Alert.alert('Connection Failed', e.message ?? 'Could not connect to device.');
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  }, [isConnected]);

  return (
    <ImageBackground
      source={require('../assets/images/background.jpg')}
      style={styles.bg}
      resizeMode="cover">
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={styles.overlay} />

      <View style={styles.content}>
        <View style={styles.titleContainer}>
          <Text style={styles.welcomeText}>Welcome to</Text>
          <Text style={styles.appName}>CalmCoach</Text>
        </View>

        <View style={styles.buttons}>
          {/* Connect Device */}
          <TouchableOpacity
            style={[
              styles.button,
              isConnected && styles.buttonDimmed,
              isConnecting && styles.buttonDimmed,
            ]}
            onPress={handleConnect}
            disabled={isConnected || isConnecting}
            activeOpacity={0.8}>
            {isConnecting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buttonText}>
                {isConnected ? 'Device Connected' : 'Connect Device'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Start a Session */}
          <TouchableOpacity
            style={[styles.button, !isConnected && styles.buttonDisabled]}
            onPress={onSessionStart}
            disabled={!isConnected}
            activeOpacity={0.8}>
            <Text style={[styles.buttonText, !isConnected && styles.buttonTextDisabled]}>
              Start a Session
            </Text>
          </TouchableOpacity>

          {/* Session History */}
          <TouchableOpacity
            style={styles.button}
            onPress={onSessionHistory}
            activeOpacity={0.8}>
            <Text style={styles.buttonText}>Session History</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: 60,
    paddingHorizontal: 32,
  },
  titleContainer: {
    marginTop: '35%',
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 32,
    color: '#ffffff',
    fontWeight: '400',
    textAlign: 'center',
  },
  appName: {
    fontSize: 38,
    color: '#ffffff',
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 1,
  },
  buttons: {
    gap: 14,
  },
  button: {
    backgroundColor: 'rgba(30, 60, 120, 0.85)',
    borderRadius: 10,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(100, 150, 255, 0.3)',
  },
  buttonDimmed: {
    backgroundColor: 'rgba(30, 60, 120, 0.4)',
    borderColor: 'rgba(100, 150, 255, 0.15)',
  },
  buttonDisabled: {
    backgroundColor: 'rgba(30, 60, 120, 0.4)',
    borderColor: 'rgba(100, 150, 255, 0.15)',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  buttonTextDisabled: {
    color: 'rgba(200,200,200,0.45)',
  },
});

export default WelcomeScreen;
