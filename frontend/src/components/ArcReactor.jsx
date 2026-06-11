import React from 'react';
import './ArcReactor.css';

export default function ArcReactor({ isListening, isProcessing, isSpeaking, onClick }) {
  // Determine state class
  let stateClass = 'idle';
  if (isListening) stateClass = 'listening';
  else if (isProcessing) stateClass = 'processing';
  else if (isSpeaking) stateClass = 'speaking';

  return (
    <div className={`arc-container ${stateClass}`} onClick={onClick}>
      <div className="arc-reactor">
        {/* Layer 1: Outer glowing ring */}
        <div className="ring outer-ring"></div>
        
        {/* Layer 2: Ring with notch notches */}
        <div className="ring notch-ring"></div>
        
        {/* Layer 3: Power Cells (10 triangles) */}
        <svg className="power-cells-svg" viewBox="0 0 200 200">
          <defs>
            <linearGradient id="cell-glow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--neon-cyan)" />
              <stop offset="100%" stopColor="rgba(0, 240, 255, 0.2)" />
            </linearGradient>
            <linearGradient id="cell-glow-recording" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--neon-red)" />
              <stop offset="100%" stopColor="rgba(255, 0, 60, 0.2)" />
            </linearGradient>
          </defs>
          <g className="cells-group">
            {[...Array(10)].map((_, i) => {
              const angle = (i * 36) * (Math.PI / 180);
              const r1 = 62; // Inner radius
              const r2 = 82; // Outer radius
              
              // Define wedge corners
              const aStart = angle - 0.14;
              const aEnd = angle + 0.14;
              
              const x1 = 100 + r1 * Math.cos(aStart);
              const y1 = 100 + r1 * Math.sin(aStart);
              const x2 = 100 + r2 * Math.cos(aStart);
              const y2 = 100 + r2 * Math.sin(aStart);
              const x3 = 100 + r2 * Math.cos(aEnd);
              const y3 = 100 + r2 * Math.sin(aEnd);
              const x4 = 100 + r1 * Math.cos(aEnd);
              const y4 = 100 + r1 * Math.sin(aEnd);
              
              return (
                <polygon 
                  key={i} 
                  points={`${x1},${y1} ${x2},${y2} ${x3},${y3} ${x4},${y4}`} 
                  fill={isListening ? "url(#cell-glow-recording)" : "url(#cell-glow)"}
                  className="reactor-cell"
                  style={{ transformOrigin: '100px 100px' }}
                />
              );
            })}
          </g>
        </svg>

        {/* Layer 4: Inner spinning grid */}
        <div className="ring inner-spinner"></div>
        
        {/* Layer 5: Glowing Core center */}
        <div className="core-center">
          <div className="core-led"></div>
          {/* Futuristic crosshairs */}
          <div className="crosshair vertical"></div>
          <div className="crosshair horizontal"></div>
        </div>

        {/* Audio Wave Ring (only active when recording or speaking) */}
        {(isListening || isSpeaking) && (
          <>
            <div className="wave-ring wave-1"></div>
            <div className="wave-ring wave-2"></div>
          </>
        )}
      </div>
      
      {/* HUD status label below reactor */}
      <div className="reactor-hud-label">
        {isListening && <span className="status-text alert">SYSTEM RECORDING...</span>}
        {isProcessing && <span className="status-text warning">PARSING CONTEXT...</span>}
        {isSpeaking && <span className="status-text active">JARVIS SPEECH ACTIVE</span>}
        {!isListening && !isProcessing && !isSpeaking && (
          <span className="status-text idle">CLICK CORE TO ACTIVATE</span>
        )}
      </div>
    </div>
  );
}
