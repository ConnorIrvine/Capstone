/**
 * DATA COLLECTOR FACTORY
 * =======================
 * Factory pattern for creating data collector instances
 * 
 * USAGE:
 * const collector = DataCollectorFactory.create('polar_h10');
 * await collector.initialize();
 * 
 * BENEFITS:
 * - Centralized instantiation logic
 * - Easy switching between implementations
 * - Configuration-based collector selection
 * - Type-safe collector creation
 */

import { IDataCollector } from './IDataCollector';
import { PolarH10Collector } from './PolarH10Collector';
import { MockCollector } from './MockCollector';

export type CollectorType = 'polar_h10' | 'mock' | 'generic_ble';

export class DataCollectorFactory {
  /**
   * Create a data collector instance
   * @param type - Type of collector to create
   * @returns IDataCollector implementation
   */
  static create(type: CollectorType): IDataCollector {
    // Switch based on type and return appropriate implementation
    // Add new implementations here as you develop them
    
    switch (type) {
      case 'polar_h10':
        // return new PolarH10Collector();
        throw new Error('PolarH10Collector not yet implemented');
      
      case 'mock':
        return new MockCollector();
      
      case 'generic_ble':
        // For future: generic BLE implementation
        throw new Error('Generic BLE collector not yet implemented');
      
      default:
        throw new Error(`Unknown collector type: ${type}`);
    }
  }

  /**
   * Get collector from configuration
   * Reads from app config or environment
   */
  static fromConfig(): IDataCollector {
    // Read from app configuration
    // Default to 'mock' in development, 'polar_h10' in production
    
    // Example logic:
    // const config = AppConfig.getCollectorType();
    // return DataCollectorFactory.create(config);
    
    return DataCollectorFactory.create('mock');
  }
}
