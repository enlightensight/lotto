import zlib
import struct

def read_png(filepath):
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
    
    # color_type 6 = RGBA (4 bytes per pixel) + 1 filter byte per line
    stride = width * 4 + 1
    # Let's inspect a horizontal row across the barcode (around y = height * 0.75)
    y = int(height * 0.75)
    row_start = y * stride + 1
    row_bytes = decompressed[row_start : row_start + width * 4]
    
    # convert to grayscale
    gray = []
    for x in range(width):
        r = row_bytes[x*4]
        g = row_bytes[x*4+1]
        b = row_bytes[x*4+2]
        lum = 0.299*r + 0.587*g + 0.114*b
        gray.append(lum)
        
    return width, height, gray

width, height, gray = read_png(r"C:\Users\Admin\.gemini\antigravity-ide\brain\7a62a2d8-ffd4-48e4-b446-7e2afd1b1ea5\.user_uploaded\media_1791959554103.png")

# Threshold into 0 (black bar) and 1 (white space)
threshold = (min(gray) + max(gray)) / 2
binary = [1 if g > threshold else 0 for g in gray]

# Run length encoding of bars and spaces
runs = []
current = binary[0]
count = 0
for b in binary:
    if b == current:
        count += 1
    else:
        runs.append((current, count))
        current = b
        count = 1
runs.append((current, count))

print(f"Detected {len(runs)} bar/space transitions")
print("Run lengths (0=black, 1=white):")
for r in runs[:30]:
    print(r)
