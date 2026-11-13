import os
import numpy as np
from PIL import Image
from tqdm import tqdm

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
input_folder = os.path.join(BASE_DIR, "BOSSbase_png")
stego_folder = os.path.join(BASE_DIR, "stego_images")

os.makedirs(stego_folder, exist_ok=True)

# 20% payload embedding rate
EMBEDDING_RATE = 0.20

print(f"Generating Stego images with {EMBEDDING_RATE*100}% LSB embedding rate...")
for file in tqdm(os.listdir(input_folder)):
    if not file.endswith(".png"):
        continue
    
    path = os.path.join(input_folder, file)
    
    # Open image as Grayscale (L)
    try:
        img = Image.open(path).convert("L")
    except Exception as e:
        print(f"Skipping {file}: {e}")
        continue
        
    img_array = np.array(img, dtype=np.uint8)
    
    # Calculate how many pixels to modify
    total_pixels = img_array.size
    pixels_to_modify = int(total_pixels * EMBEDDING_RATE)
    
    # Randomly select indices to modify
    flat_array = img_array.flatten()
    modify_indices = np.random.choice(total_pixels, pixels_to_modify, replace=False)
    
    # Generate random bits (0 or 1) for the payload
    random_bits = np.random.randint(0, 2, size=pixels_to_modify, dtype=np.uint8)
    
    # Clear the LSB of the selected pixels (bitwise AND with 254)
    flat_array[modify_indices] = flat_array[modify_indices] & 254
    
    # Set the LSB to the random bits (bitwise OR)
    flat_array[modify_indices] = flat_array[modify_indices] | random_bits
    
    # Reshape back to original image shape
    stego_array = flat_array.reshape(img_array.shape)
    
    # Save as PNG
    stego_img = Image.fromarray(stego_array, mode="L")
    stego_img.save(os.path.join(stego_folder, file))

print("Stego generation complete!")