# pip install pillow

from PIL import Image
import os

# Location of the floor plan images
folder = "floorplans"

# Check each PNG
for filename in sorted(os.listdir(folder)):
    if filename.endswith(".png"):
        path = os.path.join(folder, filename)

        image = Image.open(path)

        print(f"{filename}: {image.width} x {image.height} pixels")

# Output:
#   Floor 1.png: 1722 x 1188 pixels
#   Floor 2.png: 1722 x 1188 pixels
#   Floor 3.png: 1722 x 1188 pixels
#   Floor G.png: 1722 x 1188 pixels