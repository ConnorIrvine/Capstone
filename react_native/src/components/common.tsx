/**
 * REUSABLE UI COMPONENTS
 * =======================
 * Common components used across the app
 * These ensure consistent styling and behavior
 */

// Example component structure - implement these based on your design

/**
 * PRIMARY BUTTON
 * Main call-to-action button
 */
// export const PrimaryButton: React.FC<{
//   title: string;
//   onPress: () => void;
//   disabled?: boolean;
// }> = ({ title, onPress, disabled }) => {
//   return (
//     <TouchableOpacity 
//       onPress={onPress} 
//       disabled={disabled}
//       style={styles.primaryButton}
//     >
//       <Text style={styles.primaryButtonText}>{title}</Text>
//     </TouchableOpacity>
//   );
// };

/**
 * SECONDARY BUTTON
 * Less prominent actions
 */
// export const SecondaryButton: React.FC<...> = ({...}) => {};

/**
 * METRIC DISPLAY CARD
 * Shows a single metric with label, value, and unit
 */
// export const MetricDisplay: React.FC<{
//   label: string;
//   value: number | string;
//   unit: string;
//   size?: 'small' | 'medium' | 'large';
// }> = ({ label, value, unit, size = 'medium' }) => {
//   return (
//     <View style={styles.metricCard}>
//       <Text style={styles.metricLabel}>{label}</Text>
//       <Text style={styles.metricValue}>{value}</Text>
//       <Text style={styles.metricUnit}>{unit}</Text>
//     </View>
//   );
// };

/**
 * CONNECTION STATUS INDICATOR
 */
// export const ConnectionStatus: React.FC<{
//   device: DeviceInfo | null;
// }> = ({ device }) => {
//   const isConnected = device?.isConnected;
//   return (
//     <View style={styles.statusContainer}>
//       <View style={[styles.statusDot, { backgroundColor: isConnected ? 'green' : 'red' }]} />
//       <Text>{isConnected ? `Connected: ${device.name}` : 'Not Connected'}</Text>
//     </View>
//   );
// };

/**
 * LOADING SPINNER
 */
// export const LoadingSpinner: React.FC<{message?: string}> = ({ message }) => {
//   return (
//     <View>
//       <ActivityIndicator size="large" />
//       {message && <Text>{message}</Text>}
//     </View>
//   );
// };

/**
 * ERROR MESSAGE
 */
// export const ErrorMessage: React.FC<{
//   error: string;
//   onDismiss: () => void;
// }> = ({ error, onDismiss }) => {
//   return (
//     <View style={styles.errorContainer}>
//       <Text style={styles.errorText}>{error}</Text>
//       <TouchableOpacity onPress={onDismiss}>
//         <Text>Dismiss</Text>
//       </TouchableOpacity>
//     </View>
//   );
// };
