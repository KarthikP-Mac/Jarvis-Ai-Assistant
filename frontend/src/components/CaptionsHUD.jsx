import React, { useRef, useEffect } from 'react';
import { Terminal, MessageSquare, Mic, Disc } from 'lucide-react';
import './CaptionsHUD.css';

export default function CaptionsHUD({ userText, jarvisText, isOpen, onToggle, isProcessing, isSpeaking }) {
  const scrollRef = useRef(null);

  // Automatically scroll captions container to bottom on new text
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [userText, jarvisText]);

  if (!isOpen) {
    return (
      <button className="hud-collapsed-trigger" onClick={onToggle}>
        <Terminal className="w-5 h-5 icon-cyan" />
        <span>OPEN HUD RECOGNITION</span>
      </button>
    );
  }

  return (
    <div className="hud-panel glass-panel">
      {/* HUD Header */}
      <div className="hud-header">
        <div className="hud-title-group">
          <Disc className={`w-4 h-4 ${isSpeaking || isProcessing ? 'spin-anim icon-orange' : 'icon-cyan'}`} />
          <span className="hud-title">HUD DISPLAY // SUBTITLE CONSOLE</span>
        </div>
        <button className="hud-close-btn" onClick={onToggle}>
          MINIMIZE
        </button>
      </div>

      {/* Screen contents */}
      <div className="hud-viewport" ref={scrollRef}>
        <div className="hud-grid-background"></div>

        {/* User Output Section */}
        {userText && (
          <div className="hud-speech-block user-block">
            <div className="hud-speaker-tag">
              <Mic className="w-3.5 h-3.5" />
              <span>USER VOICE DETECTED</span>
            </div>
            <p className="hud-text">{userText}</p>
          </div>
        )}

        {/* Jarvis Output Section */}
        {jarvisText && (
          <div className="hud-speech-block jarvis-block">
            <div className="hud-speaker-tag">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>JARVIS RESPONSE ACTIVE</span>
            </div>
            <p className="hud-text typewriter-effect">{jarvisText}</p>
          </div>
        )}

        {/* Processing Indicator */}
        {isProcessing && !jarvisText && (
          <div className="hud-status-block">
            <span className="hud-blink-dot"></span>
            <span className="hud-status-text">DECODING COGNITIVE SYNAPSE...</span>
          </div>
        )}

        {!userText && !jarvisText && !isProcessing && (
          <div className="hud-empty-state">
            <p className="hud-console-prompt">Awaiting input signal... Speak "Hey Jarvis" or tap the Arc Core.</p>
          </div>
        )}
      </div>
    </div>
  );
}
