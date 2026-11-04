import fs from 'fs';
import path from 'path';

function patchServer() {
  const filePath = path.resolve('server.js');
  let content = fs.readFileSync(filePath, 'utf8');
  const isCRLF = content.includes('\r\n');
  const eol = isCRLF ? '\r\n' : '\n';

  const target = `      // Box availability check: prevent assigning to occupied box
      const [occupied] = await pool.query(
        \`SELECT * FROM store_pending_tickets 
         WHERE store_id = ? AND box_number = ? AND status = 'CONFIGURED' AND barcode != ?\`,
        [effectiveStoreId, boxNumber, barcode]
      );
      if (occupied.length > 0) {
        return res.status(400).json({
          success: false,
          error: \`Box #\${boxNumber} is already occupied by "\${occupied[0].game_name || 'another game'}". Please select an empty box.\`
        });
      }

      // Check if dispenser box is occupied in active_dispensers
      const [dispOccupied] = await pool.query(
        "SELECT * FROM active_dispensers WHERE box_number = ? AND game_name != ? AND game_name IS NOT NULL AND game_name != ''",
        [boxNumber, gameName]
      );
      if (dispOccupied.length > 0) {
        return res.status(400).json({
          success: false,
          error: \`Box #\${boxNumber} is currently occupied by active dispenser pack (\${dispOccupied[0].game_name}).\`
        });
      }`;

  const replacement = `      // Box availability check: check if occupied and handle replaceAction
      const [occupied] = await pool.query(
        \`SELECT * FROM store_pending_tickets 
         WHERE store_id = ? AND box_number = ? AND status = 'CONFIGURED' AND barcode != ?\`,
        [effectiveStoreId, boxNumber, barcode]
      );
      if (occupied.length > 0) {
        if (body.replaceAction === 'empty' || body.replaceAction === 'replace') {
          await pool.query(
            "UPDATE store_pending_tickets SET status = 'COMPLETED', box_number = NULL WHERE store_id = ? AND box_number = ? AND barcode != ?",
            [effectiveStoreId, boxNumber, barcode]
          );
        } else if (body.replaceAction === 'return') {
          await pool.query(
            "UPDATE store_pending_tickets SET status = 'RETURNED', box_number = NULL WHERE store_id = ? AND box_number = ? AND barcode != ?",
            [effectiveStoreId, boxNumber, barcode]
          );
        } else {
          return res.status(400).json({
            success: false,
            error: \`Box #\${boxNumber} is already occupied by "\${occupied[0].game_name || 'another game'}". Please select an empty box.\`
          });
        }
      }

      // Check if dispenser box is occupied in active_dispensers
      const [dispOccupied] = await pool.query(
        "SELECT * FROM active_dispensers WHERE box_number = ? AND game_name != ? AND game_name IS NOT NULL AND game_name != ''",
        [boxNumber, gameName]
      );
      if (dispOccupied.length > 0) {
        if (body.replaceAction === 'empty' || body.replaceAction === 'replace' || body.replaceAction === 'return') {
          await pool.query(
            "DELETE FROM active_dispensers WHERE box_number = ?",
            [boxNumber]
          );
        } else {
          return res.status(400).json({
            success: false,
            error: \`Box #\${boxNumber} is currently occupied by active dispenser pack (\${dispOccupied[0].game_name}).\`
          });
        }
      }`;

  const normTarget = target.replace(/\r?\n/g, eol);
  const normReplacement = replacement.replace(/\r?\n/g, eol);

  if (content.includes(normTarget)) {
    content = content.replace(normTarget, normReplacement);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✓ Successfully patched server.js with replaceAction support');
  } else {
    console.warn('Target block not found in server.js');
  }
}

patchServer();

