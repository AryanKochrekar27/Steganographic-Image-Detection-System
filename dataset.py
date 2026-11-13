import os
import torch
from torch.utils.data import Dataset
from torchvision import transforms
from PIL import Image, ImageFile

# Gracefully handle any remaining truncated PNG/JPEG images
ImageFile.LOAD_TRUNCATED_IMAGES = True


class StegoDataset(Dataset):
    """
    PyTorch Dataset for loading cover and stego image pairs.
    - Cover images  → label 0
    - Stego images  → label 1

    The dataset directory must have the structure:
        <dataset_dir>/
            cover/   (clean images)
            stego/   (LSB-modified images)
    """

    def __init__(self, dataset_dir, transform=None):
        self.dataset_dir = dataset_dir
        self.transform   = transform
        self.image_paths = []
        self.labels      = []

        cover_dir = os.path.join(dataset_dir, "cover")
        stego_dir = os.path.join(dataset_dir, "stego")

        EXTS = ('.png', '.jpg', '.jpeg', '.pgm')

        if os.path.exists(cover_dir):
            for img_name in sorted(os.listdir(cover_dir)):
                if img_name.lower().endswith(EXTS):
                    self.image_paths.append(os.path.join(cover_dir, img_name))
                    self.labels.append(0)

        if os.path.exists(stego_dir):
            for img_name in sorted(os.listdir(stego_dir)):
                if img_name.lower().endswith(EXTS):
                    self.image_paths.append(os.path.join(stego_dir, img_name))
                    self.labels.append(1)

    def __len__(self):
        return len(self.image_paths)

    def __getitem__(self, idx):
        img_path = self.image_paths[idx]
        image    = Image.open(img_path).convert('L')   # grayscale
        label    = self.labels[idx]

        if self.transform:
            image = self.transform(image)
        else:
            image = transforms.ToTensor()(image)

        return image, torch.tensor(label, dtype=torch.long)


if __name__ == "__main__":
    BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
    train_dir = os.path.join(BASE_DIR, "data", "train")

    if os.path.exists(train_dir):
        ds = StegoDataset(train_dir)
        print(f"Dataset size: {len(ds)}")
        img, lbl = ds[0]
        print(f"First item — shape: {img.shape}, label: {lbl}")
        img2, lbl2 = ds[len(ds) // 2]
        print(f"Mid item   — shape: {img2.shape}, label: {lbl2}")
    else:
        print("Run split_data.py first.")
