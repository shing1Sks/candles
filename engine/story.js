// WHAT HAPPENED, told sideways (research/02 §7, research/07 phase 4). Nothing here is ever said
// outright. The school's own voice (the PA, the board, detention) keeps telling the official version;
// the pages, the children and the walls tell the other one, and they say more the more pages you hold.
//   the official version: the end-of-term concert in the Hall; the doors locked "for the performance";
//                         everyone very good and very quiet
//   the other one:        a fire during the concert; the doors were locked; one boy was not in the Hall

// the PA, at the start of the night and as each act begins (index: act 1..4); later lines once you
// know more (pages >= 3)
export const PA = {
  1: ['Good afternoon, children. Today is the end-of-term concert. Best behaviour, please.'],
  2: ['Would all children make their way to the Hall. The concert will begin shortly.'],
  3: ['The Hall doors will now be locked for the performance, so nobody gets lost. Thank you for being so quiet.', 'The Hall doors are locked. Nobody needs to leave. Thank you for being so quiet.'],
  4: ['Would the child who is not in the Hall please come to the Hall.', 'Would the child who is not in the Hall please come to the Hall. We are all waiting for you.'],
};
export const paLine = (act, pages) => { const p = PA[act] || PA[1]; return p[Math.min(p.length - 1, pages >= 3 ? 1 : 0)]; };

// what you write in detention: the more you know, the stranger the line they make you write
export const DETENTION_LINES = ['I will not leave.', 'I will not wander during the concert.', 'I will not open the Hall doors.', 'I did not smell smoke.', 'I was not there.', 'Nobody got out.'];
export const detentionLine = (pages) => DETENTION_LINES[Math.min(DETENTION_LINES.length - 1, pages)];

// the Hall doors, chained: what you notice there, by how many pages you hold
export const HALL_LINES = [
  'Chained shut. Through the gap under the doors: the smell of a bonfire.',
  'Chained. On the other side, very faintly, children are singing.',
  'The chain goes through both handles. It was done from this side.',
  'Small hands, all over the bottom of the doors. All of them on the inside.',
  'The chain is warm.',
  'Someone on the other side is calling the register. They stop at your name.',
];
export const hallLine = (pages) => HALL_LINES[Math.min(HALL_LINES.length - 1, pages)];

// the true ending, card by card, when you open the Hall with every page
export const TRUE_ENDING = ['The chain is gone.', 'Every chair in the Hall is taken but one.', 'The register is read to the end. Your name is the last.', 'Everyone is here. Everyone can go home.'];

// Story Time drifts toward the concert as you learn more
export const STORY_LATE = {
  start: [['Once, there was a boy who came in late.'], ['Once, there was a concert, and every child had to go.', 'Once, all the children sang in the Hall. All but one.'], ['Once, the doors were locked so nobody would get lost.']],
  end: [['…and then she caught him.'], ['…and then the doors were locked.'], ['…and nobody got out. Except one.']],
};
export const storyTier = (pages) => (pages >= 4 ? 2 : pages >= 2 ? 1 : 0);
