# LottoTrack Pro Screenshot Assets

This directory holds real product screenshots for the LottoTrack Pro landing page.

Every slot on the marketing page is formatted in a neutral **16:10 aspect ratio**. If any image file is missing, the landing page automatically displays a labeled neutral placeholder frame, allowing real screenshots to be dropped into this folder at any time without requiring code or layout changes.

---

## Required Files & Recommended Dimensions

All screenshots should be high-resolution PNG or WebP files in a **16:10 aspect ratio** (recommended: **1920 × 1200 px** or **1440 × 900 px**).

| Filename | Placement | Recommended Size | Content Description |
| :--- | :--- | :--- | :--- |
| `01-scan-pack.png` | Step 1 (Pack to Sale) | 1920 × 1200 px | Barcode scanner capturing incoming pack barcode |
| `02-pack-identified.png` | Step 2 (Pack to Sale) | 1920 × 1200 px | Pack identified screen showing game name, price, and pack number |
| `03-choose-box.png` | Step 3 (Pack to Sale) | 1920 × 1200 px | Dispenser box selection modal with starting ticket number entry |
| `04-sell-ticket.png` | Step 4 (Pack to Sale) | 1920 × 1200 px | Ticket sale action via barcode scan or +1 tap |
| `05-inventory-updates.png` | Step 5 (Pack to Sale) | 1920 × 1200 px | Active dispenser rack view with remaining ticket count per box |
| `06-close-shift.png` | Step 6 (Pack to Sale) | 1920 × 1200 px | End of shift reconciliation calculating expected cash drawer balance |
| `07-report.png` | Step 7 (Pack to Sale) | 1920 × 1200 px | Finished shift summary screen ready to print, export, or email |
| `rack.png` | Store Owner Perspective | 1920 × 1200 px | Complete 65-box lottery dispenser rack overview |
| `cashier-screen.png` | Cashier Perspective | 1920 × 1200 px | High-contrast touch POS interface with large buttons and number pads |
| `shift-report.png` | Reports Tab (Shift) | 1920 × 1200 px | Shift report detailing opening/closing positions and box-by-box sales |
| `day-report.png` | Reports Tab (Day) | 1920 × 1200 px | Georgia Lottery retailer daily layout report preview |
| `receipt.png` | Reports Tab (Receipt) | 1920 × 1200 px | 80mm thermal receipt format preview |

---

## How to Add Real Screenshots

1. Save or export your actual interface captures using the exact filenames listed above.
2. Place the `.png` files directly inside this folder (`/assets/screenshots/`).
3. Reload `index.html` in your browser. The landing page will immediately display the real screenshots in place of the fallback frames.
