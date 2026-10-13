// People & PINs Data Model & Catalog for Settings Screen
// Matches LottoTrack Reference UI Specification

export const REFERENCE_SETTINGS_PEOPLE = [
  {
    id: 'clk_master',
    name: 'master',
    role: 'Owner',
    roleDesc: 'Owner · can change settings and clear data',
    pin: '1234'
  },
  {
    id: 'clk_priya',
    name: 'Priya',
    role: 'Clerk',
    roleDesc: 'Clerk · can sell, receive packs and end the day',
    pin: '0000'
  },
  {
    id: 'clk_carlos',
    name: 'Carlos',
    role: 'Clerk',
    roleDesc: 'Clerk · can sell, receive packs and end the day',
    pin: '0000'
  }
];

export function getSettingsPeopleList(state) {
  if (state && Array.isArray(state.clerks) && state.clerks.length > 0) {
    return state.clerks;
  }
  return JSON.parse(JSON.stringify(REFERENCE_SETTINGS_PEOPLE));
}
