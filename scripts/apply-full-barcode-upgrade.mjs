import fs from 'fs';

let code = fs.readFileSync('src/data.js', 'utf8');

// Replace parseLotteryBarcode and formatTicketDisplayBarcode
const parseStartIdx = code.indexOf('export function parseLotteryBarcode(');
const formatStartIdx = code.indexOf('export function formatTicketDisplayBarcode(');
const formatEndMarker = 'export function formatLotteryBarcode(';
const formatEndIdx = code.indexOf(formatEndMarker);

if (parseStartIdx !== -1 && formatEndIdx !== -1) {
  console.log('Found parseLotteryBarcode and formatTicketDisplayBarcode in src/data.js');
}

const newImplementation = `export function parseLotteryBarcode(raw, customGames = []) {
  if (!raw) return null;
  let s = String(raw).replace(/[\\r\\n\\t]/g, '').trim();
  if (!s) return null;

  // Strip standard AIM / Keyence scanner symbology prefix (e.g. "]C1", "]I0", "]e0", "]C0", "]A0", "]d1", "]Q1")
  // AIM format is strictly: ']' followed by 1 letter and 1 modifier digit!
  s = s.replace(/^\\][a-zA-Z][0-9]/, '').trim();

  // Strip Code 39 start/stop asterisks if present
  s = s.replace(/^\\*+|\\*+$/g, '').trim();

  // If the scanned string is a URL (e.g. from 2D QR code on back of ticket), extract the lottery barcode digits
  if (s.includes('http://') || s.includes('https://') || s.includes('www.') || s.includes('scel.net') || s.includes('galottery.com')) {
    const urlDigitsMatch = s.match(/(?:code|ticket|barcode|entry|t|b)=?(\\d{10,24})/i) || s.match(/(\\d{11,17})/);
    if (urlDigitsMatch) {
      s = urlDigitsMatch[1];
    }
  }

  // Reject barcodes containing letters (electronics serial numbers, asset tags, laptop model numbers, etc.)
  // Real scratch-off lottery ticket barcodes are 100% numeric!
  if (/[a-zA-Z]/.test(s)) {
    return {
      isValid: false,
      isNonLotteryBarcode: true,
      raw
    };
  }

  // Pattern 0: 4-segment format: Game - Pack - Check - Ticket (Security)
  // Matches printed ticket text: "1670-019869-3-000(149)", "1648-018378-8-029(000)", "1672-007252-3-000[099]"
  const fourPartMatch = s.match(/^(\\d{3,5})[-_\\s]+(\\d{5,8})[-_\\s]+(\\d{1,2})[-_\\s]+(\\d{1,4})(?:[-_\\s]*[([{]?(\\d{1,4})[)\\]}]?)?$/);
  if (fourPartMatch) {
    const gameNumber = fourPartMatch[1];
    const gNum = parseInt(gameNumber, 10);
    const isLotteryGame = isKnownGamePrefix(gameNumber, customGames) || (gNum >= 100 && gNum <= 9999);
    const packNumber = fourPartMatch[2];
    const checkCode = fourPartMatch[3];
    const ticketNumber = parseInt(fourPartMatch[4], 10);
    const ticketString = String(fourPartMatch[4]).padStart(3, '0');
    const securityCode = fourPartMatch[5] || null;

    if (!isLotteryGame || isNaN(ticketNumber) || ticketNumber > 999) {
      return {
        isValid: false,
        isNonLotteryBarcode: true,
        raw
      };
    }

    const inferredDetails = inferPackDetailsFromCountdown(ticketNumber, securityCode);
    const sec = securityCode || computeLotterySeriesCode(gameNumber, ticketNumber, customGames, inferredDetails?.packSize);
    return {
      isValid: true,
      gameNumber,
      packNumber,
      packClean: packNumber.replace(/^0+/, '') || packNumber,
      packCombined: packNumber,
      ticketNumber,
      ticketString,
      checkCode,
      securityCode: sec,
      hasExplicitSecurityCode: Boolean(typeof securityCode !== 'undefined' && securityCode),
      standardBarcode: \`\${gameNumber}\${packNumber}\${checkCode || '0'}\${ticketString}\`,
      canonicalId: checkCode ? \`\${gameNumber}-\${packNumber}-\${checkCode}-\${ticketString}\` : \`\${gameNumber}-\${packNumber}-\${ticketString}\`,
      fullId: \`\${gameNumber}-\${packNumber}\${checkCode ? '-' + checkCode : ''}-\${ticketString}(\${sec})\`,
      displayBarcode: (checkCode ? \`\${gameNumber}-\${packNumber}-\${checkCode}-\${ticketString} (\${sec})\` : \`\${gameNumber}-\${packNumber}-\${ticketString} (\${sec})\`),
      inferredDetails,
      raw
    };
  }

  // Pattern 0b: Continuous 13 or 14 digits with trailing security PIN in parentheses/brackets
  // e.g. "14170670170009(290)", "16480183788002(000)", "14180996564082[067]", "1418099656082(000)"
  const parenContinuousMatch = s.match(/^(\\d{4})(\\d{6})(\\d{1})?(\\d{3})\\s*[([{](\\d{1,4})[)\\]}]$/);
  if (parenContinuousMatch) {
    const gameNumber = parenContinuousMatch[1];
    const gNum = parseInt(gameNumber, 10);
    const isLotteryGame = isKnownGamePrefix(gameNumber, customGames) || (gNum >= 100 && gNum <= 9999);
    const packNumber = parenContinuousMatch[2];
    const checkCode = parenContinuousMatch[3] !== undefined ? parenContinuousMatch[3] : null;
    const ticketString = parenContinuousMatch[4];
    const ticketNumber = parseInt(ticketString, 10);
    const securityCode = parenContinuousMatch[5];

    if (!isLotteryGame || isNaN(ticketNumber) || ticketNumber > 999) {
      return {
        isValid: false,
        isNonLotteryBarcode: true,
        raw
      };
    }

    const inferredDetails = inferPackDetailsFromCountdown(ticketNumber, securityCode);
    const sec = securityCode || computeLotterySeriesCode(gameNumber, ticketNumber, customGames, inferredDetails?.packSize);
    return {
      isValid: true,
      gameNumber,
      packNumber,
      packClean: packNumber.replace(/^0+/, '') || packNumber,
      packCombined: packNumber,
      ticketNumber,
      ticketString,
      checkCode,
      securityCode: sec,
      hasExplicitSecurityCode: Boolean(typeof securityCode !== 'undefined' && securityCode),
      standardBarcode: \`\${gameNumber}\${packNumber}\${checkCode || '0'}\${ticketString}\`,
      canonicalId: checkCode ? \`\${gameNumber}-\${packNumber}-\${checkCode}-\${ticketString}\` : \`\${gameNumber}-\${packNumber}-\${ticketString}\`,
      fullId: \`\${gameNumber}-\${packNumber}\${checkCode ? '-' + checkCode : ''}-\${ticketString}(\${sec})\`,
      displayBarcode: (checkCode ? \`\${gameNumber}-\${packNumber}-\${checkCode}-\${ticketString} (\${sec})\` : \`\${gameNumber}-\${packNumber}-\${ticketString} (\${sec})\`),
      inferredDetails,
      raw
    };
  }

  // Pattern 1: 3-segment format: Game - Pack - Ticket (Check/Security)
  // e.g. "1898-0019425-084(015)", "1234-567890-001[023]", "1648-018378-000", "1417-0670170-009(290)"
  const delimitedMatch = s.match(/^(\\d{3,5})[-_\\s]+(\\d{5,8})[-_\\s]+(\\d{1,3})(?:[-_\\s]*[([{]?(\\d{1,4})[)\\]}]?)?$/);
  if (delimitedMatch) {
    const gameNumber = delimitedMatch[1];
    const gNum = parseInt(gameNumber, 10);
    const isLotteryGame = isKnownGamePrefix(gameNumber, customGames) || (gNum >= 100 && gNum <= 9999);
    let packNumber = delimitedMatch[2];
    const seg3Num = parseInt(delimitedMatch[3], 10);
    const seg3Str = String(delimitedMatch[3]).padStart(3, '0');
    const parenStr = delimitedMatch[4] || null;
    const parenNum = delimitedMatch[4] ? parseInt(delimitedMatch[4], 10) : null;

    let ticketNumber = isNaN(seg3Num) ? 0 : seg3Num;
    let ticketString = seg3Str;
    let checkCode = null;
    let securityCode = null;

    if (delimitedMatch[3].length === 1 && parenNum !== null) {
      checkCode = delimitedMatch[3];
      ticketNumber = parenNum;
      ticketString = parenStr.padStart(3, '0');
    } else if (parenStr) {
      securityCode = parenStr;
    }

    if (packNumber.length === 7 && checkCode === null) {
      checkCode = packNumber.slice(6, 7);
      packNumber = packNumber.slice(0, 6);
    }

    if (!isLotteryGame || isNaN(ticketNumber) || ticketNumber > 999) {
      return {
        isValid: false,
        isNonLotteryBarcode: true,
        raw
      };
    }

    const inferredDetails = securityCode ? inferPackDetailsFromCountdown(ticketNumber, securityCode) : null;
    const sec = securityCode || computeLotterySeriesCode(gameNumber, ticketNumber, customGames, inferredDetails?.packSize);
    return {
      isValid: true,
      gameNumber,
      packNumber,
      packClean: packNumber.replace(/^0+/, '') || packNumber,
      packCombined: packNumber,
      ticketNumber,
      ticketString,
      checkCode,
      securityCode: sec,
      hasExplicitSecurityCode: Boolean(typeof securityCode !== 'undefined' && securityCode),
      standardBarcode: \`\${gameNumber}\${packNumber}\${checkCode || '0'}\${ticketString}\`,
      canonicalId: checkCode ? \`\${gameNumber}-\${packNumber}-\${checkCode}-\${ticketString}\` : \`\${gameNumber}-\${packNumber}-\${ticketString}\`,
      fullId: \`\${gameNumber}-\${packNumber}\${checkCode ? '-' + checkCode : ''}-\${ticketString}(\${sec})\`,
      displayBarcode: (checkCode ? \`\${gameNumber}-\${packNumber}-\${checkCode}-\${ticketString} (\${sec})\` : \`\${gameNumber}-\${packNumber}-\${ticketString} (\${sec})\`),
      inferredDetails,
      raw
    };
  }

  // Pattern 1b: Game - Pack - (Ticket) where ticket number is in parentheses or brackets
  const parenthesizedTixMatch = s.match(/^(\\d{3,5})[-_\\s]+(\\d{5,8})[-_\\s]*[([{](\\d{1,4})[)\\]}]$/);
  if (parenthesizedTixMatch) {
    const gameNumber = parenthesizedTixMatch[1];
    const gNum = parseInt(gameNumber, 10);
    const isLotteryGame = isKnownGamePrefix(gameNumber, customGames) || (gNum >= 100 && gNum <= 9999);
    let packNumber = parenthesizedTixMatch[2];
    let checkCode = null;
    if (packNumber.length === 7) {
      checkCode = packNumber.slice(6, 7);
      packNumber = packNumber.slice(0, 6);
    }
    const ticketNumber = parseInt(parenthesizedTixMatch[3], 10);
    const ticketString = String(parenthesizedTixMatch[3]).padStart(3, '0');

    if (!isLotteryGame || isNaN(ticketNumber) || ticketNumber > 999) {
      return {
        isValid: false,
        isNonLotteryBarcode: true,
        raw
      };
    }

    const sec = computeLotterySeriesCode(gameNumber, ticketNumber, customGames);
    return {
      isValid: true,
      gameNumber,
      packNumber,
      packClean: packNumber.replace(/^0+/, '') || packNumber,
      packCombined: packNumber,
      ticketNumber,
      ticketString,
      checkCode,
      securityCode: sec,
      hasExplicitSecurityCode: false,
      standardBarcode: \`\${gameNumber}\${packNumber}\${checkCode || '0'}\${ticketString}\`,
      canonicalId: checkCode ? \`\${gameNumber}-\${packNumber}-\${checkCode}-\${ticketString}\` : \`\${gameNumber}-\${packNumber}-\${ticketString}\`,
      fullId: \`\${gameNumber}-\${packNumber}\${checkCode ? '-' + checkCode : ''}-\${ticketString}(\${sec})\`,
      displayBarcode: (checkCode ? \`\${gameNumber}-\${packNumber}-\${checkCode}-\${ticketString} (\${sec})\` : \`\${gameNumber}-\${packNumber}-\${ticketString} (\${sec})\`),
      raw
    };
  }

  // Pattern 2a: Delimited Game - Pack (e.g. "1670-019869", "1670-019869-3", "1648-018378")
  const gamePackMatch = s.match(/^(\\d{3,5})[-_\\s]+(\\d{5,8})(?:[-_\\s]+(\\d{1,2}))?$/);
  if (gamePackMatch) {
    const gameNumber = gamePackMatch[1];
    let packNumber = gamePackMatch[2];
    let checkCode = gamePackMatch[3] || null;
    const gNum = parseInt(gameNumber, 10);
    if (isKnownGamePrefix(gameNumber, customGames) || (gNum >= 100 && gNum <= 9999)) {
      if (packNumber.length === 7 && checkCode === null) {
        checkCode = packNumber.slice(6, 7);
        packNumber = packNumber.slice(0, 6);
      }
      return {
        isValid: true,
        isPackBarcode: true,
        gameNumber,
        packNumber,
        packClean: packNumber.replace(/^0+/, '') || packNumber,
        packCombined: packNumber,
        ticketNumber: null,
        ticketString: null,
        checkCode,
        standardBarcode: checkCode ? \`\${gameNumber}\${packNumber}\${checkCode}\` : \`\${gameNumber}\${packNumber}\`,
        canonicalId: checkCode ? \`\${gameNumber}-\${packNumber}-\${checkCode}\` : \`\${gameNumber}-\${packNumber}\`,
        fullId: \`\${gameNumber}-\${packNumber}\${checkCode ? '-' + checkCode : ''}\`,
        displayBarcode: checkCode ? \`\${gameNumber}-\${packNumber}-\${checkCode}\` : \`\${gameNumber}-\${packNumber}\`,
        raw
      };
    }
    return {
      isValid: false,
      isNonLotteryBarcode: true,
      isRetailProduct: true,
      raw
    };
  }

  // Pattern 3: Pure continuous digits
  let digits = s.replace(/[^0-9]/g, '');

  // Strip scanner leading zeroes (e.g. 15 or 16-digit output from scanners configured with leading 0 padding)
  if (digits.length === 15 && digits.startsWith('0')) {
    digits = digits.slice(1);
  } else if (digits.length === 16 && digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  // 17 digits: 4 game + 6 pack + 1 check + 3 ticket + 3 security (e.g. 16700198693000149, 16480183788029000)
  if (digits.length === 17) {
    const gameNumber = digits.slice(0, 4);
    const gNum = parseInt(gameNumber, 10);
    const isLotteryGame = isKnownGamePrefix(gameNumber, customGames) || (gNum >= 100 && gNum <= 9999);
    if (!isLotteryGame) {
      return {
        isValid: false,
        isNonLotteryBarcode: true,
        isRetailProduct: true,
        raw
      };
    }
    const packNumber = digits.slice(4, 10); // 6-digit pack (019869)
    const checkCode = digits.slice(10, 11); // 1-digit check (3)
    const ticketNumber = parseInt(digits.slice(11, 14), 10); // 3-digit ticket (000)
    const ticketString = digits.slice(11, 14);
    const parenMatch = s.match(/[([{](\\d{1,4})[)\\]}]/);
    const securityCode = parenMatch ? parenMatch[1] : digits.slice(14, 17);
    const standardBarcode = digits.slice(0, 14);

    if (isNaN(ticketNumber) || ticketNumber > 999) {
      return {
        isValid: false,
        isNonLotteryBarcode: true,
        raw
      };
    }

    const inferredDetails = inferPackDetailsFromCountdown(ticketNumber, securityCode);
    const sec = securityCode || computeLotterySeriesCode(gameNumber, ticketNumber, customGames, inferredDetails?.packSize);
    return {
      isValid: true,
      gameNumber,
      packNumber,
      packClean: packNumber.replace(/^0+/, '') || packNumber,
      packCombined: packNumber,
      ticketNumber,
      ticketString,
      checkCode,
      securityCode: sec,
      hasExplicitSecurityCode: Boolean(typeof securityCode !== 'undefined' && securityCode),
      standardBarcode,
      canonicalId: checkCode ? \`\${gameNumber}-\${packNumber}-\${checkCode}-\${ticketString}\` : \`\${gameNumber}-\${packNumber}-\${ticketString}\`,
      fullId: \`\${gameNumber}-\${packNumber}\${checkCode ? '-' + checkCode : ''}-\${ticketString}(\${sec})\`,
      displayBarcode: (checkCode ? \`\${gameNumber}-\${packNumber}-\${checkCode}-\${ticketString} (\${sec})\` : \`\${gameNumber}-\${packNumber}-\${ticketString} (\${sec})\`),
      inferredDetails,
      raw
    };
  }

  // 16 digits: 4 game + 6 pack + 3 ticket + 3 security (13 core ticket digits without check digit + 3 PIN digits)
  if (digits.length === 16) {
    const gameNumber = digits.slice(0, 4);
    const gNum = parseInt(gameNumber, 10);
    const isLotteryGame = isKnownGamePrefix(gameNumber, customGames) || (gNum >= 100 && gNum <= 9999);
    if (!isLotteryGame) {
      return {
        isValid: false,
        isNonLotteryBarcode: true,
        isRetailProduct: true,
        raw
      };
    }
    const packNumber = digits.slice(4, 10); // 6-digit pack
    const ticketNumber = parseInt(digits.slice(10, 13), 10); // 3-digit ticket
    const ticketString = digits.slice(10, 13);
    const parenMatch = s.match(/[([{](\\d{1,4})[)\\]}]/);
    const securityCode = parenMatch ? parenMatch[1] : digits.slice(13, 16);
    const standardBarcode = \`\${gameNumber}\${packNumber}0\${ticketString}\`;

    if (isNaN(ticketNumber) || ticketNumber > 999) {
      return {
        isValid: false,
        isNonLotteryBarcode: true,
        raw
      };
    }

    const inferredDetails = inferPackDetailsFromCountdown(ticketNumber, securityCode);
    const sec = securityCode || computeLotterySeriesCode(gameNumber, ticketNumber, customGames, inferredDetails?.packSize);
    return {
      isValid: true,
      gameNumber,
      packNumber,
      packClean: packNumber.replace(/^0+/, '') || packNumber,
      packCombined: packNumber,
      ticketNumber,
      ticketString,
      checkCode: null,
      securityCode: sec,
      hasExplicitSecurityCode: Boolean(typeof securityCode !== 'undefined' && securityCode),
      standardBarcode,
      canonicalId: \`\${gameNumber}-\${packNumber}-\${ticketString}\`,
      fullId: \`\${gameNumber}-\${packNumber}-\${ticketString}(\${sec})\`,
      displayBarcode: \`\${gameNumber}-\${packNumber}-\${ticketString} (\${sec})\`,
      inferredDetails,
      raw
    };
  }

  // 14 digits: Standard Interleaved 2 of 5 / Code 128 barcode
  // Dual standards:
  // Layout A (e.g. SCEL, GA Lottery, IGT): [4 Game][6 Pack][1 Check][3 Ticket]
  // Layout B (e.g. Scientific Games): [4 Game][6 Pack][3 Ticket][1 Trailer]
  if (digits.length === 14) {
    const gameNumber = digits.slice(0, 4);
    const gNum = parseInt(gameNumber, 10);
    const isLotteryGame = isKnownGamePrefix(gameNumber, customGames) || (gNum >= 100 && gNum <= 9999);
    if (!isLotteryGame) {
      return {
        isValid: false,
        isRetailProduct: true,
        isNonLotteryBarcode: true,
        raw
      };
    }

    const packNumber = digits.slice(4, 10); // 6-digit pack (019869, 018378)

    // Layout A: [Game 4][Pack 6][Check 1][Ticket 3]
    const checkA = digits.slice(10, 11);
    const tixStrA = digits.slice(11, 14);
    const tixNumA = parseInt(tixStrA, 10);

    // Layout B: [Game 4][Pack 6][Ticket 3][Trailer 1]
    const tixStrB = digits.slice(10, 13);
    const tixNumB = parseInt(tixStrB, 10);
    const trailerB = digits.slice(13, 14);

    const matched = SAMPLE_GAMES.find(g => g.barcodePrefix === gameNumber || String(g.id).replace(/[^0-9]/g, '') === gameNumber)
      || (customGames || []).find(g => g.barcodePrefix === gameNumber || String(g.id).replace(/[^0-9]/g, '') === gameNumber);
    const knownPackSize = matched?.packSize || (matched?.price ? getStandardPackDetails(matched.price).packSize : null);

    let isLayoutB = false;
    if (tixNumB > 299) {
      isLayoutB = false;
    } else if (tixNumA > 299) {
      isLayoutB = true;
    } else if (knownPackSize && tixNumA >= knownPackSize && tixNumB < knownPackSize) {
      isLayoutB = true;
    } else if (knownPackSize && tixNumB >= knownPackSize && tixNumA < knownPackSize) {
      isLayoutB = false;
    }

    const ticketNumber = isLayoutB ? tixNumB : tixNumA;
    const ticketString = isLayoutB ? tixStrB : tixStrA;
    const checkCode = isLayoutB ? null : checkA;

    if (isNaN(ticketNumber) || ticketNumber > 999) {
      return {
        isValid: false,
        isRetailProduct: true,
        isNonLotteryBarcode: true,
        raw
      };
    }

    const parenMatch = s.match(/[([{](\\d{1,4})[)\\]}]/);
    const securityCode = parenMatch ? parenMatch[1] : null;
    const inferredDetails = securityCode ? inferPackDetailsFromCountdown(ticketNumber, securityCode) : null;
    const sec = securityCode || computeLotterySeriesCode(gameNumber, ticketNumber, customGames, matched?.packSize || inferredDetails?.packSize);

    return {
      isValid: true,
      gameNumber,
      packNumber,
      packClean: packNumber.replace(/^0+/, '') || packNumber,
      packCombined: packNumber,
      ticketNumber,
      ticketString,
      checkCode,
      trailer: isLayoutB ? trailerB : null,
      securityCode: sec,
      hasExplicitSecurityCode: Boolean(typeof securityCode !== 'undefined' && securityCode),
      standardBarcode: digits,
      canonicalId: checkCode ? \`\${gameNumber}-\${packNumber}-\${checkCode}-\${ticketString}\` : \`\${gameNumber}-\${packNumber}-\${ticketString}\`,
      fullId: \`\${gameNumber}-\${packNumber}\${checkCode ? '-' + checkCode : ''}-\${ticketString}(\${sec})\`,
      displayBarcode: (checkCode ? \`\${gameNumber}-\${packNumber}-\${checkCode}-\${ticketString} (\${sec})\` : \`\${gameNumber}-\${packNumber}-\${ticketString} (\${sec})\`),
      inferredDetails,
      raw
    };
  }

  // 15 digits: 4 game + 6 pack + 1 check + 3 ticket + 1 trailer/check (e.g. 164801837880005)
  if (digits.length === 15) {
    const gameNumber = digits.slice(0, 4);
    const gNum = parseInt(gameNumber, 10);
    const isLotteryGame = isKnownGamePrefix(gameNumber, customGames) || (gNum >= 100 && gNum <= 9999);
    if (isLotteryGame) {
      const packNumber = digits.slice(4, 10);
      const checkCode = digits.slice(10, 11);
      const ticketNumber = parseInt(digits.slice(11, 14), 10);
      const ticketString = digits.slice(11, 14);
      const standardBarcode = digits.slice(0, 14);
      if (!isNaN(ticketNumber) && ticketNumber <= 999) {
        const sec = computeLotterySeriesCode(gameNumber, ticketNumber, customGames);
        return {
          isValid: true,
          gameNumber,
          packNumber,
          packClean: packNumber.replace(/^0+/, '') || packNumber,
          packCombined: packNumber,
          ticketNumber,
          ticketString,
          checkCode,
          securityCode: sec,
          hasExplicitSecurityCode: false,
          standardBarcode,
          canonicalId: checkCode ? \`\${gameNumber}-\${packNumber}-\${checkCode}-\${ticketString}\` : \`\${gameNumber}-\${packNumber}-\${ticketString}\`,
          fullId: \`\${gameNumber}-\${packNumber}\${checkCode ? '-' + checkCode : ''}-\${ticketString}(\${sec})\`,
          displayBarcode: (checkCode ? \`\${gameNumber}-\${packNumber}-\${checkCode}-\${ticketString} (\${sec})\` : \`\${gameNumber}-\${packNumber}-\${ticketString} (\${sec})\`),
          raw
        };
      }
    }
  }

  // 18 to 26 digits: Continuous barcode with trailing validation digits (2D/PDF417 scratch barcode)
  if (digits.length >= 18 && digits.length <= 26) {
    const gameNumber = digits.slice(0, 4);
    const gNum = parseInt(gameNumber, 10);
    const isLotteryGame = isKnownGamePrefix(gameNumber, customGames) || (gNum >= 100 && gNum <= 9999);
    if (!isLotteryGame) {
      return {
        isValid: false,
        isNonLotteryBarcode: true,
        isRetailProduct: true,
        raw
      };
    }
    const packNumber = digits.slice(4, 10); // 6-digit pack
    const checkCode = digits.slice(10, 11); // 1-digit check
    const ticketNumber = parseInt(digits.slice(11, 14), 10);
    const ticketString = digits.slice(11, 14);
    const standardBarcode = digits.slice(0, 14); // Exactly core 14-digit lottery barcode

    const parenMatch = s.match(/\\((\\d{1,4})\\)/);
    const securityCode = parenMatch ? parenMatch[1] : null;

    if (isNaN(ticketNumber) || ticketNumber > 999) {
      return {
        isValid: false,
        isNonLotteryBarcode: true,
        raw
      };
    }

    const sec = securityCode || computeLotterySeriesCode(gameNumber, ticketNumber, customGames);
    return {
      isValid: true,
      gameNumber,
      packNumber,
      packClean: packNumber.replace(/^0+/, '') || packNumber,
      packCombined: packNumber,
      ticketNumber,
      ticketString,
      checkCode,
      securityCode: sec,
      hasExplicitSecurityCode: Boolean(typeof securityCode !== 'undefined' && securityCode),
      standardBarcode,
      canonicalId: checkCode ? \`\${gameNumber}-\${packNumber}-\${checkCode}-\${ticketString}\` : \`\${gameNumber}-\${packNumber}-\${ticketString}\`,
      fullId: \`\${gameNumber}-\${packNumber}\${checkCode ? '-' + checkCode : ''}-\${ticketString}(\${sec})\`,
      displayBarcode: (checkCode ? \`\${gameNumber}-\${packNumber}-\${checkCode}-\${ticketString} (\${sec})\` : \`\${gameNumber}-\${packNumber}-\${ticketString} (\${sec})\`),
      raw
    };
  }

  // 13 digits: 4 game + 6 pack + 3 ticket (Lottery ticket without check digit)
  if (digits.length === 13) {
    const gameNumber = digits.slice(0, 4);
    const gNum = parseInt(gameNumber, 10);
    const isLotteryGame = isKnownGamePrefix(gameNumber, customGames) || (gNum >= 100 && gNum <= 9999);
    if (isLotteryGame) {
      const packNumber = digits.slice(4, 10);
      const ticketNumber = parseInt(digits.slice(10, 13), 10);
      const ticketString = digits.slice(10, 13);
      if (!isNaN(ticketNumber) && ticketNumber <= 999) {
        const sec = computeLotterySeriesCode(gameNumber, ticketNumber, customGames);
        return {
          isValid: true,
          gameNumber,
          packNumber,
          packClean: packNumber.replace(/^0+/, '') || packNumber,
          packCombined: packNumber,
          ticketNumber,
          ticketString,
          checkCode: null,
          securityCode: sec,
          hasExplicitSecurityCode: false,
          standardBarcode: \`\${gameNumber}\${packNumber}0\${ticketString}\`,
          canonicalId: \`\${gameNumber}-\${packNumber}-\${ticketString}\`,
          fullId: \`\${gameNumber}-\${packNumber}-\${ticketString}(\${sec})\`,
          displayBarcode: \`\${gameNumber}-\${packNumber}-\${ticketString} (\${sec})\`,
          raw
        };
      }
    }
    return {
      isValid: false,
      isRetailProduct: true,
      raw
    };
  }

  // 12 digits: Check if it's a Lottery UPC Barcode (SCEL 833283..., Georgia Lottery 738562...) OR standard lottery barcode
  if (digits.length === 12) {
    const isSCEL = digits.startsWith('833283');
    const isGALottery = digits.startsWith('738562');
    if (isSCEL || isGALottery) {
      const gNum = isSCEL ? digits.slice(7, 11) : digits.slice(6, 10);
      const matched = SAMPLE_GAMES.find(g => g.barcodePrefix === gNum) || (customGames || []).find(g => g.barcodePrefix === gNum);
      return {
        isValid: true,
        isLotteryUPC: true,
        gameNumber: gNum,
        gameName: matched?.name || null,
        packNumber: null,
        ticketNumber: null,
        standardBarcode: digits,
        canonicalId: \`UPC-\${digits}\`,
        fullId: \`UPC-\${digits}\`,
        displayBarcode: \`UPC-\${digits}\`,
        raw
      };
    }
    const gameNumber = digits.slice(0, 4);
    const isLotteryGame = isKnownGamePrefix(gameNumber, customGames);
    if (isLotteryGame) {
      const packNumber = digits.slice(4, 10);
      const ticketNumber = parseInt(digits.slice(10, 12), 10);
      const ticketString = digits.slice(10, 12).padStart(3, '0');
      if (!isNaN(ticketNumber) && ticketNumber <= 999) {
        const sec = computeLotterySeriesCode(gameNumber, ticketNumber, customGames);
        return {
          isValid: true,
          gameNumber,
          packNumber,
          packClean: packNumber.replace(/^0+/, '') || packNumber,
          packCombined: packNumber,
          ticketNumber,
          ticketString,
          checkCode: null,
          securityCode: sec,
          hasExplicitSecurityCode: false,
          standardBarcode: \`\${gameNumber}\${packNumber}0\${ticketString}\`,
          canonicalId: \`\${gameNumber}-\${packNumber}-\${ticketString}\`,
          fullId: \`\${gameNumber}-\${packNumber}-\${ticketString}(\${sec})\`,
          displayBarcode: \`\${gameNumber}-\${packNumber}-\${ticketString} (\${sec})\`,
          raw
        };
      }
    }
    return {
      isValid: false,
      isRetailProduct: true,
      raw
    };
  }

  // 11 digits: 4 game + 6 pack + 1 check (Pack Barcode / Book Manifest Barcode)
  if (digits.length === 11) {
    const gameNumber = digits.slice(0, 4);
    const gNum = parseInt(gameNumber, 10);
    const isLotteryGame = isKnownGamePrefix(gameNumber, customGames) || (gNum >= 100 && gNum <= 9999);
    if (isLotteryGame) {
      const packNumber = digits.slice(4, 10); // 6-digit pack
      const checkCode = digits.slice(10, 11);
      return {
        isValid: true,
        isPackBarcode: true,
        gameNumber,
        packNumber,
        packClean: packNumber.replace(/^0+/, '') || packNumber,
        packCombined: packNumber,
        ticketNumber: null,
        ticketString: null,
        checkCode,
        standardBarcode: digits,
        canonicalId: \`\${gameNumber}-\${packNumber}-\${checkCode}\`,
        fullId: \`\${gameNumber}-\${packNumber}-\${checkCode}\`,
        displayBarcode: \`\${gameNumber}-\${packNumber}-\${checkCode}\`,
        raw
      };
    }
    return {
      isValid: false,
      isNonLotteryBarcode: true,
      isRetailProduct: true,
      raw
    };
  }

  // 10 digits: 4 game + 6 pack (Pack Barcode)
  if (digits.length === 10) {
    const gameNumber = digits.slice(0, 4);
    const gNum = parseInt(gameNumber, 10);
    const isLotteryGame = isKnownGamePrefix(gameNumber, customGames) || (gNum >= 100 && gNum <= 9999);
    if (isLotteryGame) {
      const packNumber = digits.slice(4, 10);
      return {
        isValid: true,
        isPackBarcode: true,
        gameNumber,
        packNumber,
        packClean: packNumber.replace(/^0+/, '') || packNumber,
        packCombined: packNumber,
        ticketNumber: null,
        ticketString: null,
        checkCode: null,
        standardBarcode: digits,
        canonicalId: \`\${gameNumber}-\${packNumber}\`,
        fullId: \`\${gameNumber}-\${packNumber}\`,
        displayBarcode: \`\${gameNumber}-\${packNumber}\`,
        raw
      };
    }
    return {
      isValid: false,
      isNonLotteryBarcode: true,
      isRetailProduct: true,
      raw
    };
  }

  // 7 digits: Pack number only
  if (digits.length === 7) {
    const packNumber = digits.slice(0, 6);
    const checkCode = digits.slice(6, 7);
    return {
      isValid: true,
      isPackBarcode: true,
      gameNumber: null,
      packNumber,
      packClean: packNumber.replace(/^0+/, '') || packNumber,
      packCombined: packNumber,
      ticketNumber: null,
      ticketString: null,
      checkCode,
      standardBarcode: digits,
      canonicalId: \`PACK-\${packNumber}\`,
      fullId: \`PACK-\${packNumber}-\${checkCode}\`,
      displayBarcode: \`Pack \${packNumber}-\${checkCode}\`,
      raw
    };
  }

  // 6 digits: Plain pack number
  if (digits.length === 6) {
    return {
      isValid: true,
      isPackBarcode: true,
      gameNumber: null,
      packNumber: digits,
      packClean: digits.replace(/^0+/, '') || digits,
      packCombined: digits,
      ticketNumber: null,
      ticketString: null,
      checkCode: null,
      standardBarcode: digits,
      canonicalId: \`PACK-\${digits}\`,
      fullId: \`PACK-\${digits}\`,
      displayBarcode: \`Pack \${digits}\`,
      raw
    };
  }

  return {
    isValid: false,
    isRetailProduct: digits.length === 8,
    isNonLotteryBarcode: true,
    raw
  };
}

export function formatTicketDisplayBarcode(rawOrParsed, customGames = [], overrideSecurityCode = null) {
  if (!rawOrParsed) return '---';
  const parsed = (rawOrParsed && typeof rawOrParsed === 'object' && rawOrParsed.isValid !== undefined)
    ? rawOrParsed
    : parseLotteryBarcode(rawOrParsed, customGames);

  if (!parsed || !parsed.isValid) {
    return String(rawOrParsed || '');
  }

  // Pack barcode manifest (no individual ticket number)
  if (parsed.isPackBarcode || parsed.ticketNumber === null) {
    const game = parsed.gameNumber || '1000';
    const pack = parsed.packNumber || '000000';
    const check = (parsed.checkCode !== null && parsed.checkCode !== undefined) ? String(parsed.checkCode) : '';
    if (check) {
      return \`\${game}-\${pack}-\${check}\`;
    }
    return \`\${game}-\${pack}\`;
  }

  const game = parsed.gameNumber || '1000';
  const pack = parsed.packNumber || '000000';
  const check = (parsed.checkCode !== null && parsed.checkCode !== undefined) ? String(parsed.checkCode) : '';
  const ticket = parsed.ticketString || (parsed.ticketNumber !== null ? String(parsed.ticketNumber).padStart(3, '0') : '000');
  const sec = (overrideSecurityCode !== null && overrideSecurityCode !== undefined && String(overrideSecurityCode).trim() !== '')
    ? String(overrideSecurityCode).trim()
    : (parsed.securityCode || computeLotterySeriesCode(game, parsed.ticketNumber, customGames, parsed.inferredDetails?.packSize));

  if (check) {
    return \`\${game}-\${pack}-\${check}-\${ticket} (\${sec})\`;
  }

  return \`\${game}-\${pack}-\${ticket} (\${sec})\`;
}

`;

code = code.slice(0, parseStartIdx) + newImplementation + code.slice(formatEndIdx);
fs.writeFileSync('src/data.js', code, 'utf8');
console.log('✓ Successfully wrote upgraded parseLotteryBarcode and formatTicketDisplayBarcode to src/data.js');

