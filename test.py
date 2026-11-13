from PIL import Image
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
img = Image.open(os.path.join(BASE_DIR, "BOSSbase_png", "1.png"))
img.show()