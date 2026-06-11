import os
import shutil
from huggingface_hub import hf_hub_download

def download_kokoro_model():
    model_dir = "model"
    os.makedirs(model_dir, exist_ok=True)
    
    print("Initializing Kokoro-82M model download from Hugging Face...")
    
    # Download the ONNX model
    onnx_dest = os.path.join(model_dir, "kokoro-v1.0.onnx")
    if not os.path.exists(onnx_dest):
        print("Downloading kokoro-v1.0.onnx...")
        #  onnx_cached = hf_hub_download(repo_id="hexgrad/Kokoro-82M", filename="kokoro-v1.0.onnx")
        onnx_cached = hf_hub_download(repo_id="leonelhs/kokoro-thewh1teagle", filename="kokoro-v1.0.onnx")
        shutil.copy(onnx_cached, onnx_dest)
        print(f"ONNX model saved to {onnx_dest}")
    else:
        print("ONNX model already exists.")
        
    # Download the voices configuration
    voices_dest = os.path.join(model_dir, "voices-v1.0.bin")
    if not os.path.exists(voices_dest):
        print("Downloading voices-v1.0.bin...")
        voices_cached = hf_hub_download(repo_id="leonelhs/kokoro-thewh1teagle", filename="voices-v1.0.bin")
        shutil.copy(voices_cached, voices_dest)
        print(f"Voices binary saved to {voices_dest}")
    else:
        print("Voices binary already exists.")
        
    print("Kokoro-82M download sequence complete!")

if __name__ == "__main__":
    download_kokoro_model()
