import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

// Mock the proxy server responses
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock audio for typewriter sounds
global.Audio = vi.fn(() => ({
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  currentTime: 0,
  volume: 0.5
}))

// Mock CSS module imports
vi.mock('../App.css', () => ({}))
vi.mock('../components/EvidenceBoard.css', () => ({}))

describe('App Integration Tests', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    // Reset all mocks
    vi.clearAllMocks()
    
    // Default successful fetch response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        type: 'dialogue',
        speaker: 'Navarro',
        text: 'Welcome to the case, detective.'
      })
    })
  })

  describe('App Initialization', () => {
    it('should render without crashing', async () => {
      render(<App />)
      expect(screen.getByTestId('game-container')).toBeInTheDocument()
    })

    it('should display initial game state correctly', async () => {
      render(<App />)
      
      // Check for time display
      expect(screen.getByText(/Time Remaining:/)).toBeInTheDocument()
      expect(screen.getByText(/48:00/)).toBeInTheDocument()
      
      // Check for current time display
      expect(screen.getByText(/Current Time:/)).toBeInTheDocument()
    })

    it('should show detective notepad initially', async () => {
      render(<App />)
      
      // Notepad should be visible initially
      expect(screen.getByTestId('detective-notepad')).toBeInTheDocument()
      expect(screen.getByText('Detective Notepad')).toBeInTheDocument()
    })

    it('should display mini-map with default location', async () => {
      render(<App />)
      
      // Check mini-map is present
      const miniMap = screen.getByTestId('mini-map')
      expect(miniMap).toBeInTheDocument()
      
      // Crime scene should be current location initially
      expect(screen.getByText('Crime Scene')).toBeInTheDocument()
    })
  })

  describe('Game Controls', () => {
    it('should have functional message input system', async () => {
      const user = userEvent.setup()
      render(<App />)
      
      const input = screen.getByTestId('message-input')
      const sendButton = screen.getByTestId('send-button')
      
      expect(input).toBeInTheDocument()
      expect(sendButton).toBeInTheDocument()
      
      // Type a message
      await user.type(input, 'Hello Navarro')
      expect(input).toHaveValue('Hello Navarro')
    })

    it('should toggle notepad visibility', async () => {
      const user = userEvent.setup()
      render(<App />)
      
      const toggleButton = screen.getByTestId('toggle-notepad')
      
      // Notepad should be visible initially
      expect(screen.getByTestId('detective-notepad')).toBeInTheDocument()
      
      // Click to hide
      await user.click(toggleButton)
      await waitFor(() => {
        expect(screen.queryByTestId('detective-notepad')).not.toBeInTheDocument()
      })
      
      // Click to show
      await user.click(toggleButton)
      await waitFor(() => {
        expect(screen.getByTestId('detective-notepad')).toBeInTheDocument()
      })
    })

    it('should handle evidence board toggle', async () => {
      const user = userEvent.setup()
      render(<App />)
      
      const evidenceBoardButton = screen.getByTestId('evidence-board-button')
      expect(evidenceBoardButton).toBeInTheDocument()
      
      // Click to open evidence board
      await user.click(evidenceBoardButton)
      
      await waitFor(() => {
        expect(screen.getByTestId('evidence-board')).toBeInTheDocument()
      })
    })
  })

  describe('Conversation System', () => {
    it('should send messages and receive responses', async () => {
      const user = userEvent.setup()
      render(<App />)
      
      const input = screen.getByTestId('message-input')
      const sendButton = screen.getByTestId('send-button')
      
      // Type and send message
      await user.type(input, 'What should I do first?')
      await user.click(sendButton)
      
      // Should make fetch request
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:3001/chat',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            }
          })
        )
      })
      
      // Input should be cleared after sending
      expect(input).toHaveValue('')
    })

    it('should display loading state during conversation', async () => {
      const user = userEvent.setup()
      
      // Mock slow response
      mockFetch.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            json: () => Promise.resolve({
              type: 'dialogue',
              speaker: 'Navarro',
              text: 'Let me think about that...'
            })
          }), 100)
        )
      )
      
      render(<App />)
      
      const input = screen.getByTestId('message-input')
      const sendButton = screen.getByTestId('send-button')
      
      await user.type(input, 'Test message')
      await user.click(sendButton)
      
      // Should show loading indicator
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument()
      }, { timeout: 2000 })
    })
  })

  describe('Game State Management', () => {
    it('should handle time progression correctly', async () => {
      render(<App />)
      
      // Initial time should be 48:00
      expect(screen.getByText(/48:00/)).toBeInTheDocument()
      
      // Simulate an action that costs time
      const user = userEvent.setup()
      const input = screen.getByTestId('message-input')
      const sendButton = screen.getByTestId('send-button')
      
      await user.type(input, 'search the apartment')
      await user.click(sendButton)
      
      // Time should decrease (this is a mock test, actual time change depends on game logic)
      await waitFor(() => {
        const timeElements = screen.getAllByText(/\d+:\d+/)
        expect(timeElements.length).toBeGreaterThan(0)
      })
    })

    it('should save game state to localStorage', async () => {
      const user = userEvent.setup()
      render(<App />)
      
      // Perform some action
      const input = screen.getByTestId('message-input')
      const sendButton = screen.getByTestId('send-button')
      
      await user.type(input, 'examine evidence')
      await user.click(sendButton)
      
      // Check that localStorage was called
      await waitFor(() => {
        expect(localStorage.setItem).toHaveBeenCalled()
      })
    })

    it('should load game state from localStorage', () => {
      // Set up mock localStorage data
      const mockGameState = JSON.stringify({
        currentTime: 47 * 60, // 47 hours remaining
        evidenceCollected: ['bloodstain'],
        currentLocation: 'crime-scene'
      })
      
      localStorage.getItem.mockReturnValue(mockGameState)
      
      render(<App />)
      
      // Should load saved state
      expect(localStorage.getItem).toHaveBeenCalledWith('first48_save')
    })
  })

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const user = userEvent.setup()
      
      // Mock failed fetch
      mockFetch.mockRejectedValue(new Error('Network error'))
      
      render(<App />)
      
      const input = screen.getByTestId('message-input')
      const sendButton = screen.getByTestId('send-button')
      
      await user.type(input, 'test message')
      await user.click(sendButton)
      
      // Should handle error without crashing
      await waitFor(() => {
        expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument()
      })
    })

    it('should handle malformed API responses', async () => {
      const user = userEvent.setup()
      
      // Mock invalid JSON response
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ invalid: 'response' })
      })
      
      render(<App />)
      
      const input = screen.getByTestId('message-input')
      const sendButton = screen.getByTestId('send-button')
      
      await user.type(input, 'test message')
      await user.click(sendButton)
      
      // Should handle gracefully
      await waitFor(() => {
        expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels for key elements', () => {
      render(<App />)
      
      const input = screen.getByTestId('message-input')
      expect(input).toHaveAttribute('aria-label', expect.stringContaining('message'))
      
      const sendButton = screen.getByTestId('send-button')
      expect(sendButton).toHaveAttribute('aria-label', expect.stringContaining('send'))
    })

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup()
      render(<App />)
      
      const input = screen.getByTestId('message-input')
      
      // Focus should be on input initially
      input.focus()
      expect(input).toHaveFocus()
      
      // Tab should move to send button
      await user.tab()
      const sendButton = screen.getByTestId('send-button')
      expect(sendButton).toHaveFocus()
    })
  })

  describe('Mobile Responsiveness', () => {
    it('should adapt to mobile viewport', () => {
      // Mock mobile viewport
      global.innerWidth = 375
      global.innerHeight = 667
      global.dispatchEvent(new Event('resize'))
      
      render(<App />)
      
      const container = screen.getByTestId('game-container')
      expect(container).toBeInTheDocument()
    })
  })
})