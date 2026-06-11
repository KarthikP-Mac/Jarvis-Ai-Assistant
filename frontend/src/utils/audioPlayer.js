export class AudioPlayer {
  constructor() {
    this.audioContext = null;
    this.queue = [];
    this.isPlaying = false;
    this.robotEffect = false;
    this.currentSource = null;
    this.onPlaybackFinished = null;
  }

  init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  setRobotEffect(enabled) {
    this.robotEffect = enabled;
  }

  async playBase64Chunk(base64Data) {
    this.init();
    
    try {
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const audioBuffer = await this.audioContext.decodeAudioData(bytes.buffer);
      this.queue.push(audioBuffer);
      
      if (!this.isPlaying) {
        this.playNext();
      }
    } catch (error) {
      console.error("Failed to decode and queue audio chunk:", error);
    }
  }

  playNext() {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      if (this.onPlaybackFinished) {
        this.onPlaybackFinished();
      }
      return;
    }

    this.isPlaying = true;
    const audioBuffer = this.queue.shift();
    
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    this.currentSource = source;

    if (this.robotEffect) {
      // 1. Create a peaking biquad filter for metallic resonance
      const metalFilter = this.audioContext.createBiquadFilter();
      metalFilter.type = 'peaking';
      metalFilter.frequency.value = 1200; // Peak around high mids
      metalFilter.Q.value = 8;
      metalFilter.gain.value = 12;

      // 2. Create delay line for metallic echo/flange effect
      const delay = this.audioContext.createDelay();
      delay.delayTime.value = 0.015; // 15ms metallic latency
      
      const feedback = this.audioContext.createGain();
      feedback.gain.value = 0.35; // feedback volume
      
      // Hook up delay feedback loop
      delay.connect(feedback);
      feedback.connect(delay);

      // 3. Create Ring Modulator (Amplitude Modulation)
      // Carrier oscillator
      const carrier = this.audioContext.createOscillator();
      carrier.type = 'sine';
      carrier.frequency.value = 55; // 55Hz low pitch buzz
      
      // Modulator gain node
      const modulatorGain = this.audioContext.createGain();
      modulatorGain.gain.value = 0.0; // Initial gain modulated by carrier
      
      // Connect carrier to gain parameter to modulate it
      const carrierGain = this.audioContext.createGain();
      carrierGain.gain.value = 0.6; // Modulation depth (60%)
      carrier.connect(carrierGain);
      carrierGain.connect(modulatorGain.gain);

      // 4. Set up dry/wet signal mixing
      const dryMix = this.audioContext.createGain();
      dryMix.gain.value = 0.3; // 30% original voice
      
      const wetMix = this.audioContext.createGain();
      wetMix.gain.value = 0.7; // 70% modulated voice

      // Connections:
      // Source feeds metal filter & dry mix
      source.connect(metalFilter);
      source.connect(dryMix);

      // Metal filter feeds delay line & modulator input
      metalFilter.connect(delay);
      metalFilter.connect(modulatorGain);
      delay.connect(modulatorGain);

      // Modulator output feeds wet mix
      modulatorGain.connect(wetMix);

      // Connect mixers to output destination
      dryMix.connect(this.audioContext.destination);
      wetMix.connect(this.audioContext.destination);

      // Start carrier oscillator
      carrier.start();
      
      source.onended = () => {
        carrier.stop();
        this.playNext();
      };
    } else {
      // Normal direct playback routing
      source.connect(this.audioContext.destination);
      source.onended = () => {
        this.playNext();
      };
    }

    source.start(0);
  }

  stop() {
    this.queue = [];
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch (e) {
        // Source might have already stopped
      }
      this.currentSource = null;
    }
    this.isPlaying = false;
  }
}
