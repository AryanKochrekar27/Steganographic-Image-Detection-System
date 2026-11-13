import os
import torch
from torch.utils.data import DataLoader
from torchvision import transforms
from sklearn.metrics import accuracy_score, confusion_matrix, classification_report

from dataset import StegoDataset
from model import StegoNet


def evaluate():
    BASE_DIR        = os.path.dirname(os.path.abspath(__file__))
    test_dir        = os.path.join(BASE_DIR, "data", "test")
    checkpoint_path = os.path.join(BASE_DIR, "checkpoints", "best_model.pth")

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")

    if not os.path.exists(checkpoint_path):
        print(f"Error: checkpoint not found at {checkpoint_path}")
        print("Run train.py first.")
        return

    transform = transforms.Compose([
        transforms.CenterCrop(256),
        transforms.ToTensor(),
    ])

    test_dataset = StegoDataset(test_dir, transform=transform)
    test_loader  = DataLoader(test_dataset, batch_size=32, shuffle=False, num_workers=0)

    print(f"Loaded {len(test_dataset)} test images.")

    model = StegoNet().to(device)
    model.load_state_dict(torch.load(checkpoint_path, map_location=device, weights_only=True))
    model.eval()

    all_preds  = []
    all_labels = []

    print("Evaluating …")
    with torch.no_grad():
        for images, labels in test_loader:
            images = images.to(device)
            outputs = model(images)
            _, predicted = torch.max(outputs, 1)
            all_preds.extend(predicted.cpu().numpy())
            all_labels.extend(labels.numpy())

    acc = accuracy_score(all_labels, all_preds)
    cm  = confusion_matrix(all_labels, all_preds)

    print("\n─────────────────────────────────────────")
    print(f"  Test Accuracy : {acc * 100:.2f}%")
    print("─────────────────────────────────────────")
    print("\nConfusion Matrix:")
    print(f"                   Pred Cover   Pred Stego")
    print(f"  Actual Cover        {cm[0][0]:<11}  {cm[0][1]}")
    print(f"  Actual Stego        {cm[1][0]:<11}  {cm[1][1]}")
    print("\nClassification Report:")
    print(classification_report(all_labels, all_preds,
                                target_names=["Cover", "Stego"]))


if __name__ == "__main__":
    if os.name == 'nt':
        import multiprocessing
        multiprocessing.freeze_support()
    evaluate()
