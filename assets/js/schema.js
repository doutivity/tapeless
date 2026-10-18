// Wizard field definitions: which options each choice field offers and which icon marks them.
// Labels come from i18n (opt.<field>.<value>); the values match state.js enums.
export const CHOICES = {
  gender: [['male', 'user'], ['female', 'user'], ['other', 'user'], ['unspecified', 'eye-off']],
  relocate: [['no', 'home'], ['ukraine', 'map-pin'], ['abroad', 'globe']],
  remote: [['yes', 'laptop'], ['no', 'building'], ['either', 'shuffle']],
  military: [['liable', 'shield'], ['not-liable', 'check'], ['unspecified', 'eye-off']],
  study: [['none', 'x'], ['short', 'clock'], ['degree', 'cap'], ['any', 'bolt']],
  risk: [['safe', 'shield'], ['moderate', 'scale'], ['acceptable', 'bolt']],
  stress: [['low', 'leaf'], ['medium', 'wave'], ['high', 'flame']],
  mode: [['office', 'building'], ['remote', 'laptop'], ['field', 'tree'], ['mixed', 'shuffle']],
  team: [['team', 'users'], ['solo', 'user'], ['either', 'shuffle']],
  schedule: [['stable', 'calendar'], ['shift', 'repeat'], ['either', 'shuffle']],
  workType: [['mental', 'brain'], ['physical', 'hand'], ['mixed', 'shuffle']],
  publicity: [['yes', 'camera'], ['no', 'eye-off'], ['maybe', 'help']],
  blogging: [['yes', 'mic'], ['no', 'x'], ['curious', 'help']],
  capital: [['none', 'x'], ['small', 'leaf'], ['medium', 'wallet'], ['large', 'briefcase']],
};
export const MODE_CARDS = [['explore', 'compass'], ['deep_dive', 'search'], ['compare', 'scale']];
export const CLARIFY_CARDS = [['ask_first', 'help'], ['assume', 'bulb']];
export const HORIZONS = [3, 6, 12, 24];
export const SERVICE_ICON = 'external';
export const STEPS = 5;
// Fields shown in quick mode (the other fields are hidden and stay "not specified"):
// interests (step 1), skills (step 2), age + location (step 3), balance (step 4).
