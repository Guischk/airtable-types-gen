// Vitest setup file
import { vi } from 'vitest';

// Mock console methods during tests to reduce noise
global.console = {
  ...console,
  // Keep error and warn for important messages, but mock the noisy ones
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  // Also mock console.error during error tests to reduce stderr noise
  error: vi.fn(),
};
