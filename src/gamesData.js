// Reference Ticket Games Data Model & Catalog for Settings Screen
// Matches LottoTrack Reference UI Specification

export const REFERENCE_SETTINGS_GAMES = [
  { id: 'sg_1', name: '5X Money', gameNumber: '1650', price: 1, ticketsPack: 300, bookValue: 300 },
  { id: 'sg_2', name: 'Jr Jumbo', gameNumber: '1602', price: 1, ticketsPack: 300, bookValue: 300 },
  { id: 'sg_3', name: 'Loteria', gameNumber: '1631', price: 2, ticketsPack: 150, bookValue: 300 },
  { id: 'sg_4', name: 'Hit 100', gameNumber: '1644', price: 2, ticketsPack: 150, bookValue: 300 },
  { id: 'sg_5', name: 'Cross Word', gameNumber: '1590', price: 3, ticketsPack: 100, bookValue: 300 },
  { id: 'sg_6', name: 'Treasure Hunt', gameNumber: '1611', price: 3, ticketsPack: 100, bookValue: 300 },
  { id: 'sg_7', name: 'Lucky 7s', gameNumber: '1688', price: 5, ticketsPack: 60, bookValue: 300 },
  { id: 'sg_8', name: '50X Money', gameNumber: '1711', price: 10, ticketsPack: 30, bookValue: 300 },
  { id: 'sg_9', name: 'Hit 1000', gameNumber: '1720', price: 20, ticketsPack: 30, bookValue: 600 },
  { id: 'sg_10', name: '500X The Money', gameNumber: '1770', price: 50, ticketsPack: 20, bookValue: 1000 },
];

export function getSettingsGamesList(state) {
  let games = JSON.parse(JSON.stringify(REFERENCE_SETTINGS_GAMES));

  // If custom games have been added to state, append them
  if (state && Array.isArray(state.customGames) && state.customGames.length > 0) {
    state.customGames.forEach((cg, idx) => {
      const price = Number(cg.price) || 1;
      const tix = Number(cg.packSize || cg.ticketsPack) || (price >= 50 ? 20 : 300 / price);
      const bVal = Number(cg.bookValue) || (price * tix);
      games.push({
        id: cg.id || `custom_game_${idx}`,
        name: cg.name || 'Custom Game',
        gameNumber: String(cg.gameNumber || cg.barcodePrefix || '9999'),
        price: price,
        ticketsPack: tix,
        bookValue: bVal
      });
    });
  }

  return games;
}
