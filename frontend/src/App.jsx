import React, { useState, useEffect, useRef } from 'react';
import { Shield, Radio, Terminal, Settings, RefreshCw, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import ArcReactor from './components/ArcReactor';
import CaptionsHUD from './components/CaptionsHUD';
import VoiceSelector from './components/VoiceSelector';
import LanguageSelector from './components/LanguageSelector';
import SettingsModal from './components/SettingsModal';
import UserProfileModal from './components/UserProfileModal';
import { AudioPlayer } from './utils/audioPlayer';
import './App.css';

// Initialize audio player instance once
const player = new AudioPlayer();

export default function App() {
  // App States
  const [userText, setUserText] = useState('');
  const [jarvisText, setJarvisText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hudOpen, setHudOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [logs, setLogs] = useState([]);
  const [activeAction, setActiveAction] = useState(null);
  const [telemetryMinimized, setTelemetryMinimized] = useState(false);


  // Settings States
  const [language, setLanguage] = useState('auto');
  const [userName, setUserName] = useState('');
  const [userTitle, setUserTitle] = useState('Sir');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [welcomeName, setWelcomeName] = useState('');
  const [voice, setVoice] = useState('jarvis');
  const [wakeWordEnabled, setWakeWordEnabled] = useState(true);
  const [groqKey, setGroqKey] = useState('');
  const [elevenKey, setElevenKey] = useState('');
  const [detectedTimezone, setDetectedTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [detectedLocation, setDetectedLocation] = useState(null);

  // Detect location and timezone dynamically
  useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then(res => res.json())
      .then(data => {
        if (data.timezone) {
          setDetectedTimezone(data.timezone);
        }
        if (data.city) {
          const locStr = `${data.city}, ${data.country_name || data.country}`;
          setDetectedLocation(locStr);
          addLog(`Location synchronized: ${locStr} (${data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone})`, 'info');
        }
      })
      .catch((err) => {
        console.warn('IP-based location detection failed, using browser defaults:', err);
        addLog(`Location offline. Fallback timezone set: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`, 'info');
      });
  }, []);

  // Audio Recording & Analysis Refs
  const wsRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const speechRecognitionRef = useRef(null);
  const animationFrameRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Mirror critical states into refs so SpeechRecognition callbacks
  // (which are created once per instance) always read the latest values
  // instead of capturing stale closures.
  const isListeningRef = useRef(false);
  const isProcessingRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const wakeWordEnabledRef = useRef(true);

  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);
  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { wakeWordEnabledRef.current = wakeWordEnabled; }, [wakeWordEnabled]);

  // Load saved credentials from localStorage on mount
  useEffect(() => {
    const savedGroq = localStorage.getItem('jarvis_groq_key') || '';
    const savedEleven = localStorage.getItem('jarvis_eleven_key') || '';
    const savedWakeWord = localStorage.getItem('jarvis_wake_word');
    // Default to true if user has never set a preference
    const wakeWordDefault = savedWakeWord === null ? true : savedWakeWord === 'true';
    const savedLanguage = localStorage.getItem('jarvis_language') || 'auto';
    const savedVoice = localStorage.getItem('jarvis_voice') || 'jarvis';

    const savedName = localStorage.getItem('jarvis_user_name') || '';
    const savedTitle = localStorage.getItem('jarvis_user_title') || 'Sir';

    setGroqKey(savedGroq);
    setElevenKey(savedEleven);
    setWakeWordEnabled(wakeWordDefault);
    setLanguage(savedLanguage);
    setVoice(savedVoice);
    setUserName(savedName);
    setUserTitle(savedTitle);

    if (!savedName) {
      setShowOnboarding(true);
    } else {
      // Existing user on page reload — ask if they want to continue or start fresh
      setWelcomeName(savedName);
      setShowWelcomeBack(true);
    }

    addLog('System initialization complete. Core protocols online.', 'info');

    // Request notification permission for timers
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Setup Audio player finished callback
    player.onPlaybackFinished = () => {
      setIsSpeaking(false);
      addLog('Jarvis speech sequence completed.', 'info');
    };

    // When the user returns to this tab (e.g. after opening a suggested link),
    // ensure the wake-word monitor is running and the HUD is open.
    const handleWindowFocus = () => {
      setHudOpen(true);
      if (
        wakeWordEnabledRef.current &&
        !isListeningRef.current &&
        !isProcessingRef.current &&
        !isSpeakingRef.current &&
        !speechRecognitionRef.current
      ) {
        setTimeout(() => startWakeWordRecognition(), 600);
      }
    };
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
      cleanupAudio();
      stopWakeWordRecognition();
    };
  }, []);

  // Sync player robot mode when voice updates
  useEffect(() => {
    player.setRobotEffect(voice === 'robot');
  }, [voice]);

  // Connect & Reconnect WebSocket
  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
    // NOTE: userName/userTitle removed from deps to prevent reconnect storms on reset.
    // Profile updates are synced via syncConfig() instead.
  }, [groqKey, elevenKey, language, voice, detectedTimezone, detectedLocation]);

  // Handle Wake Word listener status
  // Block wake-word while any modal overlay is active to prevent browser crashes
  useEffect(() => {
    const anyModalOpen = showOnboarding || showWelcomeBack;
    if (wakeWordEnabled && !isListening && !isProcessing && !isSpeaking && !anyModalOpen) {
      startWakeWordRecognition();
    } else {
      stopWakeWordRecognition();
    }
  }, [wakeWordEnabled, isListening, isProcessing, isSpeaking, showOnboarding, showWelcomeBack]);

  const connectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    const wsUrl = process.env.NODE_ENV === 'development'
      ? `ws://${window.location.hostname}:7860/ws`
      : `${protocol}${window.location.host}/ws`;

    addLog(`Establishing uplink: Connecting to WebSocket at ${wsUrl}...`, 'info');

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (wsRef.current !== ws) return;
      setWsConnected(true);
      addLog('Uplink secured. Handshake synchronization initiated.', 'info');
      // Send initial settings payload
      ws.send(JSON.stringify({
        type: 'config',
        language: language,
        voice: voice,
        groq_key: groqKey || null,
        eleven_key: elevenKey || null,
        timezone: detectedTimezone,
        location: detectedLocation,
        user_name: userName || 'User',
        user_title: userTitle || 'Sir'
      }));
    };

    ws.onmessage = async (event) => {
      if (wsRef.current !== ws) return;
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'config_applied':
          addLog('Settings matrix applied on backend.', 'info');
          break;

        case 'processing_started':
          setIsProcessing(true);
          player.stop(); // Stop any current speech if user interrupts
          window.speechSynthesis.cancel();
          addLog('Ingesting response sequence...', 'info');
          break;

        case 'processing_ended':
          setIsProcessing(false);
          break;

        case 'user_transcription':
          setUserText(data.text);
          setJarvisText('');
          addLog(`Voice decoded: "${data.text}"`, 'user');
          break;

        case 'jarvis_sentence':
          setJarvisText(prev => prev ? prev + ' ' + data.text : data.text);
          break;

        case 'audio_chunk':
          if (data.tts_type === 'audio') {
            setIsSpeaking(true);
            player.playBase64Chunk(data.audio);
          } else if (data.tts_type === 'browser') {
            setIsSpeaking(true);
            speakBrowser(data.text, data.lang);
          }
          break;

        case 'action':
          // Always force-open HUD so action confirmation card is always visible
          setHudOpen(true);
          if (data.action === 'open_website') {
            addLog(`Executing Action: Opening ${data.site_name || 'website'}...`, 'info');
            setActiveAction({
              type: 'open_website',
              url: data.url,
              site_name: data.site_name,
              message: `Confirm opening ${data.site_name || 'website'} at: ${data.url}`
            });
            window.open(data.url, '_blank');
          } else if (data.action === 'web_search') {
            addLog(`Executing Action: Searching web for "${data.query}"...`, 'info');
            setActiveAction({
              type: 'web_search',
              query: data.query,
              message: `Confirm searching Google for: "${data.query}"`
            });
            window.open(`https://www.google.com/search?q=${encodeURIComponent(data.query)}`, '_blank');
          } else if (data.action === 'set_timer') {
            addLog(`Executing Action: Setting timer for ${data.seconds} seconds (${data.label || 'Timer'})...`, 'info');
            setTimeout(() => {
              if (Notification.permission === 'granted') {
                new Notification("Jarvis Notification", {
                  body: `Timer finished: ${data.label || 'Timer'}`
                });
              }
              playChime(true);
              addLog(`Timer Alert: "${data.label || 'Timer'}" finished!`, 'info');
            }, data.seconds * 1000);
          }
          break;


        case 'history_cleared':
          addLog('Jarvis context cache wiped clean.', 'info');
          break;

        case 'error':
          addLog(`Core Error: ${data.message}`, 'error');
          setIsProcessing(false);
          setIsListening(false);
          break;

        default:
          break;
      }
    };


    ws.onclose = () => {
      if (wsRef.current !== ws) return;
      setWsConnected(false);
      addLog('Uplink terminated. Retrying connection in 5 seconds...', 'error');
      setTimeout(() => {
        if (wsRef.current === ws) {
          connectWebSocket();
        }
      }, 5000);
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  };

  const addLog = (text, type = 'info') => {
    const timestamp = new Date().toTimeString().split(' ')[0];
    setLogs(prev => [{ time: timestamp, text, type }, ...prev.slice(0, 49)]);
  };

  // Browser-native speech synthesis fallback (Free multilingual engine)
  const speakBrowser = (text, lang) => {
    addLog(`Synthesizing response via device native voice (${lang})...`, 'info');

    // Stop speaking first
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1.0;

    // Match gender roughly
    const voices = window.speechSynthesis.getVoices();
    let matchingVoice = null;

    const langPrefix = lang.split('-')[0].toLowerCase();
    const langVoices = voices.filter(v => v.lang.toLowerCase().startsWith(langPrefix));

    if (langVoices.length > 0) {
      if (voice === 'friday') {
        // Look for female voice in specified language
        matchingVoice = langVoices.find(v =>
          v.name.toLowerCase().includes('female') ||
          v.name.toLowerCase().includes('zira') ||
          v.name.toLowerCase().includes('google') ||
          v.name.toLowerCase().includes('heera') ||
          v.name.toLowerCase().includes('shruti') ||
          v.name.toLowerCase().includes('kalpana')
        );
      } else {
        // Look for male voice
        matchingVoice = langVoices.find(v =>
          v.name.toLowerCase().includes('male') ||
          v.name.toLowerCase().includes('david') ||
          v.name.toLowerCase().includes('microsoft') ||
          v.name.toLowerCase().includes('ravi') ||
          v.name.toLowerCase().includes('mohan')
        );
      }

      // Fallback: if we filtered for gender but got nothing, use the first voice for this language
      if (!matchingVoice) {
        matchingVoice = langVoices[0];
      }
    }

    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      addLog('Device speech sequence completed.', 'info');
    };

    utterance.onerror = (e) => {
      console.error("Browser speech synthesis error:", e);
      setIsSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  // Wake-word recognition setup (Browser webkitSpeechRecognition)
  const startWakeWordRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (e) { }
      speechRecognitionRef.current = null;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'en-US';

    rec.onresult = (event) => {
      const lastIndex = event.results.length - 1;
      const result = event.results[lastIndex];
      const text = result[0].transcript.trim().toLowerCase();

      console.log(`Background monitor transcript: "${text}"`);

      if (text.includes('jarvis') || text.includes('hey jarvis') || text.includes('hi jarvis')) {
        addLog('Wake word "Jarvis" detected! Activating core...', 'info');
        playChime(true);
        // Stop recognition before starting recording to avoid mic conflicts
        try { rec.stop(); } catch (e) { }
        // Start recording after a short delay for the chime
        setTimeout(startRecording, 400);
      }
    };

    let lastRestartTime = 0;
    rec.onend = () => {
      // Prevent phantom/leak restarts of discarded instances
      if (speechRecognitionRef.current !== rec) {
        console.log('Obsolete wake-word monitor instance ended. Discarding.');
        return;
      }
      // Use refs to read latest state — avoids stale closure bug where
      // captured state values from creation time prevent restart.
      if (wakeWordEnabledRef.current && !isListeningRef.current && !isProcessingRef.current && !isSpeakingRef.current) {
        const now = Date.now();
        // Enforce a minimum of 1.5s between restarts to prevent infinite rapid loops that crash the browser
        const delay = Math.max(1500 - (now - lastRestartTime), 300);
        setTimeout(() => {
          // Re-check refs after delay — state may have changed
          if (speechRecognitionRef.current === rec && wakeWordEnabledRef.current && !isListeningRef.current && !isProcessingRef.current && !isSpeakingRef.current) {
            try {
              lastRestartTime = Date.now();
              rec.start();
              console.log('Wake-word monitor restarted.');
            } catch (e) {
              console.warn('Wake-word restart failed, will retry via useEffect:', e.message);
            }
          }
        }, delay);
      }
    };

    speechRecognitionRef.current = rec;
    try {
      rec.start();
      addLog('Wake-word monitor active. Listening for "Hey Jarvis"...', 'info');
    } catch (e) {
      console.error("Failed to start SpeechRecognition:", e);
    }
  };

  const stopWakeWordRecognition = () => {
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (e) { }
      speechRecognitionRef.current = null;
    }
  };

  const playChime = (isActive) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (isActive) {
        // Futuristic double beep
        osc.frequency.setValueAtTime(520, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.start();
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.0, audioCtx.currentTime + 0.25);
        osc.stop(audioCtx.currentTime + 0.3);
      } else {
        // Lower tone double beep
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.start();
        osc.frequency.setValueAtTime(330, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.0, audioCtx.currentTime + 0.25);
        osc.stop(audioCtx.currentTime + 0.3);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Start Voice capture
  const startRecording = async () => {
    // Use wsRef directly to avoid stale closure from wake word callbacks
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      addLog("Cannot record. WebSocket connection offline.", "error");
      return;
    }

    player.stop();
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setUserText('');
    setJarvisText('');
    setActiveAction(null);

    cleanupAudio();
    stopWakeWordRecognition(); // Pause background wake word

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      micStreamRef.current = stream;
      audioChunksRef.current = [];

      // Create MediaRecorder
      // Choose supported format
      let options = { mimeType: 'audio/webm' };
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/ogg' };
      }
      if (!MediaRecorder.isTypeSupported('audio/ogg')) {
        options = { mimeType: 'audio/mp4' };
      }

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        setIsListening(false);
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
        console.log(`Audio recording stopped. Blob size: ${audioBlob.size} bytes`);

        if (audioBlob.size > 1000) {
          const arrayBuffer = await audioBlob.arrayBuffer();
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(arrayBuffer);
            addLog("Voice payload uploaded. Invoking transcript processing...", "info");
          }
        } else {
          addLog("Payload empty or too short. Aborting upload.", "info");
        }

        cleanupAudio();
      };

      // Set up AudioContext analysis for VAD (silence) and visualizer
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64; // Small size for fast visualizer response
      source.connect(analyser);
      analyserRef.current = analyser;

      // Start recording
      recorder.start(100); // Trigger data available every 100ms
      setIsListening(true);
      addLog("Microphone capture active. Speak now.", "info");

      // Start VAD Silence detection loop & Visualizer loop
      startSilenceDetectionLoop();
      startVisualizerLoop();

    } catch (error) {
      console.error("Microphone access failed:", error);
      addLog("Microphone access denied or failed. Please check permissions.", "error");
      setIsListening(false);
    }
  };

  // Stop Recording manually
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      playChime(false);
    }
  };

  const handleArcClick = () => {
    setActiveAction(null);
    if (isListening) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Silence Detection Loop (VAD)
  const startSilenceDetectionLoop = () => {
    if (!analyserRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let lastSpokenTime = Date.now();

    const checkSilence = () => {
      // Use refs directly to avoid stale closure - mediaRecorderRef is always current
      const isRecording = mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording';
      if (!isRecording || !analyserRef.current) return;

      analyserRef.current.getByteTimeDomainData(dataArray);

      // Calculate Root Mean Square (RMS) volume
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const value = (dataArray[i] - 128) / 128;
        sum += value * value;
      }
      const rms = Math.sqrt(sum / bufferLength);

      // Volume threshold for silence detection
      const volumeThreshold = 0.012;
      const silenceTimeout = 1800; // 1.8 seconds of silence

      if (rms > volumeThreshold) {
        lastSpokenTime = Date.now(); // Reset timer if volume is above threshold
      } else {
        const timeSinceSpeech = Date.now() - lastSpokenTime;
        if (timeSinceSpeech > silenceTimeout) {
          addLog("Silence detected. Auto-stopping capture...", "info");
          stopRecording();
          return;
        }
      }

      silenceTimerRef.current = setTimeout(checkSilence, 100);
    };

    checkSilence();
  };

  // Visualizer loop: Modulate heights of visualizer bars directly in DOM for 60fps performance
  const startVisualizerLoop = () => {
    if (!analyserRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const bars = document.querySelectorAll('.visualizer-bar');

    const draw = () => {
      if (!analyserRef.current) return;

      analyserRef.current.getByteFrequencyData(dataArray);

      // Distribute frequency bins to the 10 visualizer bars
      for (let i = 0; i < bars.length; i++) {
        const dataIndex = Math.floor((i / bars.length) * bufferLength);
        const value = dataArray[dataIndex];
        const height = Math.max(4, Math.min(40, (value / 255) * 40));

        if (bars[i]) {
          bars[i].style.height = `${height}px`;
        }
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
  };

  const cleanupAudio = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      if (audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  };

  const syncConfig = (overrides = {}) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const payload = {
        type: 'config',
        language: overrides.language !== undefined ? overrides.language : language,
        voice: overrides.voice !== undefined ? overrides.voice : voice,
        groq_key: overrides.groqKey !== undefined ? overrides.groqKey : (groqKey || null),
        eleven_key: overrides.elevenKey !== undefined ? overrides.elevenKey : (elevenKey || null),
        user_name: overrides.userName !== undefined ? overrides.userName : (userName || 'User'),
        user_title: overrides.userTitle !== undefined ? overrides.userTitle : (userTitle || 'Sir')
      };
      wsRef.current.send(JSON.stringify(payload));
    }
  };

  // Save Settings Modal API Keys and User Profile
  const handleSaveKeys = (newGroqKey, newElevenKey, newUserName, newUserTitle) => {
    setGroqKey(newGroqKey);
    setElevenKey(newElevenKey);
    setUserName(newUserName);
    setUserTitle(newUserTitle);
    localStorage.setItem('jarvis_groq_key', newGroqKey);
    localStorage.setItem('jarvis_eleven_key', newElevenKey);
    localStorage.setItem('jarvis_user_name', newUserName);
    localStorage.setItem('jarvis_user_title', newUserTitle);

    addLog('API keys and user profile updated in local memory storage.', 'info');
    syncConfig({ 
      groqKey: newGroqKey, 
      elevenKey: newElevenKey, 
      userName: newUserName, 
      userTitle: newUserTitle 
    });
  };

  // Save onboarding settings
  const handleSaveOnboarding = (name, title) => {
    setUserName(name);
    setUserTitle(title);
    localStorage.setItem('jarvis_user_name', name);
    localStorage.setItem('jarvis_user_title', title);
    setShowOnboarding(false);
    
    addLog(`Cognitive profile initialized: Welcome ${title !== 'none' ? title : ''} ${name}`, 'info');
    
    // Force sync settings to backend immediately
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'config',
        language: language,
        voice: voice,
        groq_key: groqKey || null,
        eleven_key: elevenKey || null,
        timezone: detectedTimezone,
        location: detectedLocation,
        user_name: name,
        user_title: title
      }));
    }
  };

  // Toggle Background Wake Word
  const handleToggleWakeWord = () => {
    const nextState = !wakeWordEnabled;
    setWakeWordEnabled(nextState);
    localStorage.setItem('jarvis_wake_word', nextState ? 'true' : 'false');
    addLog(`Wake-word monitor toggled: ${nextState ? 'ACTIVE' : 'DISABLED'}`, 'info');
  };

  // Full identity reset — wipes all localStorage, clears HUD, and re-shows onboarding
  const handleResetIdentity = () => {
    // Stop any active audio/speech immediately
    player.stop();
    window.speechSynthesis.cancel();
    stopWakeWordRecognition();

    localStorage.removeItem('jarvis_user_name');
    localStorage.removeItem('jarvis_user_title');
    localStorage.removeItem('jarvis_groq_key');
    localStorage.removeItem('jarvis_eleven_key');
    localStorage.removeItem('jarvis_wake_word');
    localStorage.removeItem('jarvis_language');
    localStorage.removeItem('jarvis_voice');

    // Reset all state
    setUserName('');
    setUserTitle('Sir');
    setGroqKey('');
    setElevenKey('');
    setWakeWordEnabled(true);
    setLanguage('auto');
    setVoice('jarvis');

    // Clear HUD display, subtitles, and logs
    setUserText('');
    setJarvisText('');
    setActiveAction(null);
    setLogs([]);
    setIsSpeaking(false);
    setIsProcessing(false);
    setIsListening(false);

    // Clear backend conversation history
    handleClearHistory();

    // Show onboarding for the new user
    setShowOnboarding(true);
  };

  // Welcome-back prompt handlers
  const handleWelcomeBack = (choice) => {
    setShowWelcomeBack(false);
    if (choice === 'continue') {
      addLog(`Welcome back, ${welcomeName}. Resuming previous session.`, 'info');
    } else {
      // Start fresh — full reset
      handleResetIdentity();
    }
  };

  // Clear Chat History on backend
  const handleClearHistory = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'clear_history' }));
    }
  };

  const handleLanguageChange = (val) => {
    setLanguage(val);
    localStorage.setItem('jarvis_language', val);
    addLog(`Multilingual router set to: ${val.toUpperCase()}`, 'info');
    syncConfig({ language: val });
  };

  const handleVoiceChange = (val) => {
    setVoice(val);
    localStorage.setItem('jarvis_voice', val);
    addLog(`Voice synthesis model mapped to: ${val.toUpperCase()}`, 'info');
    syncConfig({ voice: val });
  };

  return (
    <div className="app-container">
      {/* Sci-fi Holographic Header */}
      <header className="app-header glass-panel">
        <div className="brand-section">
          <Shield className="w-8 h-8 icon-cyan spin-anim" style={{ animationDuration: '60s' }} />
          <div>
            <h1 className="brand-title">JARVIS AI</h1>
            <span className="brand-version">PROJECT MAC • QUANTUM MIND</span>
          </div>
        </div>

        <div className="system-status">
          <div className="status-indicator">
            <span className={`status-dot ${wsConnected ? '' : 'disconnected'}`}></span>
            <span>UPLINK STATUS: {wsConnected ? 'SECURED' : 'OFFLINE'}</span>
          </div>

          <div className="header-actions">
            <button
              className="cyber-button"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="w-4 h-4" />
              <span>SETTINGS</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Responsive Grid Layout */}
      <div className="app-grid">

        {/* Main core interaction column */}
        <main className="main-column glass-panel widget-panel">
          <h2 className="widget-title">ARC REACTOR INTERACTION FIELD</h2>

          <div className="arc-shield">
            <ArcReactor
              isListening={isListening}
              isProcessing={isProcessing}
              isSpeaking={isSpeaking}
              onClick={handleArcClick}
            />
          </div>

          {/* Core active audio bars */}
          <div className={`visualizer-container ${isListening ? 'recording' : ''} ${isSpeaking ? 'speaking' : ''}`}>
            {[...Array(12)].map((_, i) => (
              <div key={i} className="visualizer-bar"></div>
            ))}
          </div>

          <div className="hud-container">
            <CaptionsHUD
              userText={userText}
              jarvisText={jarvisText}
              isOpen={hudOpen}
              onToggle={() => setHudOpen(!hudOpen)}
              isProcessing={isProcessing}
              isSpeaking={isSpeaking}
              activeAction={activeAction}
              onClearAction={() => setActiveAction(null)}
            />
          </div>
        </main>

        {/* Sidebar Controls Column */}
        <aside className="sidebar-column">

          {/* Controls Panel */}
          <section className="glass-panel widget-panel">
            <h2 className="widget-title">SYSTEM PROTOCOLS</h2>

            <VoiceSelector
              selectedVoice={voice}
              onChange={handleVoiceChange}
            />

            <div style={{ height: '20px' }}></div>

            <LanguageSelector
              selectedLanguage={language}
              onChange={handleLanguageChange}
            />
          </section>

          {/* Telemetry Console Panel */}
          <section className={`glass-panel widget-panel telemetry-panel ${telemetryMinimized ? 'minimized' : ''}`}>
            <h2 className="widget-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>HUD TELEMETRY LOGS</span>
              <button 
                onClick={() => setTelemetryMinimized(!telemetryMinimized)} 
                className="panel-toggle-btn"
                style={{ background: 'none', border: 'none', color: 'var(--neon-cyan)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
                title={telemetryMinimized ? "Expand Logs" : "Minimize Logs"}
              >
                {telemetryMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </h2>
            {!telemetryMinimized && (
              <div className="telemetry-log">
                {logs.length === 0 ? (
                  <div className="log-entry">
                    <span className="timestamp">[00:00:00]</span>
                    <span>SYSTEM SLEEP... Awaiting activity stream.</span>
                  </div>
                ) : (
                  logs.map((log, index) => (
                    <div
                      key={index}
                      className={`log-entry ${index === 0 && log.type === 'info' ? 'active-log' : ''} ${log.type === 'error' ? 'error-log' : ''}`}
                    >
                      <span className="timestamp">[{log.time}]</span>
                      <span>{log.text}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>
        </aside>
      </div>

      {/* Settings Modal overlay */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaveKeys={handleSaveKeys}
        onResetIdentity={handleResetIdentity}
        wakeWordEnabled={wakeWordEnabled}
        onToggleWakeWord={handleToggleWakeWord}
        initialGroqKey={groqKey}
        initialElevenKey={elevenKey}
        initialUserName={userName}
        initialUserTitle={userTitle}
      />

      {/* User Onboarding Profile Modal */}
      <UserProfileModal
        isOpen={showOnboarding}
        onSave={handleSaveOnboarding}
      />

      {/* Welcome Back prompt on page reload */}
      {showWelcomeBack && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-content glass-panel" style={{ maxWidth: 460, textAlign: 'center' }}>
            <div className="modal-header" style={{ justifyContent: 'center', borderBottom: 'none' }}>
              <span className="modal-title">SESSION RECOVERY DETECTED</span>
            </div>
            <div className="modal-body" style={{ alignItems: 'center', gap: 16 }}>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                Welcome back, <strong style={{ color: 'var(--neon-cyan)' }}>{welcomeName}</strong>. 
                A previous identity session was found in local memory.
              </p>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem' }}>
                Would you like to continue with your saved profile, or start fresh as a new user?
              </p>
              <div className="flex-row" style={{ gap: 12, marginTop: 8 }}>
                <button
                  className="cyber-button active-glow"
                  onClick={() => handleWelcomeBack('continue')}
                  style={{ flex: 1 }}
                >
                  CONTINUE SESSION
                </button>
                <button
                  className="cyber-button btn-warning"
                  onClick={() => handleWelcomeBack('fresh')}
                  style={{ flex: 1 }}
                >
                  START FRESH
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
