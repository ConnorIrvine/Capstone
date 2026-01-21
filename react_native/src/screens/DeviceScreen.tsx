/**
 * DEVICE CONNECTION SCREEN
 * =========================
 * Screen for scanning and connecting to Bluetooth PPG devices
 * 
 * FEATURES:
 * - Scan for available devices
 * - Display device list with signal strength
 * - Connect to selected device
 * - Show connection status
 * - Handle permissions
 * 
 * FLOW:
 * 1. User arrives at screen
 * 2. Request Bluetooth permissions if needed
 * 3. Auto-scan or manual scan button
 * 4. Display list of found devices
 * 5. User taps device to connect
 * 6. Show connection progress
 * 7. Navigate back on success
 */

import React from 'react';
// import { View, FlatList, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
// import { useAppState } from '../state/AppState';

export const DeviceScreen: React.FC = () => {
  // const { 
  //   availableDevices, 
  //   connectedDevice,
  //   isLoading,
  //   scanForDevices, 
  //   connectToDevice 
  // } = useAppState();

  // useEffect(() => {
  //   // Auto-scan on mount
  //   scanForDevices();
  // }, []);

  // const handleDeviceSelect = async (deviceId: string) => {
  //   const success = await connectToDevice(deviceId);
  //   if (success) {
  //     navigation.goBack();
  //   }
  // };

  return (
    <>
      {/*
      IMPLEMENTATION COMPONENTS:
      
      <View style={styles.container}>
        <Text style={styles.title}>Connect to Device</Text>
        
        <PrimaryButton 
          onPress={scanForDevices}
          title="Scan for Devices"
          disabled={isLoading}
        />
        
        {isLoading && <ActivityIndicator />}
        
        <FlatList
          data={availableDevices}
          renderItem={({ item }) => (
            <DeviceListItem 
              device={item}
              onPress={() => handleDeviceSelect(item.id)}
              isConnected={connectedDevice?.id === item.id}
            />
          )}
          keyExtractor={(item) => item.id}
        />
        
        <PermissionExplanation />
      </View>
      */}
    </>
  );
};

/**
 * DEVICE LIST ITEM COMPONENT
 * Shows individual device with icon, name, connection button
 */
// const DeviceListItem: React.FC<{device, onPress, isConnected}> = ({...}) => {
//   return (
//     <TouchableOpacity onPress={onPress}>
//       <View>
//         <Text>{device.name}</Text>
//         <Text>{device.type}</Text>
//         {isConnected && <Text>✓ Connected</Text>}
//       </View>
//     </TouchableOpacity>
//   );
// };
