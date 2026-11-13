import os
import shutil
import random

random.seed(42)

def split_dataset(base_dir, output_dir, train_ratio=0.7, val_ratio=0.15):
    cover_dir = os.path.join(base_dir, "cover")
    stego_dir = os.path.join(base_dir, "stego")
    
    if not os.path.exists(cover_dir) or not os.path.exists(stego_dir):
        print(f"Error: {cover_dir} or {stego_dir} not found.")
        return

    # Get all filenames
    # Assuming filenames match between cover and stego
    cover_files = set(f for f in os.listdir(cover_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg', '.pgm')))
    stego_files = set(f for f in os.listdir(stego_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg', '.pgm')))
    
    # Identify common files
    common_files = list(cover_files.intersection(stego_files))
    print(f"Found {len(common_files)} paired images.")
    
    # Identify unique files if any
    unique_cover = list(cover_files - stego_files)
    unique_stego = list(stego_files - cover_files)
    if unique_cover or unique_stego:
        print(f"Warning: Found {len(unique_cover)} unpaired cover images and {len(unique_stego)} unpaired stego images. These will be ignored to prevent data leakage.")
        
    random.shuffle(common_files)
    
    total = len(common_files)
    train_end = int(total * train_ratio)
    val_end = train_end + int(total * val_ratio)
    
    splits = {
        'train': common_files[:train_end],
        'val': common_files[train_end:val_end],
        'test': common_files[val_end:]
    }
    
    # Create output directories
    for split_name, files in splits.items():
        print(f"Copying {len(files)} file pairs to '{split_name}' split...")
        split_cover_dir = os.path.join(output_dir, split_name, "cover")
        split_stego_dir = os.path.join(output_dir, split_name, "stego")
        
        os.makedirs(split_cover_dir, exist_ok=True)
        os.makedirs(split_stego_dir, exist_ok=True)
        
        for f in files:
            shutil.copy2(os.path.join(cover_dir, f), os.path.join(split_cover_dir, f))
            shutil.copy2(os.path.join(stego_dir, f), os.path.join(split_stego_dir, f))
            
    print("Dataset splitting complete.")

if __name__ == "__main__":
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    source_dataset = os.path.join(BASE_DIR, "dataset")
    out_dataset = os.path.join(BASE_DIR, "data")
    
    print("Starting dataset split...")
    split_dataset(source_dataset, out_dataset)
