# LTSYSTEM (Georgia Lottery POS) - Complete System Analysis

This document provides a simple, clear, and comprehensive breakdown of how the commercial **LTSYSTEM (Lottery Tracking System)** software works, based on the video training and screen captures.

---

## 1. Screen Layout & Interface Components

```
+---------------------------------------------------------------------------------------------------------+
| [Shift: 1 ->]                  [Status Banner: Shift in Progress / End Shift]          [End Shift] [65] |
| [Cancel] [Undo]                [Scanner Readout: Last Scan / Error Messages]           [Get Report]     |
| [ML] [Scan barcode...        ]                                                                          |
+---------------------------------------------------------------------------------------------------------+
| Settlement: $0.00 | Month: 1 | Week: 1 | Today: 1 | Inactive: 96 | Inv Status | [Updating Inventory]   |
+---------------------------------------------------------------------------------------------------------+
|                                                                                                         |
|   +-----------+  +-----------+  +-----------+  +-----------+  +-----------+  +-----------+              |
|   | $30       |  | $25       |  | $20       |  | $10       |  | $5        |  | $2        |              |
|   |  Box 62   |  |  Box 61   |  |  Box 58   |  |  Box 45   |  |  Box 20   |  |  Box 6    |              |
|   | New Activ |  | 200X M... |  | DOUBLE... |  | PLATINUM  |  | LUCKY 7S  |  | LOTERIA   |              |
|   |    03     |  |    10     |  |    01     |  |    23     |  |    40     |  |    30     |              |
|   +-----------+  +-----------+  +-----------+  +-----------+  +-----------+  +-----------+              |
|                                                                                                         |
+---------------------------------------------------------------------------------------------------------+
| [1][2][3][4][5][6][7][8][9][10] ... [70] Bottom Dispenser Rack Ribbon (Turns Green as Audited)         |
+---------------------------------------------------------------------------------------------------------+
```

### Key Controls Explained:
* **`ML` (Manual Load):** Button to manually activate or look up a pack when barcode cannot be scanned.
* **`Cancel` / `Undo`:** Pink buttons to cancel current action or undo the last ticket sale.
* **Large Readout Number (Top Right):** Shows active box count or current target box being audited (e.g. `19`, `51`, `63`, `64`, `65`).
* **Card Colors on Dispenser Rack:**
  * **Yellow:** Active dispenser box with running ticket count and days active.
  * **Green:** Audited / verified box during the End Shift process.
  * **White:** Newly activated box (`New Activation`) loaded during the current shift.
  * **Orange:** Box selected for reassignment (`[ Switch ]` / `[ Change ]`).
* **Bottom Rack Ribbon:** Miniature 70-box visual rack that lights up green slot-by-slot as boxes are scanned.

---

## 2. The 7 Core Operational Workflows

### Workflow 1: Stock Intake (Safe Inventory Gatekeeper)
* **The Rule:** No lottery pack can ever be sold or put into a dispenser box until it is scanned into the store inventory first.
* **Error When Not in Inventory:**
  * If a clerk scans an un-inventoried pack (e.g. `$30 GRANT 50 #1881-0176261`), the system blocks it.
  * **Top Banner:** `THIS TICKET IS NOT IN THE INVENTORY OR NOT IN DATABASE` (Yellow).
  * **Popup Alert:** `⚠️ Ticket is not in the inventory - Ticket must be updated in the inventory first! [ OK ]`.
* **How It Is Resolved (Intake):**
  * Clerk clicks the orange **`Updating Inventory`** tab.
  * Screen title shows: `Receiving / Updating Inventory | packs scanned so far = 1`.
  * Clerk scans the pack barcode `1881-0173261`.
  * It logs into the intake table with `Count = 1`. Now the pack is officially in stock.

---

### Workflow 2: Box Activation & Re-routing
* **Activating the Pack:**
  * Once in inventory, scanning the pack brings up an activation card (e.g. `$30 Set / New Activation / 3`).
* **Switch or Change Assignment:**
  * The orange card gives two buttons:
    * **`[ Switch ]`**: Swaps this pack's slot with another box.
    * **`[ Change ]`**: Opens the keypad to change the assigned box number.
* **Box Number Keypad Modal:**
  * Displays `BOX # [ 62 ]` with Up/Down adjustment arrows `[▲] [▼]`.
  * Touch numeric keypad: `Clear`, `Backspace`, `0-9`, `.`, `Enter`.
  * Options:
    * **`[ Add ]`**: Confirms activation into Box #62.
    * **`[ Not In Box ]`**: Keeps the pack in safe backstock without assigning to a dispenser slot.
* **Result:** Box #62 appears on the dispenser rack as a white card labeled `New Activation` with start ticket `#03`.

---

### Workflow 3: Normal Shift Sales & Scanning
* **Selling a Ticket via Scanner:**
  * Clerk scans ticket barcode (e.g. `1860-0361352-010`).
  * Top Banner confirms: `THIS NUMBER HAS BEEN SCANNED / $25 200X MONEY.... # 1860-0361352 / TICKET CHANGED to 010`.
  * Box 61 ticket count advances to `10`.
  * Settlement dollars and ticket sold metrics update immediately.

---

### Workflow 4: Error Handling & Discrepancies

#### A. Sold-Out in Previous Shift Recovery
* **Scenario:** A clerk scans a ticket belonging to a pack that was marked "sold out" in an earlier shift.
* **System Action:**
  * Top Banner: `This Ticket was sold out in previous shift`.
  * Modal: `Update Ticket` $\rightarrow$ `Do you want to add this Ticket back into New Shift?`
  * Buttons: `[ No ]` (leave sold out) or `[ Fix ]` (opens the Box Number keypad to reactivate it).

#### B. Fixing Missed / Skipped Ticket Position
* **Scenario:** Tickets were torn or sold out of sequence (e.g. ticket #12 scanned when system was at #05).
* **System Action:**
  * Modal: `Fix Ticket Position`.
  * Displays: `Name: $20 MILLIONAIRE JU` | `Scanned position: 012`.
  * Explanation: *"If this ticket's start position needs to be fixed you can fix it by entering a correct position below..."*
  * Input: `Enter correct Ticket Position: [ 53 ]` + touch keypad.
  * Clicking **`[ Fix ]`** updates the position with confirmation: `Missed Ticket is Fixed`.

---

### Workflow 5: End Shift Box-by-Box Audit
* **Starting the Audit:**
  * Clerk clicks the green `End Shift` button.
  * Status readout changes to `Scanning... End Shift`.
* **Sequential Box Verification:**
  * The clerk scans each active dispenser box one by one.
  * As each box is scanned:
    1. The box card on the main grid turns **bright green** with the verified count.
    2. The corresponding box number on the bottom 70-slot ribbon lights up **green**.
    3. The top readout number increments (`63` $\rightarrow$ `64` $\rightarrow$ `65`).

---

### Workflow 6: Georgia Lottery Terminal Draw Reconciliation
* **Trigger:** Automatically pops up as soon as all dispenser scratcher boxes are audited.
* **Top Banner:** `Processing online Ticket data input`.
* **Three Dedicated Inputs + Touch Keypad:**
  1. **`Online Sale`**: Total draw sales (Powerball, Mega Millions, Cash 3/4, Fantasy 5) from Georgia Lottery terminal slip. (Example: `1` = $1.00).
  2. **`Online Cash Out`**: Total draw winning tickets cashed out to customers. (Example: `0` = $0.00).
  3. **`Scratch Off Cash`**: Total scratcher winning tickets cashed out to customers. (Example: `99` = $99.00).
* **Action:** Clerk enters the numbers on the keypad and clicks the blue **`[ DONE ]`** button.

---

### Workflow 7: Official Day Report & Shift Settlement
* **Top Header After Reconcile:**
  * Displays: `Total Sale = $ 984`
  * Action Buttons: `Shift Report` | `Start new shift` | Readout `65`.
* **Reconciled Financial Summary:**
  * **Scratcher Total Sales:** `$984.00`
  * **Online Sales:** `$1.00`
  * **Total Sales:** `$984.00 + $1.00 = $985.00`
  * **Scratcher Cashes (Payouts):** `$99.00`
  * **Online Cashes (Draw Payouts):** `$0.00`
  * **Total Cashes (Payouts):** `$99.00 + $0.00 = $99.00`
* **Starting New Shift:**
  * Clicking `Start new shift` archives the shift to history.
  * Closing ticket numbers become the opening ticket numbers for Shift #2.
  * All temporary sold-out lists reset for the new cashier.

---

## 3. Summary of System Rules

| Feature | LTSYSTEM Behavior |
| :--- | :--- |
| **Inventory Requirement** | Hard requirement: Cannot sell or activate any pack without scanning it into inventory intake first. |
| **Keypad Input** | Universal touch keypad (`0-9`, `Clear`, `Backspace`, `Enter`) used for Box Number, Ticket Position Fix, and Terminal Reconciliation. |
| **Box Reassignment** | `Switch` (swap boxes) and `Change` (type new box #) on any newly activated pack. |
| **Color Coding** | Yellow = Active; Green = Audited/Scanned; White = New Activation; Orange = Reassigning. |
| **Shift Reconciliation** | Combines scratchers + online terminal sales and deducts scratcher cashes + online cashes to balance the cash drawer. |
