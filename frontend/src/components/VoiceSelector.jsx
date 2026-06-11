import React from 'react';
import { Volume2 } from 'lucide-react';

export default function VoiceSelector({ selectedVoice, onChange }) {
  return (
    <div className="control-group">
      <label className="control-label">
        <Volume2 className="w-4 h-4 icon-cyan" />
        <span>VOICE MATRIX TONE</span>
      </label>
      <select 
        value={selectedVoice} 
        onChange={(e) => onChange(e.target.value)}
        className="cyber-select"
      >
        <option value="jarvis">JARVIS CLASSIC // DEEP BRITISH MALE</option>
        <option value="friday">FRIDAY AI // SLEEK FEMALE COGNITIVE</option>
        <option value="robot">MECHANICAL ROBOT // DSP RING MODULATOR</option>
      </select>
    </div>
  );
}
