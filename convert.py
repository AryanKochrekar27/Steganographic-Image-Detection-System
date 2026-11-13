from PIL import Image
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
input_folder = os.path.join(BASE_DIR, "BOSSbase_pgm")
output_folder = os.path.join(BASE_DIR, "BOSSbase_png")

os.makedirs(output_folder, exist_ok=True)

for file in os.listdir(input_folder):
    if file.endswith(".pgm"):
        img = Image.open(os.path.join(input_folder, file))
        img = img.convert("L")  # grayscale
        img.save(os.path.join(output_folder, file.replace(".pgm", ".png")))