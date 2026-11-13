import sys
try:
    import torch
    print(torch.__version__)
except Exception as e:
    import traceback
    with open("import_error.txt", "w") as f:
        traceback.print_exc(file=f)
    print("Error saved to import_error.txt")
