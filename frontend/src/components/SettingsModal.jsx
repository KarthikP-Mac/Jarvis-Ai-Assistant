import React, { useState } from 'react';
import { Settings, X, Eye, EyeOff, Save, Trash2 } from 'lucide-react';
import './SettingsModal.css';

export default function SettingsModal({ 
  isOpen, 
  onClose, 
  onSaveKeys, 
  onClearHistory, 
  wakeWordEnabled, 
  onToggleWakeWord,
  initialGroqKey,
  initialElevenKey 
}) {
  const [groqKey, setGroqKey] = useState(initialGroqKey || '');
  const [elevenKey, setElevenKey] = useState(initialElevenKey || '');
  const [showGroq, setShowGroq] = useState(false);
  const [showEleven, setShowEleven] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveKeys(groqKey, elevenKey);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel">
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <Settings className="w-5 h-5 icon-cyan spin-anim" />
            <span className="modal-title">SYSTEM CONFIGURATION MATRIX</span>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {/* Section 1: API Keys */}
          <div className="modal-section">
            <h3 className="section-title">API ACCESS CREDENTIALS</h3>
            <p className="section-desc">Credentials are saved locally in your browser cache and transmitted securely over WebSocket.</p>
            
            {/* Groq Key Input */}
            <div className="input-group">
              <label className="input-label">GROQ API KEY (REQUIRED FOR BRAIN/STT)</label>
              <div className="input-wrapper">
                <input
                  type={showGroq ? "text" : "password"}
                  value={groqKey}
                  onChange={(e) => setGroqKey(e.target.value)}
                  placeholder="gsk_..."
                  className="cyber-input"
                />
                <button 
                  type="button" 
                  onClick={() => setShowGroq(!showGroq)} 
                  className="input-visibility-btn"
                >
                  {showGroq ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* ElevenLabs Key Input */}
            <div className="input-group">
              <label className="input-label">ELEVENLABS API KEY (OPTIONAL CLOUD TTS)</label>
              <div className="input-wrapper">
                <input
                  type={showEleven ? "text" : "password"}
                  value={elevenKey}
                  onChange={(e) => setElevenKey(e.target.value)}
                  placeholder="Enter ElevenLabs API key for premium voices"
                  className="cyber-input"
                />
                <button 
                  type="button" 
                  onClick={() => setShowEleven(!showEleven)} 
                  className="input-visibility-btn"
                >
                  {showEleven ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="input-help">If empty, Jarvis uses the local Kokoro-82M synthesizer for English, and your device's native SpeechSynthesis for Hindi/Telugu (100% Free).</p>
            </div>
          </div>

          {/* Section 2: Wake Word Controls */}
          <div className="modal-section">
            <h3 className="section-title">WAKE-WORD RECOGNITION</h3>
            <div className="switch-group">
              <div>
                <label className="switch-label">MONITOR "HEY JARVIS" WORD</label>
                <p className="switch-desc">Allows Jarvis to listen in the background and activate when you say "Hey Jarvis" or "Jarvis".</p>
              </div>
              <button 
                onClick={onToggleWakeWord} 
                className={`cyber-button ${wakeWordEnabled ? 'active-glow' : 'inactive'}`}
              >
                {wakeWordEnabled ? 'ACTIVE MONITOR' : 'DISABLED'}
              </button>
            </div>
          </div>

          {/* Section 3: Commands */}
          <div className="modal-section">
            <h3 className="section-title">COGNITIVE SYSTEMS RESET</h3>
            <div className="flex-row justify-between">
              <span className="cmd-desc">Wipes conversation context memory, restarting conversation thread fresh.</span>
              <button onClick={onClearHistory} className="cyber-button btn-danger">
                <Trash2 className="w-4 h-4" />
                <span>RESET BRAIN</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="cyber-button" onClick={onClose}>
            CANCEL
          </button>
          <button className="cyber-button active-glow" onClick={handleSave}>
            <Save className="w-4 h-4" />
            <span>SAVE SETTINGS</span>
          </button>
        </div>
      </div>
    </div>
  );
}
