import React, { useRef, useEffect } from 'react';
import { Terminal, MessageSquare, Mic, Disc } from 'lucide-react';
import './CaptionsHUD.css';

export default function CaptionsHUD({ userText, jarvisText, isOpen, onToggle, isProcessing, isSpeaking, activeAction, onClearAction }) {
  const scrollRef = useRef(null);

  // Automatically scroll captions container to bottom on new text
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [userText, jarvisText, activeAction]);

  // Scroll to bottom when the user returns to the tab after opening a link
  useEffect(() => {
    const handleFocus = () => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  if (!isOpen) {
    return (
      <button className="hud-collapsed-trigger" onClick={onToggle}>
        <Terminal className="w-5 h-5 icon-cyan" />
        <span>OPEN HUD RECOGNITION</span>
      </button>
    );
  }

  /**
   * Splits plain text into alternating text and clickable URL segments.
   * URLs (http/https) are rendered as neon-cyan anchor tags that open in a new tab.
   */
  const linkifyText = (text) => {
    if (!text) return null;
    const URL_RE = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(URL_RE);
    return parts.map((part, i) => {
      if (/^https?:\/\//.test(part)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'var(--neon-cyan)',
              textDecoration: 'underline',
              wordBreak: 'break-all',
              textShadow: '0 0 5px var(--neon-cyan)'
            }}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

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

        {/* Jarvis Output Section — URLs are rendered as clickable neon links */}
        {jarvisText && (
          <div className="hud-speech-block jarvis-block">
            <div className="hud-speaker-tag">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>JARVIS RESPONSE ACTIVE</span>
            </div>
            <p className="hud-text typewriter-effect">{linkifyText(jarvisText)}</p>
          </div>
        )}

        {/* Action Card Confirmation */}
        {activeAction && (
          <div className="hud-action-card">
            <div className="hud-action-title">ACTION REQUIRED // CONFIRM PROTOCOL</div>
            <p className="hud-action-desc">{activeAction.message}</p>
            <div className="hud-action-buttons">
              <button
                className="hud-action-btn confirm"
                onClick={() => {
                  if (activeAction.type === 'open_website') {
                    window.open(activeAction.url, '_blank');
                  } else if (activeAction.type === 'web_search') {
                    window.open(`https://www.google.com/search?q=${encodeURIComponent(activeAction.query)}`, '_blank');
                  }
                  onClearAction();
                }}
              >
                EXECUTE ACTION
              </button>
              <button className="hud-action-btn cancel" onClick={onClearAction}>
                DISMISS
              </button>
            </div>
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
