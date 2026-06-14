import React, { useState } from 'react';
import { User, ShieldAlert, Award } from 'lucide-react';
import './UserProfileModal.css';

export default function UserProfileModal({ isOpen, onSave }) {
  const [name, setName] = useState('');
  const [title, setTitle] = useState('Sir');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a name to initialize cognitive protocols.');
      return;
    }
    setError('');
    onSave(name.trim(), title);
  };

  return (
    <div className="modal-overlay modal-onboarding-overlay">
      <div className="modal-content glass-panel onboarding-content">
        {/* Header */}
        <div className="modal-header onboarding-header">
          <div className="modal-title-group">
            <User className="w-5 h-5 icon-cyan spin-anim" style={{ animationDuration: '10s' }} />
            <span className="modal-title">COGNITIVE PERSONALIZATION INITIALIZATION</span>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="modal-body onboarding-body">
          <div className="welcome-banner">
            <h3 className="welcome-title">WELCOME TO THE JARVIS COGNITIVE INTERFACE</h3>
            <p className="welcome-desc">
              To synchronize language models and adjust behavioral patterns, please configure your profile below. This determines how Jarvis will address you during voice interactions.
            </p>
          </div>

          {error && (
            <div className="error-banner flex-row">
              <ShieldAlert className="w-5 h-5 icon-red" />
              <span className="error-text">{error}</span>
            </div>
          )}

          {/* User Name */}
          <div className="input-group">
            <label className="input-label">COGNITIVE SUBJECT IDENTIFIER (NAME)</label>
            <div className="input-wrapper">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name (e.g., Tony Stark)"
                className="cyber-input"
                autoFocus
              />
            </div>
            <p className="input-help">What should Jarvis call you in conversation?</p>
          </div>

          {/* User Title / Greeting */}
          <div className="input-group">
            <label className="input-label">PREFERRED PREFATORY PROTOCOL (TITLE/HONORIFIC)</label>
            <div className="input-wrapper">
              <select
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="cyber-input select-cyber"
              >
                <option value="Sir">Sir (Default Male response)</option>
                <option value="Ma'am">Ma'am (Polite response for female subjects)</option>
                <option value="Boss">Boss (Casual/Empowered)</option>
                <option value="Friend">Friend (Warm/Casual)</option>
                <option value="Dr.">Doctor (Academic)</option>
                <option value="none">No Title (Direct address by name)</option>
              </select>
            </div>
            <p className="input-help">How Jarvis should prefix sentences when speaking to you.</p>
          </div>

          <div className="modal-footer onboarding-footer">
            <button type="submit" className="cyber-button active-glow w-full flex-row justify-center">
              <Award className="w-4 h-4" />
              <span>INITIALIZE IDENTITY PROTOCOLS</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
