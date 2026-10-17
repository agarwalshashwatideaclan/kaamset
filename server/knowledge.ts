import type { Mode, SourceLink } from '../shared/domain.ts';

interface Source extends SourceLink {
  scope: string;
  reviewed: string;
  modes: readonly Mode[];
  facts: string;
}

/** Reviewed by hand against the official pages on the `reviewed` date. Not live retrieval. */
export const SOURCES: readonly Source[] = [
  {
    id: 'eshram_faq',
    title: 'e-Shram FAQs',
    publisher: 'Ministry of Labour and Employment',
    url: 'https://eshram.gov.in/faqs',
    scope: 'India (national)',
    reviewed: '2026-10-17',
    modes: ['rights_welfare', 'documents', 'grievance'],
    facts: [
      'e-Shram is a national database of unorganised workers run by the Ministry of Labour and Employment.',
      'An unorganised worker is a home-based, self-employed or wage worker in the unorganised sector who is not a member of ESIC or EPFO.',
      'Workers aged 16 or above can register. The FAQ states there is no income criterion for registration.',
      'Registration on the e-Shram portal is free.',
      'To self-register you need your Aadhaar number and the mobile number linked to Aadhaar. Without an Aadhaar-linked mobile, a worker can register at a Common Service Centre (CSC) or State Seva Kendra using biometric authentication.',
      'Proof of date of birth, income proof and educational qualification are not required for registration.',
      'Bank account details are mentioned as information that can be updated in the profile; the FAQ does not list them as a registration requirement.',
      'After registration the worker gets a permanent 12-digit Universal Account Number (UAN). The e-Shram card does not expire and does not need renewal.',
      'e-Shram helpline: 14434. e-Shram related grievances (about registration or the e-Shram card) can be raised at gms.eshram.gov.in; the FAQ does not say it handles payment or account disputes with platforms, contractors or employers.',
      'The database is meant to help deliver social security schemes. The FAQ lists PMSBY among schemes accessible via e-Shram but gives no benefit amounts or eligibility details. Registration alone does not guarantee any payment or scheme benefit.',
    ].join(' '),
  },
  {
    id: 'pib_labour_codes',
    title: 'Government makes the four Labour Codes effective (21 Nov 2025)',
    publisher: 'Press Information Bureau, Government of India',
    url: 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=2192463',
    scope: 'India (national); states also make rules',
    reviewed: '2026-10-17',
    modes: ['rights_welfare', 'grievance'],
    facts: [
      'The Code on Wages 2019, Industrial Relations Code 2020, Code on Social Security 2020 and Occupational Safety, Health and Working Conditions Code 2020 were made effective from 21 November 2025.',
      'Gig work, platform work and aggregators are defined for the first time. Aggregators must contribute 1-2% of annual turnover, capped at 5% of the amount paid or payable to gig and platform workers.',
      'An Aadhaar-linked Universal Account Number is meant to make welfare benefits portable across states.',
      'For employees, the release says the Code on Wages gives all workers a statutory right to minimum wage and makes timely wage payment mandatory for employers, and says appointment letters are mandatory.',
      'IMPORTANT LIMIT: these minimum-wage, timely-wage and appointment-letter statements describe employer-employee relationships. The reviewed material does NOT establish that a platform delivery partner or app-based driver is an employee or is owed a minimum wage by a platform. Do not state that. For daily-wage workers hired by an employer, explain these as points to check with the labour department, not as a verdict.',
    ].join(' '),
  },
  {
    id: 'pib_gig_backgrounder',
    title: 'Labour Reforms: Formalising and Safeguarding India’s Gig & Platform Workforce (9 Dec 2025)',
    publisher: 'Press Information Bureau, Government of India',
    url: 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=2200767',
    scope: 'India (national)',
    reviewed: '2026-10-17',
    modes: ['rights_welfare', 'grievance', 'documents'],
    facts: [
      'The Code on Social Security 2020 formally recognises gig workers and platform workers. Before it, they had no recognition under the Payment of Wages Act, Minimum Wages Act, EPF Act or ESI Act.',
      'Aggregators contribute to a Social Security Fund that finances welfare schemes. Schemes listed for these workers include life and disability cover, health and maternity benefits, pension, accident insurance and creche, to be framed by government; specific scheme amounts and eligibility are not given in this release.',
      'Gig and platform workers can self-register on the e-Shram portal and get a unique Aadhaar-linked ID so benefits are portable across platforms.',
      'Under the Code, the appropriate Government MAY set up a toll-free helpline, call centre or facilitation centre for worker grievances. The release does not give a number or say one is operating everywhere.',
    ].join(' '),
  },
  {
    id: 'myscheme_about',
    title: 'About myScheme',
    publisher: 'National e-Governance Division (MeitY)',
    url: 'https://www.myscheme.gov.in/about',
    scope: 'India (central and state schemes)',
    reviewed: '2026-10-17',
    modes: ['rights_welfare', 'documents'],
    facts: [
      'myScheme is a national platform for one-stop search of government schemes, operated by the National e-Governance Division with MeitY and DARPG.',
      'Users can search with filters, check which schemes they may qualify for by entering their details, and read each scheme page before applying.',
      'KaamSet has NOT reviewed any individual scheme’s eligibility, benefit amount or deadline; always send the worker to the scheme page on myScheme or the state department to confirm.',
    ].join(' '),
  },
  {
    id: 'ndma_heatwave',
    title: 'Heat Wave guidance',
    publisher: 'National Disaster Management Authority',
    url: 'https://ndma.gov.in/Natural-Hazards/Heat-Wave',
    scope: 'India (national)',
    reviewed: '2026-10-17',
    modes: ['safety'],
    facts: [
      'Heat stroke (body temperature of 40°C / 104°F or more with confusion, seizures or unconsciousness) is potentially fatal.',
      'If someone is suffering from heat: move them to a cool, shaded place; give water or a rehydrating drink only if they are conscious; fan them and cool them with a wet cloth; do not give alcohol, caffeine or aerated drinks; get a doctor if symptoms worsen, last long, or the person is unconscious.',
    ].join(' '),
  },
];

export function sourcesForMode(mode: Mode): readonly Source[] {
  return SOURCES.filter(s => s.modes.includes(mode));
}

export function toLinks(ids: readonly string[], mode: Mode): SourceLink[] {
  const allowed = sourcesForMode(mode);
  return ids.flatMap(id => {
    const s = allowed.find(x => x.id === id);
    return s ? [{ id: s.id, title: s.title, publisher: s.publisher, url: s.url }] : [];
  });
}
