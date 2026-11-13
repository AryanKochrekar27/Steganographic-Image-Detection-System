import torch
import torch.nn as nn
import torch.optim as optim
from dataset import StegoDataset
from model import StegoNet
from torchvision import transforms
import os

def test_overfit():
    train_dir = os.path.join("data", "train")
    ds = StegoDataset(train_dir, transform=transforms.Compose([
        transforms.CenterCrop(256),
        transforms.ToTensor()
    ]))
    
    # Get a single batch of 16 covers and 16 stegos
    images = []
    labels = []
    # Find some covers and stegos
    c_count = 0
    s_count = 0
    for img, lbl in ds:
        if lbl.item() == 0 and c_count < 16:
            images.append(img)
            labels.append(lbl)
            c_count += 1
        elif lbl.item() == 1 and s_count < 16:
            images.append(img)
            labels.append(lbl)
            s_count += 1
        if c_count == 16 and s_count == 16:
            break
            
    images = torch.stack(images)
    labels = torch.stack(labels)
    
    model = StegoNet()
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=1e-3)
    
    print("Starting overfit test...")
    for epoch in range(100):
        optimizer.zero_grad()
        out = model(images)
        loss = criterion(out, labels)
        loss.backward()
        optimizer.step()
        
        _, preds = torch.max(out, 1)
        acc = (preds == labels).float().mean().item()
        
        if epoch % 10 == 0:
            print(f"Epoch {epoch}: Loss {loss.item():.4f}, Acc {acc:.2f}")
            
    print(f"Final Acc: {acc:.2f}")

if __name__ == "__main__":
    test_overfit()
