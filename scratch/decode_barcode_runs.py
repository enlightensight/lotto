import zlib
import struct

def get_row(filepath):
    with open(filepath, 'rb') as f:
        data = f.read()
    pos = 8
    width = height = None
    idat = bytearray()
    while pos < len(data):
        length, chunk_type = struct.unpack('>I4s', data[pos:pos+8])
        chunk_data = data[pos+8:pos+8+length]
        pos += 12 + length
        if chunk_type == b'IHDR':
            width, height, bit_depth, color_type, _, _, _ = struct.unpack('>IIBBBBB', chunk_data)
        elif chunk_type == b'IDAT':
            idat.extend(chunk_data)
        elif chunk_type == b'IEND':
            break
    decompressed = zlib.decompress(idat)
    stride = width * 4 + 1
    
    # Average multiple lines in the barcode area
    # In height 124, barcode is roughly between y=60 and y=110
    avg_gray = [0.0] * width
    rows_counted = 0
    for y in range(70, 100):
        row_start = y * stride + 1
        row_bytes = decompressed[row_start : row_start + width * 4]
        for x in range(width):
            r = row_bytes[x*4]
            g = row_bytes[x*4+1]
            b = row_bytes[x*4+2]
            avg_gray[x] += (0.299*r + 0.587*g + 0.114*b)
        rows_counted += 1
    for x in range(width):
        avg_gray[x] /= rows_counted
    return width, height, avg_gray

width, height, gray = get_row(r"C:\Users\Admin\.gemini\antigravity-ide\brain\7a62a2d8-ffd4-48e4-b446-7e2afd1b1ea5\.user_uploaded\media_1791959554103.png")

# Find quiet zones and bars
min_g, max_g = min(gray), max(gray)
thresh = (min_g + max_g) / 2
binary = [1 if g > thresh else 0 for g in gray] # 0 = black, 1 = white

# Find first black bar and last black bar
first_bar = 0
while first_bar < width and binary[first_bar] == 1:
    first_bar += 1
last_bar = width - 1
while last_bar >= 0 and binary[last_bar] == 1:
    last_bar -= 1

print(f"Barcode runs from x={first_bar} to x={last_bar}, total width={last_bar - first_bar + 1} px")

# Get run lengths in the barcode
runs = []
curr = binary[first_bar]
cnt = 0
for x in range(first_bar, last_bar + 1):
    if binary[x] == curr:
        cnt += 1
    else:
        runs.append((curr, cnt))
        curr = binary[x]
        cnt = 1
runs.append((curr, cnt))

print(f"Total elements (bars + spaces): {len(runs)}")
print("First 20 runs:", runs[:20])
print("Last 10 runs:", runs[-10:])
