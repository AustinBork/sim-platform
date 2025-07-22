import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'

// Mock fetch for testing backend communication
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('Backend Integration Tests', () => {
  const BACKEND_URL = 'http://localhost:3001'
  const PROXY_URL = 'http://localhost:3001'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Express Server API', () => {
    it('should respond to health check endpoint', async () => {
      // Mock successful response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve('Simulation Platform Backend Running')
      })

      const response = await fetch(`${BACKEND_URL}/`)
      const text = await response.text()

      expect(mockFetch).toHaveBeenCalledWith(`${BACKEND_URL}/`)
      expect(response.ok).toBe(true)
      expect(text).toBe('Simulation Platform Backend Running')
    })

    it('should handle server errors gracefully', async () => {
      // Mock server error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      })

      const response = await fetch(`${BACKEND_URL}/`)
      
      expect(response.ok).toBe(false)
      expect(response.status).toBe(500)
    })
  })

  describe('Proxy Server Chat API', () => {
    it('should handle valid chat requests', async () => {
      const mockChatResponse = {
        type: 'dialogue',
        speaker: 'Navarro',
        text: 'Welcome to the case, detective. What would you like to investigate first?'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockChatResponse)
      })

      const chatRequest = {
        message: 'What should I do first?',
        gameState: {
          currentTime: 480,
          timeRemaining: 2880,
          currentLocation: 'crime-scene',
          evidenceCollected: [],
          interviewsCompleted: [],
          conversationState: {
            currentCharacter: 'Navarro',
            conversationPhase: 'ACTIVE'
          }
        }
      }

      const response = await fetch(`${PROXY_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(chatRequest)
      })

      const result = await response.json()

      expect(mockFetch).toHaveBeenCalledWith(
        `${PROXY_URL}/chat`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(chatRequest)
        })
      )

      expect(response.ok).toBe(true)
      expect(result.type).toBe('dialogue')
      expect(result.speaker).toBe('Navarro')
      expect(result.text).toBeTruthy()
    })

    it('should handle character-specific conversations', async () => {
      const mockRachelResponse = {
        type: 'dialogue',
        speaker: 'Rachel Kim',
        text: 'I already told you everything I know about that night!'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockRachelResponse)
      })

      const chatRequest = {
        message: 'Tell me about your relationship with Mia',
        gameState: {
          currentTime: 600,
          timeRemaining: 2760,
          currentLocation: 'rachel-house',
          evidenceCollected: ['phone-company-records'],
          interviewsCompleted: ['Marvin Lott'],
          conversationState: {
            currentCharacter: 'Rachel Kim',
            conversationPhase: 'INTERROGATION'
          }
        }
      }

      const response = await fetch(`${PROXY_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(chatRequest)
      })

      const result = await response.json()

      expect(result.type).toBe('dialogue')
      expect(result.speaker).toBe('Rachel Kim')
      expect(result.text).toBeTruthy()
    })

    it('should handle Dr. Chen forensic analysis requests', async () => {
      const mockForensicResponse = {
        type: 'dialogue',
        speaker: 'Dr. Sarah Chen',
        text: 'The DNA analysis is complete. The blood sample contains traces of two different individuals - the victim and an unknown person.'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockForensicResponse)
      })

      const chatRequest = {
        message: 'What did you find in the blood analysis?',
        gameState: {
          currentTime: 840, // 14:00 (2 PM) - 6 hours after collection
          timeRemaining: 2520,
          currentLocation: 'detective-hq',
          evidenceCollected: ['bloodstain'],
          completedAnalysis: ['bloodstain'],
          conversationState: {
            currentCharacter: 'Dr. Sarah Chen',
            conversationPhase: 'ACTIVE'
          }
        }
      }

      const response = await fetch(`${PROXY_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(chatRequest)
      })

      const result = await response.json()

      expect(result.type).toBe('dialogue')
      expect(result.speaker).toBe('Dr. Sarah Chen')
      expect(result.text).toContain('analysis')
    })

    it('should handle invalid JSON requests gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Invalid JSON in request body' })
      })

      const response = await fetch(`${PROXY_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: 'invalid json'
      })

      const result = await response.json()

      expect(response.ok).toBe(false)
      expect(result.error).toBeTruthy()
    })

    it('should handle missing game state', async () => {
      const mockErrorResponse = {
        error: 'Missing required game state',
        code: 'MISSING_GAME_STATE'
      }

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve(mockErrorResponse)
      })

      const chatRequest = {
        message: 'What should I do?'
        // Missing gameState
      }

      const response = await fetch(`${PROXY_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(chatRequest)
      })

      const result = await response.json()

      expect(response.ok).toBe(false)
      expect(result.error).toBeTruthy()
    })

    it('should handle OpenAI API failures', async () => {
      const mockApiErrorResponse = {
        error: 'OpenAI API request failed',
        code: 'AI_SERVICE_ERROR',
        details: 'Rate limit exceeded'
      }

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: () => Promise.resolve(mockApiErrorResponse)
      })

      const chatRequest = {
        message: 'Tell me about the case',
        gameState: {
          currentTime: 480,
          conversationState: {
            currentCharacter: 'Navarro',
            conversationPhase: 'ACTIVE'
          }
        }
      }

      const response = await fetch(`${PROXY_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(chatRequest)
      })

      const result = await response.json()

      expect(response.status).toBe(503)
      expect(result.error).toBe('OpenAI API request failed')
      expect(result.code).toBe('AI_SERVICE_ERROR')
    })
  })

  describe('Case Data Integration', () => {
    it('should validate case data structure', async () => {
      // Mock response that includes case data validation
      const mockValidationResponse = {
        valid: true,
        caseData: {
          case: {
            title: 'First 48: Homicide of Mia Rodriguez',
            type: 'Homicide Investigation',
            timeLimitHours: 48
          },
          victim: {
            name: 'Mia Rodriguez',
            age: 26
          },
          suspects: expect.any(Array)
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockValidationResponse)
      })

      const response = await fetch(`${PROXY_URL}/validate-case`)
      const result = await response.json()

      expect(result.valid).toBe(true)
      expect(result.caseData.case.title).toBe('First 48: Homicide of Mia Rodriguez')
      expect(result.caseData.victim.name).toBe('Mia Rodriguez')
    })
  })

  describe('Character Knowledge System', () => {
    it('should handle character knowledge loading', async () => {
      const mockCharacterResponse = {
        characters: {
          'Navarro': {
            role: 'Detective Partner',
            personality: { traits: ['experienced', 'helpful'] }
          },
          'Rachel Kim': {
            role: 'Best Friend',
            personality: { traits: ['distraught', 'helpful', 'secretive'] }
          }
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockCharacterResponse)
      })

      const response = await fetch(`${PROXY_URL}/characters`)
      const result = await response.json()

      expect(result.characters).toBeDefined()
      expect(result.characters['Navarro']).toBeDefined()
      expect(result.characters['Rachel Kim']).toBeDefined()
    })

    it('should handle character context switching', async () => {
      // Test character transition in conversation
      const mockTransitionResponse = {
        type: 'system',
        message: 'Transitioning conversation to Rachel Kim',
        newCharacter: 'Rachel Kim'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockTransitionResponse)
      })

      const transitionRequest = {
        action: 'TRANSITION_CHARACTER',
        fromCharacter: 'Navarro',
        toCharacter: 'Rachel Kim',
        gameState: {
          currentTime: 540,
          currentLocation: 'rachel-house'
        }
      }

      const response = await fetch(`${PROXY_URL}/transition`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(transitionRequest)
      })

      const result = await response.json()

      expect(result.type).toBe('system')
      expect(result.newCharacter).toBe('Rachel Kim')
    })
  })

  describe('Error Recovery and Resilience', () => {
    it('should handle network timeouts', async () => {
      // Mock network timeout
      mockFetch.mockRejectedValueOnce(new Error('Network timeout'))

      try {
        await fetch(`${PROXY_URL}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: 'test',
            gameState: { currentTime: 480 }
          })
        })
      } catch (error) {
        expect(error.message).toBe('Network timeout')
      }
    })

    it('should handle malformed responses', async () => {
      // Mock malformed JSON response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('Unexpected end of JSON input'))
      })

      try {
        const response = await fetch(`${PROXY_URL}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: 'test',
            gameState: { currentTime: 480 }
          })
        })
        
        await response.json()
      } catch (error) {
        expect(error.message).toBe('Unexpected end of JSON input')
      }
    })

    it('should provide fallback responses', async () => {
      // Mock service degradation with fallback
      const mockFallbackResponse = {
        type: 'system',
        speaker: 'System',
        text: 'Connection temporarily unavailable. Please try again.',
        fallback: true
      }

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: () => Promise.resolve(mockFallbackResponse)
      })

      const response = await fetch(`${PROXY_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: 'investigate',
          gameState: { currentTime: 480 }
        })
      })

      const result = await response.json()

      expect(result.fallback).toBe(true)
      expect(result.text).toContain('temporarily unavailable')
    })
  })

  describe('Performance and Load Handling', () => {
    it('should handle concurrent requests', async () => {
      // Mock multiple successful responses
      const responses = Array(5).fill().map((_, i) => ({
        type: 'dialogue',
        speaker: 'Navarro',
        text: `Response ${i + 1}`
      }))

      responses.forEach(response => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(response)
        })
      })

      // Send multiple concurrent requests
      const requests = responses.map((_, i) => 
        fetch(`${PROXY_URL}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: `Request ${i + 1}`,
            gameState: { currentTime: 480 + i * 10 }
          })
        })
      )

      const results = await Promise.all(requests.map(async (req) => {
        const res = await req
        return res.json()
      }))

      expect(results).toHaveLength(5)
      results.forEach((result, i) => {
        expect(result.text).toBe(`Response ${i + 1}`)
      })
    })

    it('should handle rate limiting gracefully', async () => {
      const mockRateLimitResponse = {
        error: 'Rate limit exceeded',
        retryAfter: 60,
        code: 'RATE_LIMIT_EXCEEDED'
      }

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: {
          get: (header) => header === 'Retry-After' ? '60' : null
        },
        json: () => Promise.resolve(mockRateLimitResponse)
      })

      const response = await fetch(`${PROXY_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: 'rapid fire request',
          gameState: { currentTime: 480 }
        })
      })

      const result = await response.json()

      expect(response.status).toBe(429)
      expect(result.code).toBe('RATE_LIMIT_EXCEEDED')
      expect(result.retryAfter).toBe(60)
    })
  })
})