# Standard Code 128 Patterns (widths of 6 elements: b1, s1, b2, s2, b3, s3)
CODE128_PATTERNS = [
    (2, 1, 2, 2, 2, 2), # 0
    (2, 2, 2, 1, 2, 2), # 1
    (2, 2, 2, 2, 2, 1), # 2
    (1, 2, 1, 2, 2, 3), # 3
    (1, 2, 1, 3, 2, 2), # 4
    (1, 3, 1, 2, 2, 2), # 5
    (1, 2, 2, 2, 1, 3), # 6
    (1, 2, 2, 3, 1, 2), # 7
    (1, 3, 2, 2, 1, 2), # 8
    (2, 2, 1, 2, 1, 3), # 9
    (2, 2, 1, 3, 1, 2), # 10
    (2, 3, 1, 2, 1, 2), # 11
    (1, 1, 2, 2, 3, 2), # 12
    (1, 2, 2, 1, 3, 2), # 13
    (1, 2, 2, 2, 3, 1), # 14
    (1, 1, 3, 2, 2, 2), # 15
    (1, 2, 3, 1, 2, 2), # 16
    (1, 2, 3, 2, 2, 1), # 17
    (2, 2, 3, 2, 1, 1), # 18
    (2, 2, 1, 1, 3, 2), # 19
    (2, 2, 1, 2, 3, 1), # 20
    (2, 1, 3, 2, 1, 2), # 21
    (2, 2, 3, 1, 1, 2), # 22
    (3, 1, 2, 1, 3, 1), # 23
    (3, 1, 1, 2, 2, 2), # 24
    (3, 2, 1, 1, 2, 2), # 25
    (3, 2, 1, 2, 2, 1), # 26
    (3, 1, 2, 2, 1, 2), # 27
    (3, 2, 2, 1, 1, 2), # 28
    (3, 2, 2, 2, 1, 1), # 29
    (2, 1, 2, 1, 2, 3), # 30
    (2, 1, 2, 3, 2, 1), # 31
    (2, 3, 2, 1, 2, 1), # 32
    (1, 1, 1, 3, 2, 3), # 33
    (1, 3, 1, 1, 2, 3), # 34
    (1, 3, 1, 3, 2, 1), # 35
    (1, 1, 2, 3, 1, 3), # 36
    (1, 3, 2, 1, 1, 3), # 37
    (1, 3, 2, 3, 1, 1), # 38
    (2, 1, 1, 3, 1, 3), # 39
    (2, 3, 1, 1, 1, 3), # 40
    (2, 3, 1, 3, 1, 1), # 41
    (1, 1, 2, 1, 3, 3), # 42
    (1, 1, 2, 3, 3, 1), # 43
    (1, 3, 2, 1, 3, 1), # 44
    (1, 1, 3, 1, 2, 3), # 45
    (1, 1, 3, 3, 2, 1), # 46
    (1, 3, 3, 1, 2, 1), # 47
    (3, 1, 3, 1, 2, 1), # 48
    (2, 1, 1, 3, 3, 1), # 49
    (2, 3, 1, 1, 3, 1), # 50
    (2, 1, 3, 1, 1, 3), # 51
    (2, 1, 3, 3, 1, 1), # 52
    (2, 1, 3, 1, 3, 1), # 53
    (3, 1, 1, 1, 2, 3), # 54
    (3, 1, 1, 3, 2, 1), # 55
    (3, 3, 1, 1, 2, 1), # 56
    (3, 1, 2, 1, 1, 3), # 57
    (3, 1, 2, 3, 1, 1), # 58
    (3, 3, 2, 1, 1, 1), # 59
    (3, 1, 4, 1, 1, 1), # 60
    (2, 2, 1, 4, 1, 1), # 61
    (4, 3, 1, 1, 1, 1), # 62
    (1, 1, 1, 2, 2, 4), # 63
    (1, 1, 1, 4, 2, 2), # 64
    (1, 2, 1, 1, 2, 4), # 65
    (1, 2, 1, 4, 2, 1), # 66
    (1, 4, 1, 1, 2, 2), # 67
    (1, 4, 1, 2, 2, 1), # 68
    (1, 1, 2, 2, 1, 4), # 69
    (1, 1, 2, 4, 1, 2), # 70
    (1, 2, 2, 1, 1, 4), # 71
    (1, 2, 2, 4, 1, 1), # 72
    (1, 4, 2, 1, 1, 2), # 73
    (1, 4, 2, 2, 1, 1), # 74
    (2, 4, 1, 2, 1, 1), # 75
    (2, 2, 1, 1, 1, 4), # 76
    (4, 1, 3, 1, 1, 1), # 77
    (2, 4, 1, 1, 1, 2), # 78
    (1, 3, 4, 1, 1, 1), # 79
    (1, 1, 1, 2, 4, 2), # 80
    (1, 2, 1, 1, 4, 2), # 81
    (1, 2, 1, 2, 4, 1), # 82
    (1, 1, 4, 2, 1, 2), # 83
    (1, 2, 4, 1, 1, 2), # 84
    (1, 2, 4, 2, 1, 1), # 85
    (4, 1, 1, 2, 1, 2), # 86
    (4, 2, 1, 1, 1, 2), # 87
    (4, 2, 1, 2, 1, 1), # 88
    (2, 1, 2, 1, 4, 1), # 89
    (2, 1, 4, 1, 2, 1), # 90
    (4, 1, 2, 1, 2, 1), # 91
    (1, 1, 1, 1, 4, 3), # 92
    (1, 1, 1, 3, 4, 1), # 93
    (1, 3, 1, 1, 4, 1), # 94
    (1, 1, 4, 1, 1, 3), # 95
    (1, 1, 4, 3, 1, 1), # 96
    (4, 1, 1, 1, 1, 3), # 97
    (4, 1, 1, 3, 1, 1), # 98
    (1, 1, 3, 1, 4, 1), # 99
    (1, 1, 4, 1, 3, 1), # 100
    (3, 1, 1, 1, 4, 1), # 101
    (4, 1, 1, 1, 3, 1), # 102
    (2, 1, 1, 4, 1, 2), # 103 (Start A)
    (2, 1, 1, 2, 1, 4), # 104 (Start B)
    (2, 1, 1, 2, 3, 2), # 105 (Start C)
]

from PIL import Image
img = Image.open(r"C:\Users\Admin\.gemini\antigravity-ide\brain\7a62a2d8-ffd4-48e4-b446-7e2afd1b1ea5\.user_uploaded\media_1791959554103.png").convert('L')
w, h = img.size

# Let's search across multiple y lines and multiple thresholds
for y in range(70, 95, 3):
    row = [img.getpixel((x, y)) for x in range(w)]
    for thresh in range(110, 150, 5):
        # find quiet zone transition to first bar
        # look for start pattern
        binary = [1 if p < thresh else 0 for p in row] # 1=bar, 0=space
        # find runs
        runs = []
        curr = binary[0]
        cnt = 0
        for b in binary:
            if b == curr:
                cnt += 1
            else:
                runs.append((curr, cnt))
                curr = b
                cnt = 1
        runs.append((curr, cnt))
        
        # Look for Start C: bar=2, sp=1, bar=1, sp=2, bar=3, sp=2 (total 11 units)
        for i in range(len(runs)-10):
            if runs[i][0] == 1: # must start with bar
                sample = [r[1] for r in runs[i:i+6]]
                unit = sum(sample) / 11.0
                if unit < 1.0: continue
                normalized = [int(round(s / unit)) for s in sample]
                if normalized == [2, 1, 1, 2, 3, 2]:
                    # Match Start C!
                    # Decode subsequent characters
                    idx = i + 6
                    decoded_vals = []
                    while idx + 6 <= len(runs):
                        c_sample = [runs[idx+k][1] for k in range(6)]
                        c_unit = sum(c_sample) / 11.0
                        c_norm = tuple(int(round(s / c_unit)) for s in c_sample)
                        if c_norm in CODE128_PATTERNS:
                            val = CODE128_PATTERNS.index(c_norm)
                            decoded_vals.append(val)
                            idx += 6
                        else:
                            break
                    if len(decoded_vals) >= 6:
                        print(f"y={y}, thresh={thresh}, Start C at {i}, Decoded vals: {decoded_vals}")
                        break
