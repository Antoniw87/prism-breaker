// The five levels of Prism Breaker, each a grid of 11 columns. A letter is one prism:
//   n — a plain prism (points by row)
//   b — a bonus prism: worth more and always drops a power-up
//   t — a tough prism: two hits to break, worth the most
//   . — empty space
// Level 1 is two full rows (22 prisms). The grids are data, not code: the world builds
// its bricks from them, so a level is tuned by editing letters here.
export const KIND_NORMAL = 0;
export const KIND_TOUGH = 1;
export const KIND_BONUS = 2;

export const LEVEL_GRIDS = [
  [
    'nnnnnnnnnnn',
    'nnnnnnnnnnn',
  ],
  [
    '.....n.....',
    '....nnn....',
    '...nnnnn...',
    '..nnnnnnn..',
    '.nnnnnnnnn.',
    'nnnnnnnnnnn',
  ],
  [
    'nnnnnnnnnnn',
    'n.........n',
    'n..bbbbb..n',
    'n..btttb..n',
    'n.........n',
    'nnnnnnnnnnn',
  ],
  [
    '.....t.....',
    '....nnn....',
    '...nbnbn...',
    '..nnnnnnn..',
    '...nnnnn...',
    '....nnn....',
    '.....t.....',
  ],
  [
    't.........t',
    'tn.......nt',
    'tnn.....nnt',
    '.nnnbbbnnn.',
    '.nnnnnnnnn.',
    '..nnnnnnn..',
  ],
];
