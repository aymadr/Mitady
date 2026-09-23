// Domain presets and skill matching. A domain seeds the search keywords and the
// skill dictionary used to read offers; the user's own skills are always added on top.

const DOMAINS = {
  cyber: {
    label: 'Cybersécurité',
    keywords: ['cybersécurité', 'sécurité informatique', 'analyste soc', 'pentest', 'grc'],
    titleHints: ['cyber', 'securit', 'soc', 'pentest', 'grc', 'rssi', 'secops', 'audit', 'reseau', 'systeme', 'infra', 'cloud'],
    skills: [
      'SOC', 'SIEM', 'Splunk', 'QRadar', 'Sentinel', 'ELK', 'EDR', 'XDR', 'SentinelOne', 'CrowdStrike', 'Sekoia', 'Vectra',
      'Threat Intelligence', 'OSINT', 'MITRE ATT&CK', 'Forensic', 'Pentest', 'Burp Suite', 'Metasploit', 'Nmap', 'Wireshark',
      'Kali', 'OWASP', 'GRC', 'ISO 27001', 'EBIOS RM', 'RGPD', 'NIS2', 'PCI DSS', 'Analyse de risques', 'PAM', 'IAM',
      'Active Directory', 'PingCastle', 'Firewall', 'Fortinet', 'Palo Alto', 'pfSense', 'VPN', 'IDS', 'IPS', 'PKI',
      'Linux', 'Windows Server', 'Bash', 'PowerShell', 'Python', 'Docker', 'Kubernetes', 'AWS', 'Azure', 'VMware', 'Proxmox',
      'TCP/IP', 'DNS', 'DHCP', 'VLAN', 'Git', 'SQL', 'Ansible', 'Terraform', 'Zabbix', 'Grafana', 'GLPI',
      'Gestion des incidents', 'Réponse à incident', 'Vulnérabilités', 'Scan de vulnérabilités', 'Nessus', 'Qualys', 'Tests d\'intrusion',
      'PSSI', 'Politique de sécurité', 'Sensibilisation', 'Phishing', 'Veille', 'Supervision', 'Durcissement', 'Chiffrement',
      'Microsoft 365', 'Entra ID', 'Intune', 'MFA', 'Zero Trust', 'Cloud', 'Réseaux', 'Windows', 'DORA', 'ISO 27005', 'ANSSI', 'Homologation',
      'Plan de continuité', 'Anglais',
    ],
  },
  finance: {
    label: 'Finance',
    keywords: ['finance', 'contrôle de gestion', 'analyste financier', 'audit financier', 'comptabilité'],
    titleHints: ['financ', 'gestion', 'compta', 'audit', 'analyst', 'tresor', 'credit', 'risque', 'banque', 'invest', 'fiscal', 'consolidation'],
    skills: [
      'Excel', 'VBA', 'Power BI', 'Tableau', 'SAP', 'Oracle', 'Sage', 'Cegid', 'Bloomberg', 'Refinitiv', 'Python', 'SQL',
      'Modélisation financière', 'DCF', 'LBO', 'M&A', 'Valorisation', 'Due diligence', 'Consolidation', 'IFRS', 'Normes françaises',
      'Contrôle de gestion', 'Budget', 'Reporting', 'Forecast', 'Trésorerie', 'Comptabilité générale', 'Comptabilité analytique',
      'Fiscalité', 'Audit', 'Analyse financière', 'Gestion des risques', 'Bâle III', 'Solvabilité II', 'Conformité', 'KYC', 'AML',
      'Marchés financiers', 'Produits dérivés', 'Asset management', 'Private equity', 'Crédit', 'Business plan', 'Anglais',
    ],
  },
  data: {
    label: 'Data & IA',
    keywords: ['data analyst', 'data scientist', 'data engineer', 'machine learning', 'business intelligence'],
    titleHints: ['data', 'donnee', 'ia', 'machine learning', 'bi', 'analyst', 'scien', 'statisti'],
    skills: [
      'Python', 'SQL', 'Pandas', 'NumPy', 'Scikit-learn', 'TensorFlow', 'PyTorch', 'Machine Learning', 'Deep Learning',
      'NLP', 'LLM', 'Statistiques', 'Spark', 'Hadoop', 'Databricks', 'Snowflake', 'BigQuery', 'dbt', 'Airflow', 'ETL',
      'Power BI', 'Tableau', 'Looker', 'Excel', 'AWS', 'Azure', 'GCP', 'Docker', 'Git', 'API', 'PostgreSQL', 'MongoDB',
    ],
  },
  dev: {
    label: 'Développement',
    keywords: ['développeur', 'développeur web', 'ingénieur logiciel', 'full stack', 'backend'],
    titleHints: ['develop', 'logiciel', 'software', 'full stack', 'fullstack', 'backend', 'frontend', 'web', 'mobile', 'devops'],
    skills: [
      'JavaScript', 'TypeScript', 'React', 'Vue', 'Angular', 'Node.js', 'Next.js', 'HTML', 'CSS', 'Python', 'Django', 'Flask',
      'Java', 'Spring', 'C#', '.NET', 'PHP', 'Symfony', 'Laravel', 'Go', 'Rust', 'C++', 'Kotlin', 'Swift', 'Flutter',
      'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'REST', 'GraphQL', 'Docker', 'Kubernetes', 'CI/CD', 'Git',
      'AWS', 'Azure', 'GCP', 'Linux', 'Tests unitaires', 'Agile', 'Scrum',
    ],
  },
  infra: {
    label: 'Systèmes & réseaux',
    keywords: ['administrateur systèmes et réseaux', 'technicien informatique', 'ingénieur réseau', 'devops', 'cloud'],
    titleHints: ['system', 'reseau', 'infra', 'admin', 'technicien', 'support', 'cloud', 'devops', 'exploitation'],
    skills: [
      'Linux', 'Windows Server', 'Active Directory', 'GPO', 'Bash', 'PowerShell', 'VMware', 'Proxmox', 'Hyper-V',
      'Cisco', 'TCP/IP', 'VLAN', 'Routage', 'DNS', 'DHCP', 'VPN', 'Firewall', 'pfSense', 'Fortinet', 'HSRP', 'VRRP',
      'Docker', 'Kubernetes', 'Ansible', 'Terraform', 'AWS', 'Azure', 'Office 365', 'Intune', 'GLPI', 'ITIL',
      'Zabbix', 'Grafana', 'Nagios', 'Sauvegarde', 'Veeam', 'Git', 'Python',
    ],
  },
  marketing: {
    label: 'Marketing & communication',
    keywords: ['marketing digital', 'chargé de communication', 'community manager', 'chef de projet marketing'],
    titleHints: ['marketing', 'communication', 'community', 'contenu', 'brand', 'digital', 'growth', 'seo', 'social'],
    skills: [
      'SEO', 'SEA', 'Google Ads', 'Meta Ads', 'Google Analytics', 'Réseaux sociaux', 'Community management', 'Content marketing',
      'Copywriting', 'Emailing', 'CRM', 'HubSpot', 'Salesforce', 'Canva', 'Figma', 'Photoshop', 'Illustrator', 'InDesign',
      'WordPress', 'Stratégie de marque', 'Relations presse', 'Événementiel', 'Études de marché', 'Growth hacking', 'Anglais',
    ],
  },
  rh: {
    label: 'Ressources humaines',
    keywords: ['ressources humaines', 'chargé de recrutement', 'gestionnaire paie', 'talent acquisition'],
    titleHints: ['rh', 'ressources humaines', 'recrut', 'talent', 'paie', 'formation', 'people'],
    skills: [
      'Recrutement', 'Sourcing', 'Entretiens', 'Onboarding', 'Paie', 'Administration du personnel', 'Droit du travail',
      'GPEC', 'Formation', 'SIRH', 'Workday', 'SAP SuccessFactors', 'Excel', 'Marque employeur', 'LinkedIn Recruiter',
      'Relations sociales', 'QVT', 'Reporting RH', 'Anglais',
    ],
  },
  commerce: {
    label: 'Commerce & vente',
    keywords: ['business developer', 'commercial', 'chargé d\'affaires', 'account manager'],
    titleHints: ['commercial', 'vente', 'business', 'account', 'affaires', 'sales', 'client'],
    skills: [
      'Prospection', 'Négociation', 'CRM', 'Salesforce', 'HubSpot', 'Cycle de vente', 'Grands comptes', 'B2B', 'B2C',
      'Relation client', 'Business development', 'Closing', 'Excel', 'Reporting', 'Anglais', 'LinkedIn Sales Navigator',
    ],
  },
};

// Training organisations that post fake "offers" to recruit students.
const DEFAULT_EXCLUDED = [
  'ISCOD', 'Sup de Vinci', 'CESI', 'Nexa', 'OpenClassrooms', 'MyDigitalSchool', 'Studi', 'Aurlom', 'EPSI', 'CyberSup',
  'IEF2I', 'IFCDIS', 'RedSup', 'IFFP', 'Livecampus', 'Ironhack', 'Jedha', 'DataScientest', 'Simplon', 'IPSSI', 'Guardia',
  'Oteria', 'Hexagone', 'École', 'School', 'Campus', 'Academy', 'CFA', 'Formation',
];

function norm(str = '') {
  return String(str).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function escapeRe(s) {
  return s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

const reCache = new Map();
function skillRegex(skill) {
  const key = norm(skill);
  if (!reCache.has(key)) {
    // Word boundaries that also work around symbols such as "C#", ".NET", "CI/CD".
    reCache.set(key, new RegExp(`(^|[^a-z0-9])${escapeRe(key)}(?=$|[^a-z0-9])`, 'i'));
  }
  return reCache.get(key);
}

function hasSkill(text, skill) {
  return skillRegex(skill).test(text);
}

function dictionaryFor(profile) {
  const domain = DOMAINS[profile.search?.domain];
  const all = [...(domain ? domain.skills : Object.values(DOMAINS).flatMap((d) => d.skills)), ...(profile.skills || [])];
  const seen = new Set();
  return all.filter((s) => {
    const k = norm(s);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// Returns { skills, matched, missing, score } for an offer against the profile.
function analyzeOffer(offer, profile) {
  const text = norm(`${offer.title}\n${offer.description}`);
  const skills = dictionaryFor(profile).filter((s) => hasSkill(text, s));
  const mine = new Set((profile.skills || []).map(norm));
  const matched = skills.filter((s) => mine.has(norm(s)));
  const missing = skills.filter((s) => !mine.has(norm(s)));
  // Smoothed ratio: 2/2 gives 75 %, 10/10 gives 92 %. Few mentions = less certainty.
  const score = skills.length >= 2 ? Math.round(((matched.length + 1) / (skills.length + 2)) * 100) : null;
  return { skills, matched, missing, score };
}

// Everyday words that are skills in an offer but mostly headings or noise in a CV.
const NOT_DETECTED_IN_CV = new Set(
  ['Formation', 'Entretiens', 'Budget', 'Crédit', 'Conformité', 'Sauvegarde', 'Reporting', 'Onboarding', 'Closing', 'Prospection', 'Paie', 'Recrutement', 'Routage', 'Audit'].map(norm),
);

// Detects skills from any domain in free text (used when importing a CV).
function detectSkills(text, extra = []) {
  const t = norm(text);
  const pool = [...Object.values(DOMAINS).flatMap((d) => d.skills), ...extra];
  const seen = new Set(NOT_DETECTED_IN_CV);
  return pool.filter((s) => {
    const k = norm(s);
    if (seen.has(k) || s.length < 2 || !hasSkill(t, s)) return false;
    seen.add(k);
    return true;
  });
}

function isExcluded(company, excluded = []) {
  const c = norm(company);
  return excluded.some((e) => e && skillRegex(e).test(c));
}

function domainList() {
  return Object.entries(DOMAINS).map(([id, d]) => ({ id, label: d.label, keywords: d.keywords, skills: d.skills }));
}

module.exports = { DOMAINS, DEFAULT_EXCLUDED, norm, analyzeOffer, detectSkills, isExcluded, domainList, hasSkill };
