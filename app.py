"""
app.py — Flask web server for StegoDetect.

Routes:
  GET  /                → Web UI
  POST /predict         → Upload file → run inference → return JSON
  POST /predict_url     → Fetch image from URL → run inference → return JSON
                          (used by the Chrome extension)
"""
import os
import io
import requests
from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
from PIL import Image

from predict import predict_image, predict_from_bytes

# ── App setup ──────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(
    __name__,
    template_folder=os.path.join(BASE_DIR, "templates"),
    static_folder=os.path.join(BASE_DIR, "static"),
)
CORS(app)  # allow extension at different origin to call this API

# Allowed image extensions
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "bmp", "gif", "webp", "pgm"}
MAX_CONTENT_LENGTH = 20 * 1024 * 1024  # 20 MB
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH


def _allowed(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/predict", methods=["POST"])
def predict():
    """Accepts multipart/form-data with field 'image'."""
    if "image" not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400
    if not _allowed(file.filename):
        return jsonify({"error": "Unsupported file type"}), 415

    try:
        img_bytes = file.read()
        pil_img   = Image.open(io.BytesIO(img_bytes))
        result    = predict_image(pil_img)
        result["filename"] = file.filename
        return jsonify(result)
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 503
    except Exception as e:
        return jsonify({"error": f"Inference failed: {str(e)}"}), 500


@app.route("/predict_url", methods=["POST"])
def predict_url():
    """
    Accepts JSON: {"url": "https://..."}
    Used by the Chrome extension to scan a download before it completes.
    """
    data = request.get_json(silent=True)
    if not data or "url" not in data:
        return jsonify({"error": "JSON body with 'url' key required"}), 400

    url = data["url"]
    try:
        headers = {"User-Agent": "Mozilla/5.0 StegoDetect/1.0"}
        resp = requests.get(url, timeout=15, headers=headers, stream=True)
        if resp.status_code != 200:
            return jsonify({"error": f"Could not fetch image (HTTP {resp.status_code})"}), 400

        content_type = resp.headers.get("Content-Type", "")
        if "image" not in content_type and not any(
            url.lower().endswith(f".{ext}") for ext in ALLOWED_EXTENSIONS
        ):
            return jsonify({"error": "URL does not point to an image"}), 400

        img_bytes = resp.content
        result    = predict_from_bytes(img_bytes)
        result["url"] = url
        return jsonify(result)
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 503
    except requests.exceptions.Timeout:
        return jsonify({"error": "Request timed out fetching image"}), 408
    except Exception as e:
        return jsonify({"error": f"Inference failed: {str(e)}"}), 500


@app.route("/status")
def status():
    """Health-check used by the extension popup."""
    return jsonify({"status": "ok", "model": "StegoNet"})


# ── Entry point ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 55)
    print("  StegoDetect Flask Server")
    print("  Open http://localhost:5000 in your browser")
    print("=" * 55)
    app.run(host="0.0.0.0", port=5000, debug=False)
