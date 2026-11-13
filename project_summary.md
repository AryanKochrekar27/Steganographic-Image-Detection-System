# Steganography Project Summary

This document provides a structured summary of the phases and implementation details of the Steganography and Steganalysis project.

## Phase 1: Environment Setup & Data Preparation
- **Workspace Configuration:** Configured a local Python virtual environment (`venv`) to securely manage dependencies (like PyTorch and Pillow) and ensure robust script execution with absolute paths.
- **Data Standardization (`convert.py`):** The foundational image dataset (e.g., BOSSbase) naturally provides images in `.pgm` format. Developed a conversion script to standardize these raw images into a more accessible `.png` format, resulting in a baseline set of untouched "Cover" images.

## Phase 2: Data Generation (Steganography)
- **Automated Data Injection (`stego_gen.py`):** Utilized the `stegano` Python library to implement a Least Significant Bit (LSB) steganography technique.
- **Dataset Creation:** Built a script that iterates over the clean `.png` cover images, injects a secret payload (the string "secret") into the pixel data, and saves the output. This generated a labeled dataset containing 50% clean Cover images and 50% altered Steganographic images.

## Phase 3: Data Organization & Pipeline Integration
- **Directory Restructuring:** Consolidated both Cover and Stego image directories into a unified `dataset` folder to streamline the training and evaluation pipelines.
- **Data Splitting (`split_data.py`):** Engineered a script to dynamically partition the dataset into Training, Validation, and Testing sets, ensuring unbiased model evaluation and preventing overfitting.
- **PyTorch Dataset Automation (`dataset.py`):** Developed a custom PyTorch `Dataset` loader. This loader reads image batches at runtime, converts them to tensors, automatically maps the correct binary labels (0 for Cover, 1 for Stego), and feeds them efficiently into the neural network.

## Phase 4: Steganalysis Model Architecture
- **Specialized CNN Architecture (`model.py`):** Designed a Deep Learning classification model (`StegoNet`), highly inspired by specialized steganalysis architectures like XuNet. Standard Convolutional Neural Networks (CNNs) struggle with steganalysis as they look for macroscopic visual features; steganography requires detecting microscopic noise anomalies.
- **High-Pass Noise Extraction:** Implemented a custom `KVFilter` (Kernel Value High-Pass Filter) at the very front of the network. This layer is initialized with predetermined mathematical weights and explicitly "frozen" (untrainable). It acts to suppress the standard visual content of the image and expose the hidden noise residuals (the LSB manipulation) to the network.
- **Classification Layers:** Following the high-pass filter, the data is processed through sequential 2D Convolution layers, Batch Normalization, Average Pooling, and Global Average Pooling to produce a final binary classification (Cover vs. Stego).

## Phase 5: Training and Evaluation Loops
- **Training Algorithm (`train.py`):** Formulated the training loop to feed data batches into `StegoNet`, applying gradient descent via an optimizer and tracking loss metrics to iteratively train the model.
- **Evaluation Criteria (`eval.py` & `test.py`):** Set up evaluation scripts to systematically measure the model's accuracy, precision, and recall on the unseen Testing set data. Included modular tests to verify correct library imports and pathing integrity.

## Phase 6: Pipeline Stabilization & Bug Fixes
- **Architecture Synchronization:** Resolved a critical issue where the model architecture in `model.py` (which was updated to include the KV filter and BatchNorm) drifted out of sync with the previous `best_model.pth` checkpoint, preventing `eval.py` from running. A full retrain was necessitated.
- **Windows Console Encoding Fix:** Identified and patched a `UnicodeEncodeError` inside `train.py`. The original script used unicode emojis (✓, →) which caused the Windows PowerShell environment (`cp1252` encoding) to fatally crash at the exact moment the model reached its first validation milestone and attempted to save the `.pth` file.
- **Rapid Validation (`train_fast.py`):** Since training 9,000 images on a local CPU takes several hours, an auxiliary script `train_fast.py` was introduced. This leverages `torch.utils.data.Subset` to quickly verify model convergence on a 500-image subset before committing to the full-scale GPU/CPU run.

---
*Future implementations and tests will be appended to this structured summary.*
