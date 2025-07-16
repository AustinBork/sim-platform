// Typewriter Sound Effects System
// Generates authentic typewriter sounds using Web Audio API

class TypewriterSounds {
  constructor() {
    this.audioContext = null;
    this.enabled = true;
    this.volume = 0.3;
    this.init();
  }

  init() {
    try {
      // Initialize Web Audio Context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (error) {
      console.warn('Web Audio API not supported:', error);
      this.enabled = false;
    }
  }

  // Resume audio context (required for Chrome autoplay policy)
  async resume() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  // Generate typewriter key click sound
  playKeyClick(character = 'normal') {
    if (!this.enabled || !this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    const filterNode = this.audioContext.createBiquadFilter();

    // Different sound profiles for different characters
    const profiles = {
      'normal': { 
        frequency: 800, 
        duration: 0.08, 
        volume: 0.15,
        filterFreq: 2000
      },
      'Navarro': { 
        frequency: 650, 
        duration: 0.12, 
        volume: 0.18,
        filterFreq: 1500
      },
      'Detective': { 
        frequency: 900, 
        duration: 0.06, 
        volume: 0.12,
        filterFreq: 2500
      },
      'System': { 
        frequency: 1000, 
        duration: 0.05, 
        volume: 0.08,
        filterFreq: 3000
      }
    };

    const profile = profiles[character] || profiles.normal;

    // Configure oscillator
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(profile.frequency, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      profile.frequency * 0.7, 
      this.audioContext.currentTime + profile.duration
    );

    // Configure filter for more realistic sound
    filterNode.type = 'lowpass';
    filterNode.frequency.setValueAtTime(profile.filterFreq, this.audioContext.currentTime);
    filterNode.Q.setValueAtTime(2, this.audioContext.currentTime);

    // Configure gain (volume)
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(
      profile.volume * this.volume, 
      this.audioContext.currentTime + 0.01
    );
    gainNode.gain.exponentialRampToValueAtTime(
      0.001, 
      this.audioContext.currentTime + profile.duration
    );

    // Connect audio nodes
    oscillator.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    // Play sound
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + profile.duration);
  }

  // Generate carriage return "ding" sound
  playCarriageReturn() {
    if (!this.enabled || !this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(1200, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(800, this.audioContext.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.2 * this.volume, this.audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.15);

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.15);
  }

  // Generate space bar sound (slightly different from regular keys)
  playSpaceBar() {
    if (!this.enabled || !this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    const filterNode = this.audioContext.createBiquadFilter();

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(200, this.audioContext.currentTime + 0.1);

    filterNode.type = 'lowpass';
    filterNode.frequency.setValueAtTime(800, this.audioContext.currentTime);

    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.1 * this.volume, this.audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.1);

    oscillator.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.1);
  }

  // Set volume (0-1)
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  // Toggle sound on/off
  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  // Enable/disable sounds
  setEnabled(enabled) {
    this.enabled = enabled;
  }
}

// Create singleton instance
const typewriterSounds = new TypewriterSounds();

export default typewriterSounds;