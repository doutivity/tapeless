// The Tapeless mark: a "T" cut from caution tape on a dark tile. One source for the header logo and favicon.svg.
const stripes = (id, clip, [x0, x1, y0, y1], w = 5, gap = 5) => {
  let out = `<clipPath id="${id}">${clip}</clipPath><g clip-path="url(#${id})">`;
  for (let k = x0 - (y1 - y0); k < x1; k += w + gap) out += `<polygon points="${k},${y1} ${k + w},${y1} ${k + w + (y1 - y0)},${y0} ${k + (y1 - y0)},${y0}" fill="#1f1f1f"/>`;
  return out + '</g>';
};
const T = '<rect x="8" y="9" width="32" height="9" rx="1.5"/><rect x="19.5" y="9" width="9" height="31" rx="1.5"/>';
const body = (id) => `<rect class="mk-tile" x="2" y="2" width="44" height="44" rx="10" fill="#1f1f1f"/>${T.replace(/<rect /g, '<rect fill="#f5c400" ')}${stripes(id, T, [4, 50, 4, 44])}`;

// Inline logo for page headers (decorative: the name is next to it).
export const logoSvg = () => `<svg class="logo-mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false">${body('lm')}</svg>`;

// Standalone file: on a dark browser UI the tile gets a light outline so it does not vanish.
export const faviconSvg = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
<style>.mk-tile{stroke:none}@media (prefers-color-scheme:dark){.mk-tile{stroke:#98a3ad;stroke-opacity:.7;stroke-width:1.4}}</style>
${body('ft')}
</svg>
`;
