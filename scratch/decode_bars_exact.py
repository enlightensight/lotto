from PIL import Image

img = Image.open(r"C:\Users\Admin\.gemini\antigravity-ide\brain\7a62a2d8-ffd4-48e4-b446-7e2afd1b1ea5\.user_uploaded\media_1791959554103.png").convert('L')
w, h = img.size

# Let's inspect a clean slice of the barcode across y=80
y = 80
row = [img.getpixel((x, y)) for x in range(w)]

# Print a rough ASCII visualization of the barcode
thresh = 130
binary_str = "".join(["#" if p < thresh else " " for p in row])
print(f"Row {y} width {w}:")
print(binary_str)
