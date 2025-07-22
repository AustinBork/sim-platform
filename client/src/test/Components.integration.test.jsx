import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EvidenceBoard from '../components/EvidenceBoard'
import { GameStateProvider, useGameState } from '../context/GameStateContext'

// Mock CSS imports
vi.mock('../components/EvidenceBoard.css', () => ({}))

// Test component to access game state
const TestComponent = ({ onStateChange }) => {
  const state = useGameState()
  React.useEffect(() => {
    if (onStateChange) onStateChange(state)
  }, [state, onStateChange])
  
  return (
    <div data-testid="test-component">
      <div data-testid="time-remaining">{state.state.timeRemaining}</div>
      <div data-testid="evidence-count">{state.state.evidenceCollected.length}</div>
      <div data-testid="location">{state.state.currentLocation}</div>
      <button 
        data-testid="add-evidence" 
        onClick={() => state.addEvidence('test-evidence')}
      >
        Add Evidence
      </button>
      <button 
        data-testid="update-time" 
        onClick={() => state.updateTime(30)}
      >
        Update Time
      </button>
    </div>
  )
}

describe('React Components Integration Tests', () => {
  describe('GameStateContext', () => {
    it('should provide initial game state correctly', () => {
      const mockStateChange = vi.fn()
      
      render(
        <GameStateProvider>
          <TestComponent onStateChange={mockStateChange} />
        </GameStateProvider>
      )
      
      expect(screen.getByTestId('time-remaining')).toHaveTextContent('2880') // 48 * 60
      expect(screen.getByTestId('evidence-count')).toHaveTextContent('0')
      expect(screen.getByTestId('location')).toHaveTextContent('crimeScene')
    })

    it('should handle evidence addition', async () => {
      const user = userEvent.setup()
      
      render(
        <GameStateProvider>
          <TestComponent />
        </GameStateProvider>
      )
      
      expect(screen.getByTestId('evidence-count')).toHaveTextContent('0')
      
      await user.click(screen.getByTestId('add-evidence'))
      
      expect(screen.getByTestId('evidence-count')).toHaveTextContent('1')
    })

    it('should handle time updates', async () => {
      const user = userEvent.setup()
      
      render(
        <GameStateProvider>
          <TestComponent />
        </GameStateProvider>
      )
      
      const initialTime = parseInt(screen.getByTestId('time-remaining').textContent)
      
      await user.click(screen.getByTestId('update-time'))
      
      const updatedTime = parseInt(screen.getByTestId('time-remaining').textContent)
      expect(updatedTime).toBe(initialTime - 30)
    })

    it('should persist state changes across context updates', async () => {
      const user = userEvent.setup()
      const stateChanges = []
      
      render(
        <GameStateProvider>
          <TestComponent onStateChange={(state) => stateChanges.push(state)} />
        </GameStateProvider>
      )
      
      // Trigger multiple state changes
      await user.click(screen.getByTestId('add-evidence'))
      await user.click(screen.getByTestId('update-time'))
      
      await waitFor(() => {
        expect(stateChanges.length).toBeGreaterThan(2)
      })
      
      const finalState = stateChanges[stateChanges.length - 1]
      expect(finalState.state.evidenceCollected).toContain('test-evidence')
      expect(finalState.state.timeRemaining).toBeLessThan(2880)
    })
  })

  describe('EvidenceBoard Component', () => {
    const mockProps = {
      evidence: ['bloodstain', 'bracelet-charm', 'stab-wound'],
      leads: ['blood-analysis', 'phone-records'],
      suspects: ['Rachel Kim', 'Jordan Valez'],
      theoryBoardState: {
        cards: [],
        connections: [],
        boardScale: 1,
        boardOffset: { x: 0, y: 0 }
      },
      onStateChange: vi.fn(),
      onClose: vi.fn()
    }

    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should render without crashing', () => {
      render(<EvidenceBoard {...mockProps} />)
      expect(screen.getByTestId('evidence-board')).toBeInTheDocument()
    })

    it('should display evidence cards', () => {
      render(<EvidenceBoard {...mockProps} />)
      
      // Check for evidence cards
      expect(screen.getByText('Bloodstain')).toBeInTheDocument()
      expect(screen.getByText('Bracelet Charm')).toBeInTheDocument()
      expect(screen.getByText('Stab Wound')).toBeInTheDocument()
    })

    it('should display lead cards', () => {
      render(<EvidenceBoard {...mockProps} />)
      
      // Check for lead cards (formatted)
      expect(screen.getByText(/Blood Analysis/)).toBeInTheDocument()
      expect(screen.getByText(/Phone Records/)).toBeInTheDocument()
    })

    it('should display suspect cards', () => {
      render(<EvidenceBoard {...mockProps} />)
      
      // Check for suspect cards
      expect(screen.getByText('Rachel Kim')).toBeInTheDocument()
      expect(screen.getByText('Jordan Valez')).toBeInTheDocument()
    })

    it('should handle card drag operations', async () => {
      const user = userEvent.setup()
      render(<EvidenceBoard {...mockProps} />)
      
      const evidenceCard = screen.getByText('Bloodstain').closest('[data-testid^="card-"]')
      expect(evidenceCard).toBeInTheDocument()
      
      // Simulate mouse down for drag start
      fireEvent.mouseDown(evidenceCard, { clientX: 100, clientY: 100 })
      
      // Simulate mouse move for drag
      fireEvent.mouseMove(document, { clientX: 150, clientY: 150 })
      
      // Simulate mouse up for drag end
      fireEvent.mouseUp(document, { clientX: 150, clientY: 150 })
      
      // Should trigger state change
      expect(mockProps.onStateChange).toHaveBeenCalled()
    })

    it('should handle connection creation between cards', async () => {
      const user = userEvent.setup()
      render(<EvidenceBoard {...mockProps} />)
      
      // Find connect buttons
      const connectButtons = screen.getAllByTestId(/connect-button-/)
      expect(connectButtons.length).toBeGreaterThan(0)
      
      // Click first connect button
      await user.click(connectButtons[0])
      
      // Should enter connection mode
      expect(screen.getByTestId('connection-mode-indicator')).toBeInTheDocument()
      
      // Click second connect button to create connection
      if (connectButtons.length > 1) {
        await user.click(connectButtons[1])
        
        // Should create connection and update state
        expect(mockProps.onStateChange).toHaveBeenCalled()
      }
    })

    it('should handle board scaling', async () => {
      const user = userEvent.setup()
      render(<EvidenceBoard {...mockProps} />)
      
      const scaleControls = screen.getByTestId('scale-controls')
      const zoomInButton = screen.getByTestId('zoom-in')
      const zoomOutButton = screen.getByTestId('zoom-out')
      
      expect(scaleControls).toBeInTheDocument()
      
      await user.click(zoomInButton)
      expect(mockProps.onStateChange).toHaveBeenCalled()
      
      await user.click(zoomOutButton)
      expect(mockProps.onStateChange).toHaveBeenCalled()
    })

    it('should handle board reset', async () => {
      const user = userEvent.setup()
      render(<EvidenceBoard {...mockProps} />)
      
      const resetButton = screen.getByTestId('reset-board')
      
      await user.click(resetButton)
      
      // Should reset board state
      expect(mockProps.onStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          cards: expect.any(Array),
          connections: [],
          cardScale: 1
        })
      )
    })

    it('should close when close button clicked', async () => {
      const user = userEvent.setup()
      render(<EvidenceBoard {...mockProps} />)
      
      const closeButton = screen.getByTestId('close-evidence-board')
      
      await user.click(closeButton)
      
      expect(mockProps.onClose).toHaveBeenCalled()
    })

    it('should handle empty evidence/leads state', () => {
      const emptyProps = {
        ...mockProps,
        evidence: [],
        leads: [],
        suspects: []
      }
      
      render(<EvidenceBoard {...emptyProps} />)
      
      // Should still render board
      expect(screen.getByTestId('evidence-board')).toBeInTheDocument()
      
      // Should show empty state message
      expect(screen.getByText(/No evidence collected yet/)).toBeInTheDocument()
    })

    it('should persist card positions across re-renders', () => {
      const propsWithCards = {
        ...mockProps,
        theoryBoardState: {
          cards: [
            {
              id: 'evidence-bloodstain',
              type: 'evidence',
              title: 'Bloodstain',
              position: { x: 100, y: 200 }
            }
          ],
          connections: [],
          boardScale: 1,
          boardOffset: { x: 0, y: 0 }
        }
      }
      
      const { rerender } = render(<EvidenceBoard {...propsWithCards} />)
      
      // Check card exists at position
      const card = screen.getByText('Bloodstain').closest('[data-testid^="card-"]')
      expect(card).toBeInTheDocument()
      
      // Re-render with same props
      rerender(<EvidenceBoard {...propsWithCards} />)
      
      // Card should still exist
      expect(screen.getByText('Bloodstain')).toBeInTheDocument()
    })
  })

  describe('Component Integration with Game State', () => {
    it('should sync evidence board with game state changes', async () => {
      const user = userEvent.setup()
      let gameStateRef = null
      
      const TestWrapper = () => {
        const gameState = useGameState()
        gameStateRef = gameState
        
        return (
          <div>
            <button 
              data-testid="add-game-evidence"
              onClick={() => gameState.addEvidence('new-evidence')}
            >
              Add Evidence
            </button>
            <EvidenceBoard
              evidence={gameState.state.evidenceCollected}
              leads={[]}
              suspects={[]}
              theoryBoardState={{ cards: [], connections: [], boardScale: 1, boardOffset: { x: 0, y: 0 } }}
              onStateChange={() => {}}
              onClose={() => {}}
            />
          </div>
        )
      }
      
      render(
        <GameStateProvider>
          <TestWrapper />
        </GameStateProvider>
      )
      
      // Initially no evidence
      expect(screen.queryByText('New Evidence')).not.toBeInTheDocument()
      
      // Add evidence through game state
      await user.click(screen.getByTestId('add-game-evidence'))
      
      await waitFor(() => {
        expect(screen.getByText('New Evidence')).toBeInTheDocument()
      })
    })
  })
})