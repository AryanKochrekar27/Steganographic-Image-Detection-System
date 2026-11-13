import os
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from torchvision import transforms

from dataset import StegoDataset
from model import StegoNet


def train():
    BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
    train_dir = os.path.join(BASE_DIR, "data", "train")
    val_dir   = os.path.join(BASE_DIR, "data", "val")

    # ── Hyperparameters ───────────────────────────────────────────────────────
    batch_size    = 32
    learning_rate = 1e-3
    num_epochs    = 20
    crop_size     = 256   # crop a 256×256 patch from each 512×512 image

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")

    # ── Data transforms ───────────────────────────────────────────────────────
    train_transform = transforms.Compose([
        transforms.RandomCrop(crop_size),
        transforms.RandomHorizontalFlip(),
        transforms.ToTensor(),
    ])
    val_transform = transforms.Compose([
        transforms.CenterCrop(crop_size),
        transforms.ToTensor(),
    ])

    train_dataset = StegoDataset(train_dir, transform=train_transform)
    val_dataset   = StegoDataset(val_dir,   transform=val_transform)

    print(f"Train: {len(train_dataset)} images | Val: {len(val_dataset)} images")

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True,
                              num_workers=0, pin_memory=False)
    val_loader   = DataLoader(val_dataset,   batch_size=batch_size, shuffle=False,
                              num_workers=0, pin_memory=False)

    # ── Model, loss, optimiser ────────────────────────────────────────────────
    model     = StegoNet().to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=learning_rate, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode='max', factor=0.5, patience=3, verbose=True
    )

    # ── Checkpoint directory ──────────────────────────────────────────────────
    checkpoint_dir = os.path.join(BASE_DIR, "checkpoints")
    os.makedirs(checkpoint_dir, exist_ok=True)

    best_val_acc = 0.0

    # ── Training loop ─────────────────────────────────────────────────────────
    for epoch in range(num_epochs):
        model.train()
        running_loss = 0.0
        correct = total = 0

        for i, (images, labels) in enumerate(train_loader):
            images, labels = images.to(device), labels.to(device)

            optimizer.zero_grad()
            outputs = model(images)
            loss    = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            running_loss += loss.item() * images.size(0)
            _, predicted = torch.max(outputs, 1)
            total   += labels.size(0)
            correct += (predicted == labels).sum().item()

            if (i + 1) % 20 == 0:
                print(f"  Epoch [{epoch+1}/{num_epochs}] Step [{i+1}/{len(train_loader)}]"
                      f"  Loss: {running_loss/total:.4f}  TrainAcc: {100.*correct/total:.2f}%")

        train_acc = 100. * correct / total

        # ── Validation ────────────────────────────────────────────────────────
        model.eval()
        val_correct = val_total = 0
        with torch.no_grad():
            for images, labels in val_loader:
                images, labels = images.to(device), labels.to(device)
                outputs = model(images)
                _, predicted = torch.max(outputs, 1)
                val_total   += labels.size(0)
                val_correct += (predicted == labels).sum().item()

        val_acc = 100. * val_correct / val_total
        print(f"\nEpoch [{epoch+1}/{num_epochs}]  TrainAcc: {train_acc:.2f}%"
              f"  ValAcc: {val_acc:.2f}%\n")

        scheduler.step(val_acc)

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            ckpt_path = os.path.join(checkpoint_dir, "best_model.pth")
            torch.save(model.state_dict(), ckpt_path)
            print(f"  [SUCCESS] Saved new best model  ValAcc={best_val_acc:.2f}%  -> {ckpt_path}\n")

        if best_val_acc >= 95.0:
            print(f"  [TARGET REACHED] Target reached! Best Val Acc = {best_val_acc:.2f}%  Stopping early.")
            break

    print(f"\nTraining complete. Best validation accuracy: {best_val_acc:.2f}%")


if __name__ == "__main__":
    if os.name == 'nt':
        import multiprocessing
        multiprocessing.freeze_support()
    train()
