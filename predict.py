"""
predict.py — Standalone inference helper for StegoNet.
Used by Flask app and any CLI tools.
"""
import os
import io
import torch
from torchvision import transforms
from PIL import Image

from model import StegoNet

# ── Globals (loaded once) ──────────────────────────────────────────────────────
_model = None
_device = None

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CHECKPOINT_PATH = os.path.join(BASE_DIR, "checkpoints", "best_model.pth")

TRANSFORM = transforms.Compose([
    transforms.Grayscale(num_output_channels=1),
    transforms.CenterCrop(256),
    transforms.ToTensor(),
])


def _load_model():
    """Load model once and cache it."""
    global _model, _device
    if _model is not None:
        return _model, _device

    _device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    _model = StegoNet().to(_device)

    if not os.path.exists(CHECKPOINT_PATH):
        raise FileNotFoundError(
            f"No checkpoint at {CHECKPOINT_PATH}. Run train.py first."
        )

    _model.load_state_dict(
        torch.load(CHECKPOINT_PATH, map_location=_device, weights_only=True)
    )
    _model.eval()
    return _model, _device


def predict_image(pil_image: Image.Image) -> dict:
    """
    Run StegoNet inference on a PIL image.

    Returns:
        {
          "label":      "Cover" | "Stego",
          "is_stego":   bool,
          "confidence": float (0-100),
          "cover_prob": float (0-100),
          "stego_prob": float (0-100),
        }
    """
    model, device = _load_model()

    # Convert and transform
    img = pil_image.convert("L")                    # grayscale
    tensor = TRANSFORM(img).unsqueeze(0).to(device) # [1, 1, 256, 256]

    with torch.no_grad():
        logits = model(tensor)                      # [1, 2]
        probs  = torch.softmax(logits, dim=1)[0]    # [2]

    cover_prob = probs[0].item() * 100
    stego_prob = probs[1].item() * 100
    is_stego   = stego_prob > cover_prob

    return {
        "label":      "Stego" if is_stego else "Cover",
        "is_stego":   is_stego,
        "confidence": round(stego_prob if is_stego else cover_prob, 2),
        "cover_prob": round(cover_prob, 2),
        "stego_prob": round(stego_prob, 2),
    }


def predict_from_bytes(image_bytes: bytes) -> dict:
    """Run inference from raw image bytes."""
    img = Image.open(io.BytesIO(image_bytes))
    return predict_image(img)


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python predict.py <image_path>")
        sys.exit(1)
    img = Image.open(sys.argv[1])
    result = predict_image(img)
    print(f"Label     : {result['label']}")
    print(f"Confidence: {result['confidence']:.2f}%")
    print(f"Cover prob: {result['cover_prob']:.2f}%")
    print(f"Stego prob: {result['stego_prob']:.2f}%")
