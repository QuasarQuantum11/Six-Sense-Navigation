from PIL import Image
import matplotlib.pyplot as plt

# Load the floor plan
image = Image.open("floorplans/Floor G.png")

# Display the image
plt.figure(figsize=(16, 11))
plt.imshow(image)
plt.title("Click the 0 m point and then the 10 m point on the scale bar")
plt.axis("on")

# Wait for two clicks
points = plt.ginput(2, timeout=-1)

plt.close()

# Calculate pixel distance
x1, y1 = points[0]
x2, y2 = points[1]

pixel_distance = ((x2 - x1)**2 + (y2 - y1)**2)**0.5

print(f"Point 1: ({x1:.2f}, {y1:.2f})")
print(f"Point 2: ({x2:.2f}, {y2:.2f})")
print(f"Pixel distance: {pixel_distance:.2f} pixels")

# Since the selected interval represents 10 metres
pixels_per_metre = pixel_distance / 10

print(f"Pixels per metre: {pixels_per_metre:.4f}")