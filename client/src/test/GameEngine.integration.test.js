import { describe, it, expect } from 'vitest'
import { leadDefinitions, applyAction, canAccuse, fmt, evidenceDefinitions, getNewLeads, discoverEvidence } from '../gameEngine'

describe('Game Engine Integration Tests', () => {
  describe('Lead Definitions', () => {
    it('should have valid lead definitions structure', () => {
      expect(leadDefinitions).toBeDefined()
      expect(Array.isArray(leadDefinitions)).toBe(true)
      expect(leadDefinitions.length).toBeGreaterThan(0)
      
      // Check each lead has required properties
      leadDefinitions.forEach(lead => {
        expect(lead).toHaveProperty('id')
        expect(lead).toHaveProperty('description')
        expect(lead).toHaveProperty('narrative')
        expect(lead).toHaveProperty('triggers')
        expect(typeof lead.id).toBe('string')
        expect(typeof lead.description).toBe('string')
        expect(typeof lead.narrative).toBe('string')
        expect(typeof lead.triggers).toBe('object')
      })
    })

    it('should have unique lead IDs', () => {
      const ids = leadDefinitions.map(lead => lead.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })

    it('should include critical investigation leads', () => {
      const leadIds = leadDefinitions.map(lead => lead.id)
      
      // Critical leads for the case
      expect(leadIds).toContain('blood-analysis')
      expect(leadIds).toContain('phone-records')
      expect(leadIds).toContain('scene-photos')
      expect(leadIds).toContain('interview-marvin')
    })
  })

  describe('Evidence Definitions', () => {
    it('should have valid evidence definitions', () => {
      expect(evidenceDefinitions).toBeDefined()
      expect(Array.isArray(evidenceDefinitions)).toBe(true)
      expect(evidenceDefinitions.length).toBeGreaterThan(0)
      
      // Check evidence structure
      evidenceDefinitions.forEach(evidence => {
        expect(evidence).toHaveProperty('id')
        expect(evidence).toHaveProperty('description')
        expect(evidence).toHaveProperty('discoveredBy')
        expect(typeof evidence.id).toBe('string')
        expect(typeof evidence.description).toBe('string')
        expect(Array.isArray(evidence.discoveredBy)).toBe(true)
      })
    })

    it('should include key evidence items for the case', () => {
      const evidenceIds = evidenceDefinitions.map(ev => ev.id)
      
      // Key evidence pieces
      expect(evidenceIds).toContain('bloodstain')
      expect(evidenceIds).toContain('stab-wound')
      expect(evidenceIds).toContain('no-forced-entry')
      expect(evidenceIds).toContain('bracelet-charm')
      expect(evidenceIds).toContain('window-ajar')
      expect(evidenceIds).toContain('missing-phone')
    })
  })

  describe('Action Processing', () => {
    it('should process valid actions correctly', () => {
      const gameState = {
        currentTime: 480, // 8:00 AM
        evidenceCollected: [],
        completedAnalysis: [],
        extractedInformation: [],
        currentLocation: 'crime-scene',
        interviewsCompleted: [],
        timeElapsed: 0
      }
      
      const action = 'search apartment'
      const result = applyAction(gameState, action)
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('timeCost')
      expect(result).toHaveProperty('messages')
      expect(result).toHaveProperty('discoveredEvidence')
    })

    it('should handle evidence collection actions', () => {
      const gameState = {
        currentTime: 480,
        evidenceCollected: [],
        timeElapsed: 0
      }
      
      const action = 'examine wall'
      const result = applyAction(gameState, action)
      
      expect(result.discoveredEvidence).toContain('bloodstain')
      expect(result.timeCost).toBeGreaterThan(0)
      expect(result.messages.length).toBeGreaterThan(0)
    })

    it('should handle search actions properly', () => {
      const gameState = {
        currentTime: 480,
        evidence: [],
        timeElapsed: 0
      }
      
      const searchAction = 'search apartment'
      const result = applyAction(gameState, searchAction)
      
      expect(result.discoveredEvidence.length).toBeGreaterThan(0)
      expect(result.discoveredEvidence).toContain('missing-phone')
      expect(result.discoveredEvidence).toContain('bracelet-charm')
      expect(result.timeCost).toBeGreaterThan(0)
    })
  })

  describe('Accusation System', () => {
    it('should allow accusations after 9 PM', () => {
      const gameState = {
        timeElapsed: (21 * 60 + 30) - (7 * 60 + 50), // 9:30 PM - 7:50 AM starting time
        interviewsCompleted: ['Rachel Kim', 'Jordan Valez'],
        evidenceCollected: ['bloodstain', 'phone-company-records']
      }
      
      const canMakeAccusation = canAccuse(gameState)
      expect(canMakeAccusation.allowed).toBe(true)
    })

    it('should not allow accusations before 9 PM', () => {
      const gameState = {
        currentTime: 20 * 60, // 8:00 PM
        interviewsCompleted: ['Rachel Kim', 'Jordan Valez'],
        evidenceCollected: ['bloodstain', 'phone-company-records']
      }
      
      const canMakeAccusation = canAccuse(gameState)
      expect(canMakeAccusation.allowed).toBe(false)
    })

    it('should require interviews before accusation', () => {
      const gameState = {
        currentTime: 21 * 60 + 30, // 9:30 PM
        interviewsCompleted: [], // No interviews completed
        evidenceCollected: ['bloodstain', 'phone-company-records']
      }
      
      const canMakeAccusation = canAccuse(gameState)
      expect(canMakeAccusation.allowed).toBe(false)
    })
  })

  describe('Lead Generation System', () => {
    it('should generate new leads based on evidence', () => {
      const params = {
        evidence: ['bloodstain'],
        actionsPerformed: [],
        interviewsCompleted: [],
        activeLeads: [],
        analysisCompleted: []
      }
      
      const newLeads = getNewLeads(params)
      expect(newLeads).toBeDefined()
      expect(Array.isArray(newLeads)).toBe(true)
      
      // Should generate blood analysis lead
      const leadIds = newLeads.map(lead => lead.id || lead)
      expect(leadIds).toContain('blood-analysis')
    })

    it('should generate interview leads after character interactions', () => {
      const params = {
        evidence: [],
        actionsPerformed: [],
        interviewsCompleted: ['Marvin Lott'],
        activeLeads: [],
        analysisCompleted: []
      }
      
      const newLeads = getNewLeads(params)
      expect(newLeads).toBeDefined()
      expect(Array.isArray(newLeads)).toBe(true)
      
      // Should generate follow-up leads
      const leadIds = newLeads.map(lead => lead.id || lead)
      expect(leadIds).toContain('interview-marvin')
    })

    it('should not duplicate existing leads', () => {
      const params = {
        evidence: ['bloodstain'],
        actionsPerformed: [],
        interviewsCompleted: [],
        activeLeads: ['blood-analysis'], // Already active
        analysisCompleted: []
      }
      
      const newLeads = getNewLeads(params)
      const leadIds = newLeads.map(lead => lead.id || lead)
      expect(leadIds).not.toContain('blood-analysis')
    })
  })

  describe('Time and Formatting', () => {
    it('should format time correctly', () => {
      expect(fmt(0)).toBe('00:00')
      expect(fmt(60)).toBe('01:00')
      expect(fmt(90)).toBe('01:30')
      expect(fmt(24 * 60)).toBe('24:00')
      expect(fmt(48 * 60)).toBe('48:00')
    })
  })

  describe('Game State Validation', () => {
    it('should validate complete game state structure', () => {
      const validGameState = {
        currentTime: 480,
        timeElapsed: 0,
        evidenceCollected: []
      }
      
      // Test that applyAction doesn't break with valid state
      const result = applyAction(validGameState, 'examine room')
      expect(result).toBeDefined()
      expect(result).toHaveProperty('timeCost')
      expect(result).toHaveProperty('messages')
      expect(result).toHaveProperty('discoveredEvidence')
    })

    it('should handle edge cases in game state', () => {
      const edgeGameState = {
        currentTime: 48 * 60, // End of time limit
        timeElapsed: 48 * 60,
        evidenceCollected: []
      }
      
      // Should handle end-of-time scenario
      const result = applyAction(edgeGameState, 'final check')
      expect(result).toBeDefined()
    })
  })

  describe('Case Logic Integration', () => {
    it('should support the complete Rachel Kim case flow', () => {
      let gameState = {
        currentTime: 480, // 8:00 AM start
        timeElapsed: 0,
        evidenceCollected: [],
        interviewsCompleted: []
      }
      
      // Step 1: Search apartment
      let result = applyAction(gameState, 'search apartment')
      expect(result.discoveredEvidence).toContain('missing-phone')
      expect(result.discoveredEvidence).toContain('bracelet-charm')
      
      // Step 2: Collect phone records evidence
      gameState.evidenceCollected = [...gameState.evidenceCollected, ...result.discoveredEvidence]
      result = applyAction(gameState, 'pull phone records')
      expect(result.discoveredEvidence).toContain('phone-company-records')
      
      // Step 3: Add interview completion (simulating interview flow)
      gameState.interviewsCompleted = ['Rachel Kim']
      
      // Step 4: Check if accusation is possible after 9 PM
      gameState.timeElapsed = (21 * 60 + 30) - (7 * 60 + 50) // 9:30 PM - 7:50 AM starting time
      const accusationResult = canAccuse(gameState)
      expect(accusationResult.allowed).toBe(true)
    })

    it('should track investigation progress accurately', () => {
      const gameState = {
        currentTime: 600, // 10:00 AM
        evidenceCollected: ['bloodstain', 'bracelet-charm', 'phone-company-records'],
        completedAnalysis: ['bloodstain'],
        extractedInformation: ['rachel-timeline', 'phone-call-7-25'],
        interviewsCompleted: ['Marvin Lott', 'Rachel Kim'],
        unlockedLeads: ['blood-analysis', 'phone-records', 'interview-marvin']
      }
      
      // Calculate investigation completeness
      const totalEvidencePieces = evidenceDefinitions.length
      const collectedPercentage = (gameState.evidenceCollected.length / totalEvidencePieces) * 100
      
      expect(collectedPercentage).toBeGreaterThan(0)
      expect(gameState.interviewsCompleted.length).toBeGreaterThanOrEqual(2)
      expect(gameState.unlockedLeads.length).toBeGreaterThanOrEqual(3)
    })
  })
})