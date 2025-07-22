import { expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

// Clean up after each test case
afterEach(() => {
  cleanup()
})

// Extend Vitest's expect with Testing Library's matchers
expect.extend(matchers)

// Mock window.matchMedia for components that use media queries
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock DOM methods used by the app
Element.prototype.scrollIntoView = vi.fn()

// Mock HTMLElement methods
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  value: vi.fn(),
})

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(() => null),
    removeItem: vi.fn(() => null),
    clear: vi.fn(() => null),
  },
})

// Suppress console.log and console.warn in tests unless DEBUG is set
if (!process.env.DEBUG) {
  global.console = {
    ...console,
    log: vi.fn(),
    warn: vi.fn(),
    error: console.error, // Keep error logs visible
  }
}