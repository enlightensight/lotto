# Interleaved 2 of 5 patterns (2 wide, 3 narrow out of 5)
ITF_DIGITS = {
    (0, 0, 1, 1, 0): '0',
    (1, 0, 0, 0, 1): '1',
    (0, 1, 0, 0, 1): '2',
    (1, 1, 0, 0, 0): '3',
    (0, 0, 1, 0, 1): '4',
    (1, 0, 1, 0, 0): '5',
    (0, 1, 1, 0, 0): '6',
    (0, 0, 0, 1, 1): '7',
    (1, 0, 0, 1, 0): '8',
    (0, 1, 0, 1, 0): '9',
}

from PIL import Image
img = Image.open(r"C:\Users\Admin\.gemini\antigravity-ide\brain\7a62a2d8-ffd4-48e4-b446-7e2afd1b1ea5\.user_uploaded\media_1791959554103.png").convert('L')
w, h = img.size

for y in range(70, 95, 3):
    row = [img.getpixel((x, y)) for x in range(w)]
    for thresh in range(110, 150, 5):
        binary = [1 if p < thresh else 0 for p in row] # 1=bar, 0=space
        runs = []
        curr = binary[0]
        cnt = 0
        for b in binary:
            if b == curr: cnt += 1
            else:
                runs.append((curr, cnt))
                curr = b
                cnt = 1
        runs.append((curr, cnt))
        
        # Look for ITF start: bar, space, bar, space (narrow, narrow, narrow, narrow)
        for i in range(len(runs)-15):
            if runs[i][0] == 1:
                # check if start pattern
                # decode 10 elements per digit pair
                idx = i + 4 # skip start
                decoded_str = ""
                matched = True
                while idx + 10 <= len(runs):
                    pair_runs = runs[idx:idx+10]
                    # odd index in pair_runs are bars (0, 2, 4, 6, 8), even are spaces (1, 3, 5, 7, 9)
                    bar_widths = [pair_runs[k][1] for k in [0, 2, 4, 6, 8]]
                    space_widths = [pair_runs[k][1] for k in [1, 3, 5, 7, 9]]
                    
                    # classify wide (1) vs narrow (0)
                    sorted_b = sorted(bar_widths)
                    b_thresh = (sorted_b[2] + sorted_b[3]) / 2.0
                    b_bits = tuple(1 if b > b_thresh else 0 for b in bar_widths)
                    
                    sorted_s = sorted(space_widths)
                    s_thresh = (sorted_s[2] + sorted_s[3]) / 2.0
                    s_bits = tuple(1 if s > s_thresh else 0 for s in space_widths)
                    
                    if b_bits in ITF_DIGITS and s_bits in ITF_DIGITS:
                        d1 = ITF_DIGITS[b_bits]
                        d2 = ITF_DIGITS[s_bits]
                        decoded_str += d1 + d2
                        idx += 10
                    else:
                        break
                if len(decoded_str) >= 12:
                    print(f"Decoded ITF: {decoded_str}")
                    break
