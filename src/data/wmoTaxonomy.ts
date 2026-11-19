import type { CloudEtage, GenusCode } from '../types/cloud';

export interface WmoGenusDefinition {
  code: GenusCode;
  latinName: string;
  etage: CloudEtage;
  altitudeRange: string;
  composition: string;
  mechanism: string;
  commonSpeciesVarieties: string[];
  visualSignature: string;
}

export const WMO_GENERA: WmoGenusDefinition[] = [
  {
    code: 'Ci',
    latinName: 'Cirrus',
    etage: 'High (CH > 6 km)',
    altitudeRange: '6,000 – 13,000 m',
    composition: 'Ice crystals',
    mechanism: 'Upper-tropospheric jet streaks, anvil outflow, or aviation contrail spreading.',
    commonSpeciesVarieties: [
      'Cirrus fibratus',
      'Cirrus fibratus intortus',
      'Cirrus uncinus radiatus',
      'Cirrus spissatus',
      'Cirrus homogenitus',
      'Cirrus homomutatus',
    ],
    visualSignature: 'Detached fibrous filaments, silky sheen, hooked tufts or linear bands.',
  },
  {
    code: 'Cc',
    latinName: 'Cirrocumulus',
    etage: 'High (CH > 6 km)',
    altitudeRange: '6,000 – 12,000 m',
    composition: 'Ice crystals & supercooled droplets',
    mechanism: 'Shallow convective instability and gravity waves in high-altitude moisture layers.',
    commonSpeciesVarieties: [
      'Cirrocumulus stratiformis',
      'Cirrocumulus lenticularis',
      'Cirrocumulus castellanus',
      'Cirrocumulus floccus',
    ],
    visualSignature: 'Thin white sheet or patch of tiny rippled grains (< 1° apparent width) without shading.',
  },
  {
    code: 'Cs',
    latinName: 'Cirrostratus',
    etage: 'High (CH > 6 km)',
    altitudeRange: '6,000 – 12,000 m',
    composition: 'Ice crystals',
    mechanism: 'Broad synoptic-scale gentle ascent ahead of approaching warm fronts or upper troughs.',
    commonSpeciesVarieties: [
      'Cirrostratus fibratus',
      'Cirrostratus fibratus undulatus',
      'Cirrostratus fibratus fluctus',
      'Cirrostratus nebulosus',
    ],
    visualSignature: 'Transparent whitish veil partially or wholly covering the sky; often produces solar/lunar halos.',
  },
  {
    code: 'Ac',
    latinName: 'Altocumulus',
    etage: 'Middle (CM 2–6 km)',
    altitudeRange: '2,000 – 6,000 m',
    composition: 'Liquid water droplets (often supercooled)',
    mechanism: 'Mid-tropospheric wave motion, elevated convective instability, or orographic lift.',
    commonSpeciesVarieties: [
      'Altocumulus stratiformis',
      'Altocumulus stratiformis perlucidus',
      'Altocumulus lenticularis',
      'Altocumulus castellanus',
      'Altocumulus floccus',
    ],
    visualSignature: 'White or grey patches/sheets of rounded masses or rolls (1°–5° apparent width), often shaded.',
  },
  {
    code: 'As',
    latinName: 'Altostratus',
    etage: 'Middle (CM 2–6 km)',
    altitudeRange: '2,000 – 6,000 m',
    composition: 'Mixed ice crystals & liquid droplets',
    mechanism: 'Sustained synoptic uplift along warm or occluded frontal boundaries.',
    commonSpeciesVarieties: [
      'Altostratus translucidus',
      'Altostratus translucidus praecipitatio',
      'Altostratus opacus',
      'Altostratus undulatus',
    ],
    visualSignature: 'Greyish or bluish uniform sheet covering the sky; sun appears dimly as through frosted glass.',
  },
  {
    code: 'Ns',
    latinName: 'Nimbostratus',
    etage: 'Middle (CM 2–6 km)',
    altitudeRange: '500 – 4,000 m (thick multi-km layer)',
    composition: 'Water droplets, raindrops, & snow',
    mechanism: 'Deep, prolonged frontal convergence and saturation producing continuous precipitation.',
    commonSpeciesVarieties: [
      'Nimbostratus praecipitatio',
      'Nimbostratus pannus',
      'Nimbostratus virga',
    ],
    visualSignature: 'Dark grey, diffuse, featureless cloud layer thick enough to completely blot out the sun.',
  },
  {
    code: 'Sc',
    latinName: 'Stratocumulus',
    etage: 'Low (CL < 2 km)',
    altitudeRange: '300 – 2,000 m',
    composition: 'Liquid water droplets',
    mechanism: 'Planetary boundary-layer mixing capped by a subsidence or nocturnal inversion.',
    commonSpeciesVarieties: [
      'Stratocumulus stratiformis undulatus',
      'Stratocumulus castellanus radiatus',
      'Stratocumulus cumulogenitus',
      'Stratocumulus perlucidus',
    ],
    visualSignature: 'Grey or whitish lumpy patches, rolls, or mosaic sheets (> 5° apparent width) with non-fibrous elements.',
  },
  {
    code: 'St',
    latinName: 'Stratus',
    etage: 'Low (CL < 2 km)',
    altitudeRange: '0 – 800 m',
    composition: 'Small liquid water droplets',
    mechanism: 'Radiative cooling, advection over cool surfaces, or lifted morning fog.',
    commonSpeciesVarieties: [
      'Stratus nebulosus',
      'Stratus fractus',
      'Stratus opacus',
    ],
    visualSignature: 'Low, uniform grey layer resembling elevated fog; may yield drizzle or mist.',
  },
  {
    code: 'Cu',
    latinName: 'Cumulus',
    etage: 'Low (CL < 2 km)',
    altitudeRange: '400 – 2,000 m (tops up to 5 km for congestus)',
    composition: 'Liquid water droplets',
    mechanism: 'Surface solar heating driving buoyant thermal plumes in the convective boundary layer.',
    commonSpeciesVarieties: [
      'Cumulus humilis',
      'Cumulus humilis radiatus',
      'Cumulus mediocris radiatus',
      'Cumulus congestus',
      'Cumulus fractus',
    ],
    visualSignature: 'Detached, dense clouds with sharp cauliflower outlines, sunlit white tops, and flat horizontal bases.',
  },
  {
    code: 'Cb',
    latinName: 'Cumulonimbus',
    etage: 'Vertical (Multi-level)',
    altitudeRange: '500 – 16,000+ m',
    composition: 'Liquid droplets below, ice crystals aloft',
    mechanism: 'Deep moist convection releasing latent heat through the entire troposphere to the tropopause.',
    commonSpeciesVarieties: [
      'Cumulonimbus calvus',
      'Cumulonimbus capillatus',
      'Cumulonimbus capillatus incus',
      'Cumulonimbus arcus',
    ],
    visualSignature: 'Towering dense storm mass with dark base and fibrous or anvil-shaped icy summit.',
  },
];

export const COMMON_CLASSIFICATIONS: string[] = Array.from(
  new Set(WMO_GENERA.flatMap((g) => g.commonSpeciesVarieties))
);

export const ETAGES: CloudEtage[] = [
  'High (CH > 6 km)',
  'Middle (CM 2–6 km)',
  'Low (CL < 2 km)',
  'Vertical (Multi-level)',
  'Unclassified',
];

export function getEtageForGenus(code: GenusCode): CloudEtage {
  const match = WMO_GENERA.find((g) => g.code === code);
  return match ? match.etage : 'Unclassified';
}

export function inferGenusFromTitle(title: string): { genusCode: GenusCode; etage: CloudEtage } {
  const lower = title.toLowerCase().trim();
  if (lower.includes('cumulonimbus') || lower.startsWith('cb ')) {
    return { genusCode: 'Cb', etage: 'Vertical (Multi-level)' };
  }
  if (lower.includes('cirrocumulus') || lower.startsWith('cc ')) {
    return { genusCode: 'Cc', etage: 'High (CH > 6 km)' };
  }
  if (lower.includes('cirrostratus') || lower.startsWith('cs ')) {
    return { genusCode: 'Cs', etage: 'High (CH > 6 km)' };
  }
  if (lower.includes('cirrus') || lower.startsWith('ci ')) {
    return { genusCode: 'Ci', etage: 'High (CH > 6 km)' };
  }
  if (lower.includes('altocumulus') || lower.startsWith('ac ')) {
    return { genusCode: 'Ac', etage: 'Middle (CM 2–6 km)' };
  }
  if (lower.includes('altostratus') || lower.startsWith('as ')) {
    return { genusCode: 'As', etage: 'Middle (CM 2–6 km)' };
  }
  if (lower.includes('nimbostratus') || lower.startsWith('ns ')) {
    return { genusCode: 'Ns', etage: 'Middle (CM 2–6 km)' };
  }
  if (lower.includes('stratocumulus') || lower.startsWith('sc ')) {
    return { genusCode: 'Sc', etage: 'Low (CL < 2 km)' };
  }
  if (lower.includes('stratus') || lower.startsWith('st ')) {
    return { genusCode: 'St', etage: 'Low (CL < 2 km)' };
  }
  if (lower.includes('cumulus') || lower.startsWith('cu ')) {
    if (lower.includes('congestus')) {
      return { genusCode: 'Cu', etage: 'Vertical (Multi-level)' };
    }
    return { genusCode: 'Cu', etage: 'Low (CL < 2 km)' };
  }
  return { genusCode: 'Unknown', etage: 'Unclassified' };
}

const SPECIES_VARIETY_ABBR: Record<string, string> = {
  fibratus: 'fib',
  uncinus: 'unc',
  spissatus: 'spi',
  castellanus: 'cas',
  floccus: 'flo',
  stratiformis: 'str',
  nebulosus: 'neb',
  lenticularis: 'len',
  fractus: 'fra',
  humilis: 'hum',
  mediocris: 'med',
  congestus: 'con',
  calvus: 'cal',
  capillatus: 'cap',
  intortus: 'in',
  vertebratus: 've',
  undulatus: 'un',
  radiatus: 'ra',
  lacunosus: 'la',
  duplicatus: 'du',
  translucidus: 'tr',
  perlucidus: 'pe',
  opacus: 'op',
  incus: 'inc',
  mamma: 'mam',
  virga: 'vir',
  praecipitatio: 'pra',
  arcus: 'arc',
  fluctus: 'flu',
  pannus: 'pan',
  homogenitus: 'hom',
  homomutatus: 'hom-mut',
  cumulogenitus: 'cugen',
};

export function inferAbbreviationFromTitle(title: string, genusCode?: GenusCode): string {
  const { genusCode: inferredCode } = inferGenusFromTitle(title);
  const code = inferredCode !== 'Unknown' ? inferredCode : genusCode && genusCode !== 'Unknown' ? genusCode : '';
  const words = title
    .toLowerCase()
    .replace(/[^a-z\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const suffixParts: string[] = [];
  for (const w of words) {
    if (SPECIES_VARIETY_ABBR[w]) {
      suffixParts.push(SPECIES_VARIETY_ABBR[w]);
    }
  }

  if (code && suffixParts.length > 0) {
    return `${code} ${suffixParts.join(' ')}`;
  }
  if (code) {
    return code;
  }
  return words.slice(0, 3).map((w) => w.slice(0, 3)).join(' ');
}
