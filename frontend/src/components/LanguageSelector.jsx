import React from 'react';
import { Languages } from 'lucide-react';

export default function LanguageSelector({ selectedLanguage, onChange }) {
  return (
    <div className="control-group">
      <label className="control-label">
        <Languages className="w-4 h-4 icon-cyan" />
        <span>MULTILINGUAL PIPELINE</span>
      </label>
      <select 
        value={selectedLanguage} 
        onChange={(e) => onChange(e.target.value)}
        className="cyber-select"
      >
        <option value="auto">AUTO-DETECT LANGUAGE (DEFAULT)</option>
        <option value="en">ENGLISH // NATIVE PIPELINE</option>
        <option value="hi">HINDI // हिन्दी PIPELINE</option>
        <option value="te">TELUGU // తెలుగు PIPELINE</option>
      </select>
    </div>
  );
}
