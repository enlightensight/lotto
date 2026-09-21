// POS Web Audio Synthesizer - Realistic Retail POS Feedback
class SoundFX {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  beep() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2100, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch (e) {
      // Audio context might be restricted before interaction
    }
  }

  success() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      [1046.5, 1318.5, 1567.98].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.07);
        gain.gain.setValueAtTime(0.15, now + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.15);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.07);
        osc.stop(now + i * 0.07 + 0.16);
      });
    } catch (e) {}
  }

  keypad() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.03);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.03);
    } catch (e) {}
  }

  alert() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.25);
    } catch (e) {}
  }

  chime() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.1);
        gain.gain.setValueAtTime(0.1, now + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.35);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.35);
      });
    } catch (e) {}
  }
}

export const sfx = new SoundFX();

// -------------------------------------------------------------
// Voice Guidance Speech Engine (HTML5 Web Speech API)
// -------------------------------------------------------------
class VoiceGuide {
  constructor() {
    this.enabled = true;
    this.voice = null;
    this.init();
  }

  init() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        this.voice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('David') || v.name.includes('Zira'))) || voices.find(v => v.lang.startsWith('en')) || null;
      };
      loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }

  speak(text, rate = 1.0) {
    if (!this.enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      if (this.voice) utt.voice = this.voice;
      utt.rate = rate;
      utt.pitch = 1.0;
      window.speechSynthesis.speak(utt);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  }

  speakStartScanning() {
    this.speak("Start scanning barcode", 1.05);
  }

  speakScanning() {
    this.speak("Scanning", 1.0);
  }

  speakRescan() {
    this.speak("Rescan barcode", 1.05);
  }

  speakDuplicateError() {
    this.speak("Technical error. This pack has been scanned.", 1.0);
  }

  speakInventoryUpdated() {
    this.speak("Inventory updated", 1.05);
  }

  speakBoxPrompt() {
    this.speak("Box number", 1.0);
  }

  speakBoxNumber(boxNum = 62) {
    this.speak(`Box number ${boxNum}`, 1.0);
  }

  speakEmptySlot() {
    this.speak("Empty slot. Please check the number of empty slots to activation.", 1.0);
  }

  speakReport() {
    this.speak("Report", 1.0);
  }

  speakUpdateInventory() {
    this.speak("Update inventory", 1.05);
  }

  speakTicket() {
    this.speak("Ticket", 1.0);
  }

  speakEmptySlotCheck(activations, emptySlots) {
    this.speak(`You have ${activations} Activation and ${emptySlots} Empty Slots. Please check the number of empty slots.`, 1.0);
  }

  speakMissedTicketFixed() {
    this.speak("Missed ticket is fixed.", 1.05);
  }

  speakReadyToSell(boxNum = 63) {
    this.speak(`Box number ${boxNum} ready to sell.`, 1.05);
  }

  speakBye() {
    this.speak("Bye", 1.0);
  }
}

export const voice = new VoiceGuide();

