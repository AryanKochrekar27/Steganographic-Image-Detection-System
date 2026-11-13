# StegoDetect - Deep Learning Steganalysis & Detection System

StegoDetect is a deep learning-based image steganography detection system inspired by specialized steganalysis architectures (such as XuNet). It detects microscopic noise anomalies introduced by Least Significant Bit (LSB) steganography in images using a fixed High-Pass Filter (KV filter) combined with a convolutional neural network.

The project includes:
- **StegoNet Architecture**: Specialized CNN with frozen high-pass filtering (`KVFilter`) to suppress macroscopic visual content and expose steganographic noise residuals.
- **Dataset Pipeline**: Scripts to convert raw `.pgm` datasets (BOSSbase), inject LSB payload data, and partition into train/validation/test sets.
- **Flask Inference API**: Web server providing endpoints for single-image file uploads and direct URL scanning.
- **Web UI & Chrome Extension**: Interactive dashboard and browser extension for real-time image scanning before downloads complete.
- **Pretrained Checkpoint**: Includes `checkpoints/best_model.pth` ready for immediate inference.

---

## Architecture & How It Works

1. **Noise Residual Extraction**: Standard CNNs fail at steganalysis because they look for visual objects. StegoNet employs a fixed, non-trainable $5 \times 5$ **KV high-pass filter** followed by an absolute value operation to reveal high-frequency noise residuals.
2. **Feature Extraction**: 4 convolutional blocks with Batch Normalization and Average Pooling aggregate spatial noise statistics across the image.
3. **Classification**: Global Average Pooling and a Dropout-regularized Dense layer classify the input into **Cover** (clean) or **Stego** (payload hidden), providing confidence probabilities.

---

## Project Structure

```text
Steg/
├── checkpoints/
│   └── best_model.pth          # Pretrained StegoNet weights (~1.6 MB)
├── extension/                  # Chrome extension for real-time web image scanning
│   ├── manifest.json
│   ├── background.js
│   ├── popup.html
│   └── popup.js
├── static/                     # Web UI styles and scripts
│   ├── style.css
│   └── app.js
├── templates/                  # Web UI HTML template
│   └── index.html
├── app.py                      # Flask web application & API server
├── model.py                    # StegoNet & KVFilter PyTorch definition
├── predict.py                  # Standalone inference module
├── train.py                    # Full training loop
├── train_fast.py               # Fast validation script on dataset subsets
├── dataset.py                  # Custom PyTorch Dataset loader
├── split_data.py               # Dataset splitting utility
├── stego_gen.py                # LSB payload generation script
├── convert.py                  # PGM to PNG image converter
├── run.bat                     # Windows one-click start script
├── requirements.txt            # Python dependencies
└── project_summary.md          # Project development history & phase summary
```

---

## Installation & Setup

### 1. Prerequisites
- Python 3.10+ (Python 3.12 / 3.13 recommended)
- NVIDIA GPU with CUDA support (optional, CPU fallback is supported)

### 2. Create and Activate Virtual Environment
Isolating dependencies ensures other Python projects on your machine remain unaffected:

```bash
# Windows (PowerShell)
python -m venv venv
.\venv\Scripts\Activate.ps1

# Windows (Command Prompt)
python -m venv venv
venv\Scripts\activate.bat

# Linux / macOS
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

---

## Usage

### Run the Web Server
Launch the Flask application:
```bash
python app.py
```
Or double-click `run.bat` on Windows. The server runs at `http://localhost:5000`.

### CLI Inference
To test an image directly from the command line:
```bash
python predict.py path/to/image.png
```

### API Endpoints
- `GET /` — Serves the interactive web interface.
- `GET /status` — Health check endpoint returning `{"status": "ok", "model": "StegoNet"}`.
- `POST /predict` — Accepts multipart form data with key `image` and returns classification probabilities.
- `POST /predict_url` — Accepts JSON `{"url": "https://example.com/image.png"}` to scan remote images (used by the Chrome extension).

---

## Chrome Extension
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select the `extension/` directory.
4. Ensure the Flask server is running on `http://localhost:5000` to handle inspection requests.

---

## License
MIT License

