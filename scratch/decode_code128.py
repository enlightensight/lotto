from PIL import Image

img = Image.open(r"C:\Users\Admin\.gemini\antigravity-ide\brain\7a62a2d8-ffd4-48e4-b446-7e2afd1b1ea5\.user_uploaded\media_1791959554103.png").convert('L')
w, h = img.size

# Average y=75..95
row = [0.0]*w
for y in range(75, 95):
    for x in range(w):
        row[x] += img.getpixel((x, y))
row = [val/20.0 for val in row]

thresh = 135
# Barcode is between x=50 and x=320
bars = []
curr = row[50] < thresh
cnt = 0
for x in range(50, 320):
    b = row[x] < thresh
    if b == curr:
        cnt += 1
    else:
        bars.append((1 if curr else 0, cnt))
        curr = b
        cnt = 1
bars.append((1 if curr else 0, cnt))

print(f"Total bars/spaces: {len(bars)}")
print("Bars/spaces (1=black, 0=white):")
for b in bars:
    print(b)
