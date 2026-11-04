import fs from 'fs';
import path from 'path';

function updateIndexHtml() {
  const filePath = path.resolve('index.html');
  let html = fs.readFileSync(filePath, 'utf8');

  // 1. Remove tabBoxReplace button
  const tabRegex = /<button type="button" class="tab" id="tabBoxReplace" role="tab">[\s\S]*?<\/button>\s*/;
  if (!tabRegex.test(html)) {
    console.warn('Warning: tabBoxReplace regex not matched, checking if already removed');
  } else {
    html = html.replace(tabRegex, '');
    console.log('✓ Removed tabBoxReplace button');
  }

  // 2. Remove boxReplaceTabContent
  const contentRegex = /<!-- Replace \/ Active New Ticket Tab -->[\s\S]*?<\/div>\s*<\/div>\s*(?=<div class="modal-f">)/;
  if (!contentRegex.test(html)) {
    console.warn('Warning: boxReplaceTabContent regex not matched, checking if already removed');
  } else {
    html = html.replace(contentRegex, '');
    console.log('✓ Removed boxReplaceTabContent pane');
  }

  // 3. Remove btnExecuteReplaceBox button
  const btnRegex = /<button type="button" class="btn btn-primary" id="btnExecuteReplaceBox" style="display: none !important; color: #ffffff;">Activate New Ticket &rarr;<\/button>\s*/;
  if (!btnRegex.test(html)) {
    console.warn('Warning: btnExecuteReplaceBox regex not matched, checking if already removed');
  } else {
    html = html.replace(btnRegex, '');
    console.log('✓ Removed btnExecuteReplaceBox button');
  }

  // 4. Add boxOccupiedConflictModal after setBoxModal
  const conflictModalMarkup = `  <!-- MODAL: Box Occupied Conflict Resolution (Empty Box vs Return Pack) -->
  <dialog id="boxOccupiedConflictModal" class="pos-modal-dialog" style="width: 520px; max-width: 95vw; border-radius: 14px; border: 1.5px solid var(--border-color, #cbd5e1); padding: 0; overflow: hidden; background: var(--bg-surface, #ffffff); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);">
    <div style="background: #1e293b; color: #ffffff; padding: 14px 18px; font-weight: 800; font-size: 1.05rem; display: flex; align-items: center; justify-content: space-between;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 6px; background: #f59e0b; color: #000; font-weight: 900; font-size: 14px;">!</span>
        <span>Box #<span id="conflictBoxNum">61</span> Already Occupied</span>
      </div>
      <button type="button" class="modal-close-btn" id="closeBoxConflictBtn" style="color:#ffffff; font-size: 20px; line-height: 1; cursor: pointer; background: none; border: none;">&times;</button>
    </div>

    <div style="padding: 18px 20px;">
      <!-- Existing pack info card -->
      <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 10px; padding: 12px 14px; margin-bottom: 14px;">
        <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #92400e; margin-bottom: 2px;">Currently in Box #<span id="conflictCurrentBoxText">61</span>:</div>
        <div style="font-size: 15px; font-weight: 800; color: #78350f;" id="conflictCurrentGameTitle">Game Name · Pack #000000</div>
        <div style="font-size: 12px; color: #b45309; margin-top: 2px;" id="conflictCurrentGameDetails">Ticket #000 · $0.00 / ticket</div>
      </div>

      <!-- New ticket to activate info card -->
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 12px 14px; margin-bottom: 16px;">
        <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #166534; margin-bottom: 2px;">New Ticket to Activate in Box #<span id="conflictTargetBoxText">61</span>:</div>
        <div style="font-size: 15px; font-weight: 800; color: #14532d;" id="conflictNewGameTitle">New Game · Pack #000000</div>
        <div style="font-size: 12px; color: #15803d; margin-top: 2px;" id="conflictNewGameDetails">Price: $0.00 · Pack Size: 0 tickets</div>
      </div>

      <p style="font-size: 13px; font-weight: 700; color: var(--ink-2, #334155); margin: 0 0 12px 0;">
        Choose what to do with the current book before activating the new ticket:
      </p>

      <!-- Options container -->
      <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px;">
        <!-- Option 1: Replace with empty -->
        <button type="button" id="btnConflictEmptyBox" class="btn" style="text-align: left; display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; border: 2px solid #e2e8f0; border-radius: 10px; background: #ffffff; cursor: pointer; transition: all 0.15s ease;">
          <div style="width: 36px; height: 36px; border-radius: 8px; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; font-weight: 800;">
            ✕
          </div>
          <div style="flex: 1;">
            <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 2px;">Replace Box with Empty (Mark Finished / Empty)</div>
            <div style="font-size: 12px; color: #64748b; line-height: 1.4;">Marks the current book as empty/sold out, records any sold tickets for shift reports, and immediately activates the new ticket in Box #<span class="conflictBoxInline">61</span>.</div>
          </div>
        </button>

        <!-- Option 2: Return the pack -->
        <button type="button" id="btnConflictReturnPack" class="btn" style="text-align: left; display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; border: 2px solid #2563eb; border-radius: 10px; background: #eff6ff; cursor: pointer; transition: all 0.15s ease;">
          <div style="width: 36px; height: 36px; border-radius: 8px; background: #dbeafe; color: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; font-weight: 800;">
            ↩
          </div>
          <div style="flex: 1;">
            <div style="font-size: 14px; font-weight: 800; color: #1e40af; margin-bottom: 2px;">Return the Pack (Move to Safe Inventory)</div>
            <div style="font-size: 12px; color: #3b82f6; line-height: 1.4;">Returns the remaining unsold tickets of the current book back to In-Stock / Safe Inventory, and immediately activates the new ticket in Box #<span class="conflictBoxInline">61</span>.</div>
          </div>
        </button>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--border-color, #e2e8f0); padding-top: 12px;">
        <button type="button" class="btn" id="btnConflictCancel" style="padding: 8px 16px; border-radius: 6px; font-weight: 700; font-size: 13px;">Choose Different Box</button>
      </div>
    </div>
  </dialog>
`;

  if (!html.includes('id="boxOccupiedConflictModal"')) {
    const marker = '  <!-- MODAL: Ticket Not In Inventory Alert';
    if (html.includes(marker)) {
      html = html.replace(marker, conflictModalMarkup + '\n' + marker);
      console.log('✓ Added boxOccupiedConflictModal to index.html');
    } else {
      throw new Error('Marker for boxOccupiedConflictModal insertion not found');
    }
  }

  fs.writeFileSync(filePath, html, 'utf8');
}

updateIndexHtml();

