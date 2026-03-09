/**
 * HRV PROCESSOR FACTORY
 * ======================
 * Factory for creating HRV processor instances
 * 
 * USAGE:
 * const processor = HRVProcessorFactory.create('javascript');
 * await processor.initialize();
 * const metrics = await processor.processData(ppgData);
 * 
 * PROCESSOR SELECTION STRATEGY:
 * - Development: Use Python for fast algorithm iteration
 * - Real-time: Use JavaScript for low latency
 * - Post-session: Either implementation based on accuracy needs
 */

import { IHRVProcessor } from './IHRVProcessor';
import { JavaScriptHRVProcessor } from './JavaScriptHRVProcessor';
import { PythonBridgeHRVProcessor } from './PythonBridgeHRVProcessor';

export type ProcessorType = 'javascript' | 'python' | 'hybrid';

export class HRVProcessorFactory {
  /**
   * Create an HRV processor instance
   * @param type - Type of processor to create
   * @returns IHRVProcessor implementation
   */
  static create(type: ProcessorType): IHRVProcessor {
    switch (type) {
      case 'javascript':
        return new JavaScriptHRVProcessor();
      
      case 'python':
        return new PythonBridgeHRVProcessor();
      
      case 'hybrid':
        // Hybrid approach: JavaScript for real-time, Python for detailed
        // Return a wrapper that delegates based on use case
        throw new Error('Hybrid processor not yet implemented');
      
      default:
        throw new Error(`Unknown processor type: ${type}`);
    }
  }

  /**
   * Create processor from configuration
   */
  static fromConfig(): IHRVProcessor {
    // Read from app configuration
    // Default to 'javascript' for simplicity
    
    // Example logic:
    // const config = AppConfig.getProcessorType();
    // return HRVProcessorFactory.create(config);
    
    return HRVProcessorFactory.create('javascript');
  }

  /**
   * Create optimal processor for use case
   */
  static forUseCase(useCase: 'realtime' | 'post-session' | 'development'): IHRVProcessor {
    switch (useCase) {
      case 'realtime':
        // JavaScript is faster for real-time processing
        return HRVProcessorFactory.create('javascript');
      
      case 'post-session':
        // Either works; prefer JavaScript for simplicity
        return HRVProcessorFactory.create('javascript');
      
      case 'development':
        // Python allows faster algorithm iteration
        return HRVProcessorFactory.create('python');
      
      default:
        return HRVProcessorFactory.create('javascript');
    }
  }
}
