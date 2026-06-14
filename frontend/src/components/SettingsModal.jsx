import React, { useState, useEffect } from 'react';
import { Settings, X, Eye, EyeOff, Save, UserRoundX } from 'lucide-react';
import './SettingsModal.css';

export default function SettingsModal({
  isOpen,
  onClose,
  onSaveKeys,
  onResetIdentity,
  wakeWordEnabled,
  onToggleWakeWord,
  initialGroqKey,
  initialElevenKey,
  initialUserName,
  initialUserTitle
}) {
  const [groqKey, setGroqKey] = useState(initialGroqKey || '');
  const [elevenKey, setElevenKey] = useState(initialElevenKey || '');
  const [userName, setUserName] = useState(initialUserName || '');
  const [userTitle, setUserTitle] = useState(initialUserTitle || 'Sir');
  const [showGroq, setShowGroq] = useState(false);
  const [showEleven, setShowEleven] = useState(false);

  // Sync internal state with external props whenever the modal is opened
  useEffect(() => {
    if (isOpen) {
      setGroqKey(initialGroqKey || '');
      setElevenKey(initialElevenKey || '');
      setUserName(initialUserName || '');
      setUserTitle(initialUserTitle || 'Sir');
    }
  }, [isOpen, initialGroqKey, initialElevenKey, initialUserName, initialUserTitle]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveKeys(groqKey, elevenKey, userName, userTitle);
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
                  placeholder="Enter GROQ API key"
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

          {/* Section: User Profile personalization */}
          <div className="modal-section">
            <h3 className="section-title">USER PROFILE CONFIGURATION</h3>
            <p className="section-desc">Personalize how Jarvis interacts and addresses you.</p>

            {/* User Name Input */}
            <div className="input-group">
              <label className="input-label">COGNITIVE SUBJECT NAME</label>
              <div className="input-wrapper">
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Enter your name"
                  className="cyber-input"
                />
              </div>
            </div>

            {/* Preferred Honorific Input */}
            <div className="input-group">
              <label className="input-label">PREFERRED PREFATORY PROTOCOL (TITLE)</label>
              <div className="input-wrapper">
                <select
                  value={userTitle}
                  onChange={(e) => setUserTitle(e.target.value)}
                  className="cyber-input select-cyber"
                >
                  <option value="Sir">Sir</option>
                  <option value="Ma'am">Ma'am</option>
                  <option value="Boss">Boss</option>
                  <option value="Friend">Friend</option>
                  <option value="Dr.">Doctor</option>
                  <option value="none">No Title (Address directly by name)</option>
                </select>
              </div>
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
                className={`cyber-button ${wakeWordEnabled ? 'active-glow' : 'btn-danger'}`}
                style={{ minWidth: '160px' }}
              >
                {wakeWordEnabled ? 'MONITOR: ACTIVE' : 'MONITOR: DISABLED'}
              </button>
            </div>
          </div>

          {/* Section 3: Full Identity Reset */}
          <div className="modal-section">
            <h3 className="section-title">IDENTITY PURGE</h3>
            <div className="flex-row justify-between">
              <span className="cmd-desc">Erases all saved data (name, title, API keys, preferences), wipes conversation memory, and re-launches the onboarding sequence. Use when switching users.</span>
              <button onClick={() => { onResetIdentity(); onClose(); }} className="cyber-button btn-warning">
                <UserRoundX className="w-4 h-4" />
                <span>RESET IDENTITY</span>
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
