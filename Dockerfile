# Stage 1: Build React frontend static assets
FROM node:18-slim AS frontend-builder
WORKDIR /frontend
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Run Python FastAPI app
FROM python:3.10-slim
WORKDIR /app

# Install system audio dependencies (libsndfile1 is mandatory for soundfile package)
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy and install python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy model downloader and run download sequence to pre-bake model into image
COPY download_model.py ./
RUN python download_model.py

# Copy built React frontend assets from Stage 1
COPY --from=frontend-builder /frontend/dist ./static

# Copy FastAPI backend code
COPY main.py ./

# Hugging Face Spaces runs on port 7860
EXPOSE 7860

# Run Uvicorn server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
