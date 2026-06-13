import sys
# Reconfigure stdout/stderr to use UTF-8 encoding on Windows to prevent UnicodeEncodeError (charmap codec errors)
if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        pass

import os
import io
import re
import json
import base64
import asyncio
from typing import Dict, List, Optional
import numpy as np
import soundfile as sf
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from groq import Groq
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables from .env file in the same directory as this script
_env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=_env_path)

# Validate loaded keys at startup
_groq_key = os.getenv("GROQ_API_KEY", "")
_eleven_key = os.getenv("ELEVEN_LABS_API_KEY", "")
# Clear placeholder values
if _eleven_key and _eleven_key.startswith("your_"):
    os.environ.pop("ELEVEN_LABS_API_KEY", None)
    print("ELEVEN_LABS_API_KEY placeholder detected and ignored.")
if _groq_key:
    print(f"GROQ_API_KEY loaded from .env: {_groq_key[:8]}...{_groq_key[-4:]}")
else:
    print("WARNING: No GROQ_API_KEY found in .env file. Users must provide it via the Settings panel.")

app = FastAPI(title="Jarvis AI Voice Assistant")

# Initialize Kokoro-82M ONNX model if files exist
from kokoro_onnx import Kokoro

MODEL_DIR = "model"
MODEL_PATH = os.path.join(MODEL_DIR, "kokoro-v1.0.onnx")
VOICES_PATH = os.path.join(MODEL_DIR, "voices-v1.0.bin")

kokoro_engine: Optional[Kokoro] = None
if os.path.exists(MODEL_PATH) and os.path.exists(VOICES_PATH):
    try:
        kokoro_engine = Kokoro(MODEL_PATH, VOICES_PATH)
        print("Kokoro-82M ONNX engine loaded successfully.")
    except Exception as e:
        print(f"Failed to load Kokoro-82M engine: {e}")
else:
    print("Kokoro-82M files not found in model/ directory. Local TTS will be unavailable (browser SpeechSynthesis fallback will be used).")

# System prompt for Jarvis
SYSTEM_PROMPT = """You are JARVIS, a highly sophisticated, polite, and witty AI voice assistant inspired by Iron Man's JARVIS. 
Follow these strict instructions:
1. Analyze the language of the user's input:
   - If they speak English, reply in English.
   - If they speak Hindi, reply in Hindi (using Devanagari script).
   - If they speak Telugu, reply in Telugu (using Telugu script).
   - If they speak Hinglish (Hindi blended with English, written in English/Latin letters), reply in Hinglish.
   - If they speak Teluglish (Telugu blended with English, written in English/Latin letters), reply in Teluglish.
2. Voice optimization: Keep replies highly concise, natural, and conversational (usually 1-2 sentences, maximum 3).
3. No Markdown: Do not output bold (**), italics (*), lists, bullet points, headers, or emojis. Write out numbers as words if possible.
4. Maintain the JARVIS persona: speak with a helpful, sophisticated British-styled tone, and call the user 'Sir' or 'Ma'am' when appropriate.
"""

# Tool schemas for Llama 3.3 function calling
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_current_time",
            "description": "Get the current date and time.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "open_website",
            "description": "Open a website or application URL in the user's browser, e.g. YouTube, Google, Facebook, etc.",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "The exact URL to open, starting with http:// or https:// (e.g. 'https://www.youtube.com')."
                    },
                    "site_name": {
                        "type": "string",
                        "description": "The name of the site (e.g. 'YouTube')."
                    }
                },
                "required": ["url", "site_name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "Search the web/Google for general information or search queries.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query query string."
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get the current weather for a specific location.",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "City name and/or country, e.g., 'Hyderabad', 'New York, USA'."
                    }
                },
                "required": ["location"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "set_timer",
            "description": "Set a countdown timer for a specific duration in seconds.",
            "parameters": {
                "type": "object",
                "properties": {
                    "seconds": {
                        "type": "integer",
                        "description": "Duration of the timer in seconds."
                    },
                    "label": {
                        "type": "string",
                        "description": "Optional label for the timer, e.g., 'cooking'."
                    }
                },
                "required": ["seconds"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "calculate",
            "description": "Evaluate a mathematical or arithmetical expression.",
            "parameters": {
                "type": "object",
                "properties": {
                    "expression": {
                        "type": "string",
                        "description": "The math expression to calculate, e.g., '245 * 18 + 10'."
                    }
                },
                "required": ["expression"]
            }
        }
    }
]

async def get_weather(location: str) -> str:
    """Fetch current weather from wttr.in."""
    try:
        import httpx
        encoded_loc = location.strip().replace(" ", "+")
        async with httpx.AsyncClient() as client:
            response = await client.get(f"https://wttr.in/{encoded_loc}?format=%C,+%t", timeout=5.0)
            if response.status_code == 200:
                result = response.text.strip()
                return f"Weather in {location}: {result}"
            else:
                return f"Could not fetch weather. wttr.in returned code {response.status_code}"
    except Exception as e:
        return f"Error fetching weather: {str(e)}"

def calculate(expression: str) -> str:
    """Safely evaluate a mathematical expression."""
    if not re.match(r"^[0-9\+\-\*\/\%\(\)\.\s]+$", expression):
        return "Error: Invalid characters in math expression. Only standard arithmetic operations are allowed."
    try:
        res = eval(expression, {"__builtins__": None}, {})
        return f"Result: {res}"
    except Exception as e:
        return f"Calculation error: {str(e)}"


def detect_native_language(text: str) -> str:
    """Detect if the text contains Hindi (Devanagari) or Telugu scripts."""
    # Devanagari range: \u0900-\u097f
    if any('\u0900' <= c <= '\u097f' for c in text):
        return "hi-IN"
    # Telugu range: \u0c00-\u0c7f
    if any('\u0c00' <= c <= '\u0c7f' for c in text):
        return "te-IN"
    return "en-US"

def parse_sentences(text_stream):
    """Yields clean sentences from a streaming text generator to enable sentence-level TTS streaming."""
    buffer = ""
    # Look for sentence boundary markers: period, exclamation, question, or Hindi/Telugu full-stops (।)
    sentence_endings = re.compile(r'([.!?।\n])\s*')
    
    for token in text_stream:
        if not token:
            continue
        buffer += token
        
        while True:
            match = sentence_endings.search(buffer)
            if not match:
                break
            
            # Extract sentence up to the ending marker
            end_idx = match.end()
            sentence = buffer[:end_idx].strip()
            buffer = buffer[end_idx:]
            
            if sentence:
                yield sentence
                
    if buffer.strip():
        yield buffer.strip()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("New WebSocket connection established.")
    
    # Store chat history for multi-turn conversation
    chat_history: List[Dict[str, str]] = [
        {"role": "system", "content": SYSTEM_PROMPT}
    ]
    
    # Config states
    selected_language = "auto"
    selected_voice = "jarvis" # jarvis, friday, robot
    custom_groq_key = None
    custom_eleven_key = None
    
    try:
        while True:
            # Receive message (can be text/config or binary audio blob)
            message = await websocket.receive()
            
            if "text" in message:
                # Parse config or JSON commands
                data = json.loads(message["text"])
                msg_type = data.get("type")
                
                if msg_type == "config":
                    selected_language = data.get("language", selected_language)
                    selected_voice = data.get("voice", selected_voice)
                    custom_groq_key = data.get("groq_key")
                    custom_eleven_key = data.get("eleven_key")
                    print(f"Config updated: lang={selected_language}, voice={selected_voice}")
                    await websocket.send_json({"type": "config_applied"})
                    
                elif msg_type == "clear_history":
                    chat_history = [{"role": "system", "content": SYSTEM_PROMPT}]
                    print("Conversation history cleared.")
                    await websocket.send_json({"type": "history_cleared"})
                    
            elif "bytes" in message:
                audio_bytes = message["bytes"]
                if not audio_bytes or len(audio_bytes) < 100:
                    continue
                
                print(f"Received audio blob: {len(audio_bytes)} bytes. Processing...")
                await websocket.send_json({"type": "processing_started"})
                
                # Get Groq client - prefer user-provided key from Settings UI, fallback to .env
                groq_key = custom_groq_key or os.getenv("GROQ_API_KEY")
                print(f"Using Groq key source: {'Settings UI' if custom_groq_key else '.env file'} -> {groq_key[:8] if groq_key else 'NONE'}...")
                if not groq_key:
                    await websocket.send_json({
                        "type": "error", 
                        "message": "Groq API Key is missing. Please add it in the Settings panel."
                    })
                    continue
                
                try:
                    groq_client = Groq(api_key=groq_key)
                except Exception as e:
                    await websocket.send_json({"type": "error", "message": f"Groq client init failed: {str(e)}"})
                    continue
                
                # 1. Speech-to-Text (STT)
                try:
                    # Whisper API expects a file-like object
                    audio_file = io.BytesIO(audio_bytes)
                    audio_file.name = "audio.webm"
                    
                    stt_params = {
                        "file": audio_file,
                        "model": "whisper-large-v3-turbo",
                    }
                    # Send explicit language code to bypass detection delay if configured
                    if selected_language in ["en", "hi", "te"]:
                        stt_params["language"] = selected_language
                        
                    transcription = groq_client.audio.transcriptions.create(**stt_params)
                    user_text = transcription.text
                    print(f"User Transcribed: {user_text}")
                    
                    if not user_text.strip():
                        await websocket.send_json({"type": "processing_ended"})
                        continue
                        
                    await websocket.send_json({"type": "user_transcription", "text": user_text})
                    
                except WebSocketDisconnect:
                    raise
                except Exception as e:
                    print(f"Transcription error: {e}")
                    await websocket.send_json({"type": "error", "message": f"Transcription failed: {str(e)}"})
                    continue
                
                # Append user prompt to history
                chat_history.append({"role": "user", "content": user_text})
                # 2. LLM Reasoning with Hybrid Model Routing
                try:
                    # First completion call: non-streaming using llama-3.1-8b-instant
                    # at temperature 0.0 to ensure deterministic, valid tool calls.
                    completion = groq_client.chat.completions.create(
                        messages=chat_history,
                        model="llama-3.1-8b-instant",
                        temperature=0.0,
                        tools=TOOLS,
                        tool_choice="auto"
                    )
                    
                    response_message = completion.choices[0].message
                    tool_calls = response_message.tool_calls
                    
                    has_called_tools = False
                    
                    if tool_calls:
                        has_called_tools = True
                        
                        # Convert response message to a dictionary to avoid serialization errors later
                        assistant_msg = {"role": "assistant", "content": response_message.content or ""}
                        assistant_msg["tool_calls"] = [
                            {
                                "id": tc.id,
                                "type": tc.type,
                                "function": {
                                    "name": tc.function.name,
                                    "arguments": tc.function.arguments
                                }
                            }
                            for tc in tool_calls
                        ]
                        chat_history.append(assistant_msg)
                        
                        for tool_call in tool_calls:
                            function_name = tool_call.function.name
                            function_args = json.loads(tool_call.function.arguments)
                            print(f"Executing tool: {function_name} with args: {function_args}")
                            
                            tool_result = ""
                            try:
                                if function_name == "get_current_time":
                                    from datetime import datetime
                                    tool_result = datetime.now().strftime("%A, %B %d, %Y at %I:%M %p")
                                elif function_name == "get_weather":
                                    location = function_args.get("location", "")
                                    tool_result = await get_weather(location)
                                elif function_name == "calculate":
                                    expr = function_args.get("expression", "")
                                    tool_result = calculate(expr)
                                elif function_name == "open_website":
                                    url = function_args.get("url", "")
                                    site_name = function_args.get("site_name", "")
                                    # Send action signal to frontend
                                    await websocket.send_json({
                                        "type": "action",
                                        "action": "open_website",
                                        "url": url,
                                        "site_name": site_name
                                    })
                                    tool_result = f"Successfully triggered opening of {site_name} in frontend."
                                elif function_name == "web_search":
                                    query = function_args.get("query", "")
                                    # Send action signal to frontend
                                    await websocket.send_json({
                                        "type": "action",
                                        "action": "web_search",
                                        "query": query
                                    })
                                    tool_result = f"Successfully triggered web search for '{query}' in frontend."
                                elif function_name == "set_timer":
                                    seconds = function_args.get("seconds", 0)
                                    label = function_args.get("label", "Timer")
                                    # Send action signal to frontend
                                    await websocket.send_json({
                                        "type": "action",
                                        "action": "set_timer",
                                        "seconds": seconds,
                                        "label": label
                                    })
                                    tool_result = f"Successfully set a timer for {seconds} seconds."
                            except Exception as tool_err:
                                tool_result = f"Error executing tool: {str(tool_err)}"
                            
                            chat_history.append({
                                "role": "tool",
                                "tool_call_id": tool_call.id,
                                "name": function_name,
                                "content": tool_result
                            })
                            print(f"Tool execution complete. Result appended: {tool_result}")
                        
                        # Since we executed tools, get the final response from LLM using streaming
                        chat_completion = groq_client.chat.completions.create(
                            messages=chat_history,
                            model="llama-3.3-70b-versatile",
                            temperature=0.7,
                            stream=True
                        )
                        
                        def token_generator():
                            for chunk in chat_completion:
                                token = chunk.choices[0].delta.content
                                if token:
                                    yield token
                    else:
                        # No tools called. Query llama-3.3-70b-versatile directly for the chat response
                        chat_completion = groq_client.chat.completions.create(
                            messages=chat_history,
                            model="llama-3.3-70b-versatile",
                            temperature=0.7,
                            stream=True
                        )
                        
                        def token_generator():
                            for chunk in chat_completion:
                                token = chunk.choices[0].delta.content
                                if token:
                                    yield token
                    
                    full_response = ""
                    
                    # 3. Sentence-level Streaming TTS Pipeline
                    for sentence in parse_sentences(token_generator()):
                        if not sentence.strip():
                            continue
                            
                        full_response += " " + sentence
                        
                        # Send text updates to show live in captions HUD
                        await websocket.send_json({"type": "jarvis_sentence", "text": sentence})
                        
                        # Determine synthesis engine: ElevenLabs vs Kokoro vs Browser
                        detected_lang = detect_native_language(sentence)
                        eleven_key = custom_eleven_key or os.getenv("ELEVEN_LABS_API_KEY")
                        
                        if eleven_key:
                            # ElevenLabs Synthesis (Premium Cloud)
                            try:
                                import httpx
                                voice_id = "ErXwobaYiN019PkySvjV" # default British Male (Antoni)
                                if selected_voice == "friday":
                                    voice_id = "EXAVITQu4vr4xnSDxMaL" # Female (Bella)
                                    
                                url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream"
                                headers = {
                                    "xi-api-key": eleven_key,
                                    "Content-Type": "application/json"
                                }
                                payload = {
                                    "text": sentence,
                                    "model_id": "eleven_multilingual_v2",
                                    "voice_settings": {
                                        "stability": 0.5,
                                        "similarity_boost": 0.75
                                    }
                                }
                                
                                async with httpx.AsyncClient() as client:
                                    response = await client.post(url, json=payload, headers=headers, timeout=10.0)
                                    if response.status_code == 200:
                                        audio_b64 = base64.b64encode(response.content).decode("utf-8")
                                        await websocket.send_json({
                                            "type": "audio_chunk",
                                            "tts_type": "audio",
                                            "audio": audio_b64,
                                            "text": sentence
                                        })
                                    else:
                                        # Fallback on HTTP error
                                        raise Exception(f"ElevenLabs error code {response.status_code}")
                            except Exception as e:
                                print(f"ElevenLabs synthesis failed: {e}. Falling back...")
                                # Fall back to local Kokoro or browser
                                eleven_key = None
                                
                        if not eleven_key:
                            # Local / Free Synthesis route
                            if detected_lang in ["hi-IN", "te-IN"]:
                                # Multi-lingual fallback for Telugu and Hindi: Browser-native synthesis
                                await websocket.send_json({
                                    "type": "audio_chunk",
                                    "tts_type": "browser",
                                    "text": sentence,
                                    "lang": detected_lang
                                })
                            else:
                                # English synthesis: Local Kokoro-82M
                                if kokoro_engine:
                                    try:
                                        # Select voice
                                        voice_name = "bm_george" # Default British Male for Jarvis Classic
                                        if selected_voice == "friday":
                                            voice_name = "af_sarah" # Sleek Female
                                            
                                        # Generate raw samples
                                        samples, sample_rate = kokoro_engine.create(
                                            text=sentence,
                                            voice=voice_name,
                                            speed=1.0,
                                            lang="en-us"
                                        )
                                        
                                        # Convert numpy samples to WAV bytes
                                        wav_io = io.BytesIO()
                                        sf.write(wav_io, samples, sample_rate, format='WAV', subtype='PCM_16')
                                        audio_b64 = base64.b64encode(wav_io.getvalue()).decode("utf-8")
                                        
                                        await websocket.send_json({
                                            "type": "audio_chunk",
                                            "tts_type": "audio",
                                            "audio": audio_b64,
                                            "text": sentence
                                        })
                                    except Exception as e:
                                        print(f"Kokoro synthesis error: {e}")
                                        # Extreme fallback to browser SpeechSynthesis
                                        await websocket.send_json({
                                            "type": "audio_chunk",
                                            "tts_type": "browser",
                                            "text": sentence,
                                            "lang": "en-US"
                                        })
                                else:
                                    # Browser SpeechSynthesis fallback if model files are missing
                                    await websocket.send_json({
                                        "type": "audio_chunk",
                                        "tts_type": "browser",
                                        "text": sentence,
                                        "lang": "en-US"
                                    })
                                    
                    # Add Jarvis reply to memory
                    if has_called_tools:
                        chat_history.append({"role": "assistant", "content": full_response.strip()})
                    
                    await websocket.send_json({"type": "processing_ended"})
                    
                except WebSocketDisconnect:
                    raise
                except Exception as e:
                    print(f"LLM streaming error: {e}")
                    await websocket.send_json({"type": "error", "message": f"Brain response failed: {str(e)}"})
                    
    except WebSocketDisconnect:
        print("WebSocket client disconnected.")
    except Exception as e:
        print(f"WebSocket error: {e}")

# Mount static files (built from Vite)
if os.path.exists("static"):
    app.mount("/assets", StaticFiles(directory="static/assets"), name="assets")

@app.get("/")
async def serve_index():
    if os.path.exists("static/index.html"):
        return FileResponse("static/index.html")
    return HTMLResponse(
        """
        <html>
            <head>
                <title>Jarvis Assistant API</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #070b19; color: #00f0ff; text-align: center; padding-top: 100px; }
                    .container { max-width: 600px; margin: 0 auto; border: 1px solid #00f0ff; padding: 40px; border-radius: 12px; box-shadow: 0 0 20px rgba(0, 240, 255, 0.2); background: rgba(7, 11, 25, 0.85); }
                    h1 { color: #fff; text-shadow: 0 0 10px #00f0ff; }
                    p { color: #a5b4fc; line-height: 1.6; }
                    .status { display: inline-block; padding: 6px 12px; background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; color: #34d399; border-radius: 20px; font-weight: bold; margin-top: 15px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>JARVIS Monolithic Backend Running</h1>
                    <p>The Python FastAPI backend is operational, with WebSocket protocols online on <code>/ws</code>.</p>
                    <p>To run the full holographic interface, make sure to compile the React frontend under <code>frontend/dist</code>.</p>
                    <span class="status">SYSTEM ONLINE</span>
                </div>
            </body>
        </html>
        """
    )

@app.get("/{fallback_path:path}")
async def fallback(fallback_path: str):
    static_file = os.path.join("static", fallback_path)
    if os.path.exists(static_file) and os.path.isfile(static_file):
        return FileResponse(static_file)
    if os.path.exists("static/index.html"):
        return FileResponse("static/index.html")
    raise HTTPException(status_code=404, detail="Resource Not Found")
