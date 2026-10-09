var MAPPER_PROTOCOL = "EXTRACT_PROFILE_V128";
globalThis.__xqtivMapperProtocols ||= new Set();
if (!globalThis.__xqtivMapperProtocols.has(MAPPER_PROTOCOL)) {
  globalThis.__xqtivMapperProtocols.add(MAPPER_PROTOCOL);
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === MAPPER_PROTOCOL) {
      extractProfile().then(sendResponse).catch((error) => sendResponse({ error: error?.message || String(error) }));
      return true;
    }
  });
}

async function extractProfile() {
  const main = document.querySelector("main, [role=main]") || document.body;
  const structured = extractStructuredProfile();
  const name = extractName(structured);
  const location = extractLocation(main, name, structured);
  const item = findCurrentExperienceItem(main);
  const headerJob = item ? {company:'',currentTitle:''} : extractHeaderJob(main, structured);
  let company = item ? extractCompanyFromExperienceItem(item) : headerJob.company;
  const lines = item ? [...item.querySelectorAll("p, span[aria-hidden='true'], time")].map(n=>clean(n.textContent)).filter(Boolean) : [];
  let currentTitle = item ? extractTitleFromExperienceLines(lines.length ? lines : cleanLines(item.innerText), company) : headerJob.currentTitle;
  if(!company || !currentTitle){const visible=extractVisibleExperience(main.innerText || '');if(visible.company&&visible.currentTitle){company=visible.company;currentTitle=visible.currentTitle;}}
  return {
    name,
    company,
    currentTitle,
    location,
    linkedinUrl: canonicalUrl(locationHref())
  };
}

// Rendered text fallback for layouts without stable section/list selectors.
function extractVisibleExperience(text) {
  const all=cleanLines(text).filter((line,index,lines)=>line!==lines[index-1]);
  const start=all.findIndex(line=>/^experience$/i.test(line));
  if(start<0)return {company:'',currentTitle:''};
  const next=all.findIndex((line,index)=>index>start&&/^(education|licenses? & certifications?|skills|recommendations|volunteering|interests|projects|publications)$/i.test(line));
  const lines=all.slice(start+1,next<0?undefined:next);
  const employment=/^(.*?)\s*[·|]\s*(full[- ]?time|part[- ]?time|contract|self-employed|freelance|internship|temporary|apprenticeship|seasonal)\b/i;
  let previousDate=-1;
  for(let i=0;i<lines.length;i++){
    if(!/\b(?:19|20)\d{2}\b.*(?:–|-|—|to).*\b(?:present|current)\b/i.test(lines[i])){if(/\b(?:19|20)\d{2}\b.*(?:–|-|—|to)/i.test(lines[i]))previousDate=i;continue;}
    const before=lines.slice(Math.max(previousDate+1,i-7),i);
    // Ordinary job: Title, Employer [· employment type], current dates.
    const last=before.at(-1)||'',prior=before.at(-2)||'';
    const employer=last.match(employment);
    if(employer&&isPlausibleCompany(employer[1])&&isPlausibleCurrentTitle(prior))return {company:cleanCompany(employer[1]),currentTitle:prior};
    // Grouped employer: Employer, tenure/type, Title, current dates.
    if(isPlausibleCurrentTitle(last)){
      for(let j=before.length-2;j>=1;j--){
        if(/^(?:(?:full[- ]?time|part[- ]?time)\s*·\s*)?\d+\s*(?:yrs?|years?|mos?|months?)\b/i.test(before[j])&&isPlausibleCompany(before[j-1]))return {company:cleanCompany(before[j-1]),currentTitle:last};
      }
    }
    if(before.length>=2&&isPlausibleCompany(last)&&isPlausibleCurrentTitle(prior)&&!/^(full[- ]?time|part[- ]?time|contract)$/i.test(last))return {company:cleanCompany(last),currentTitle:prior};
    previousDate=i;
  }
  return {company:'',currentTitle:''};
}

// Only read the profile header, never unrelated company links elsewhere on the page.
function extractHeaderJob(main, structured = {}) {
  const h1 = main.querySelector('h1');
  const header = findProfileHeader(h1, main);
  let company = cleanCompany(structured.company || '');
  let currentTitle = clean(structured.jobTitle || '');
  if (!header) return {company, currentTitle};
  const employer = header.querySelector("button[aria-label*='Current company' i], a[aria-label*='Current company' i]");
  if (!company && employer) company = cleanCompany(clean(employer.getAttribute('aria-label')).replace(/^Current company\s*[:.]?\s*/i,'').replace(/\.\s*Click.*$/i,''));
  if (!company) {
    const link = header.querySelector("a[href*='/company/']");
    if (link) company = extractCompanyFromCompanyLink(link);
  }
  const headline = clean(header.querySelector(".text-body-medium.break-words, [data-generated-suggestion-target='urn:li:fsu_profileActionDelegate:headline'], [data-field='headline']")?.textContent);
  const pair = headline.match(/^(.{2,180}?)\s+(?:at|@)\s+(.{2,100})$/i);
  if (!currentTitle && pair && !/[|•]/.test(headline) && isPlausibleCompany(pair[2])) {
    const headlineCompany = cleanCompany(pair[2]);
    if (!company || company.toLowerCase() === headlineCompany.toLowerCase()) {company = headlineCompany;currentTitle = clean(pair[1]);}
  }
  if (!currentTitle && headline && !/[|•]/.test(headline) && !/\s(?:at|@)\s/i.test(headline) && isPlausibleCurrentTitle(headline)) currentTitle = headline;
  return {company:isPlausibleCompany(company)?company:'',currentTitle:isPlausibleCurrentTitle(currentTitle)?currentTitle:''};
}

function extractName(structured) {
  const heading = [...document.querySelectorAll("main h1, h1")]
    .map((node) => clean(node.textContent))
    .find((value) => isPlausibleName(value));
  if (heading) return heading;
  if (isPlausibleName(structured.name)) return clean(structured.name);
  const metadata = [
    document.querySelector("meta[property='og:title']")?.content,
    document.querySelector("meta[name='twitter:title']")?.content,
    document.title
  ];
  for (const value of metadata) {
    const withoutBrand = clean(value).replace(/\s*[|·]\s*LinkedIn.*$/i, "");
    const candidate = withoutBrand.split(/\s+-\s+/)[0].trim();
    if (isPlausibleName(candidate)) return candidate;
  }
  return "";
}

function isPlausibleName(value) {
  const cleanValue = clean(value);
  if (!cleanValue || cleanValue.length < 2 || cleanValue.length > 100) return false;
  if (/linkedin|profile|connections?|followers?|contact info|sign in|join now/i.test(cleanValue)) return false;
  return /\p{L}/u.test(cleanValue);
}

function extractLocation(main, name, structured = {}) {
  const candidates = [];
  for (const value of structured.locations || []) {
    candidates.push({ value, score: 160, source: "structured" });
  }
  const selectors = [
    "main .pv-text-details__left-panel span.text-body-small",
    "main .pv-top-card--list-bullet > li",
    "main [class*='top-card'] span.text-body-small",
    "main [class*='top-card'] [class*='location']",
    "main [data-field*='location']",
    "main [aria-label*='location' i]",
    "main .text-body-small.inline.t-black--light.break-words"
  ];

  selectors.forEach((selector, selectorIndex) => {
    document.querySelectorAll(selector).forEach((node, nodeIndex) => {
      if (!isVisible(node)) return;
      candidates.push({
        value: clean(node.textContent),
        score: 100 - selectorIndex * 6 - nodeIndex,
        source: "selector"
      });
    });
  });

  const h1 = findVisible(["main h1", "h1"]) || document.querySelector("main h1, h1");
  const topCard = findProfileHeader(h1, main);
  const headerLines = cleanLines(topCard?.innerText || "");
  headerLines.forEach((value, index) => {
    candidates.push({ value, score: 60 - index, source: "header" });
  });

  const metadata = [
    document.querySelector("meta[property='og:description']")?.content,
    document.querySelector("meta[name='description']")?.content
  ].filter(Boolean);
  metadata.flatMap(cleanLines).forEach((value, index) => {
    candidates.push({ value, score: 20 - index, source: "metadata" });
  });

  const mainLines = cleanLines(main.innerText || "");
  const nameIndex = mainLines.findIndex((line) => clean(line).toLowerCase() === clean(name).toLowerCase());
  const contactIndex = mainLines.findIndex((line, index) => index > nameIndex && /contact info/i.test(line));
  const headerWindow = nameIndex >= 0
    ? mainLines.slice(nameIndex, contactIndex > nameIndex ? contactIndex + 1 : nameIndex + 12)
    : mainLines.slice(0, 15);
  headerWindow.forEach((value, index) => {
    candidates.push({ value, score: 75 - index, source: "main-header" });
  });

  return chooseLocation(candidates, { name, headerLines: headerLines.length ? headerLines : headerWindow });
}

function extractStructuredProfile() {
  const result = { name: "", locations: [], company: "", jobTitle: "" };
  document.querySelectorAll("script[type='application/ld+json']").forEach((script) => {
    try {
      const parsed = JSON.parse(script.textContent || "null");
      walkJson(parsed, (node) => {
        if (!node || typeof node !== "object") return;
        const type = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
        const isPerson = type.some((value) => /person/i.test(String(value || "")));
        if (!result.name && isPerson && node.name) result.name = clean(node.name);
        if (isPerson && !result.jobTitle && typeof node.jobTitle === "string") result.jobTitle = clean(node.jobTitle);
        if (isPerson && !result.company && node.worksFor && !Array.isArray(node.worksFor)) result.company = clean(typeof node.worksFor === "string" ? node.worksFor : node.worksFor.name);
        const address = isPerson ? (node.address || node.homeLocation?.address || node.location?.address) : null;
        if (address) {
          const parts = typeof address === "string" ? [address] : [address.addressLocality, address.addressRegion, address.addressCountry?.name || address.addressCountry];
          const location = parts.map(clean).filter(Boolean).join(", ");
          if (location) result.locations.push(location);
        }
      });
    } catch (_error) {
      // Ignore malformed or unrelated structured data.
    }
  });
  return result;
}

function walkJson(value, visitor) {
  if (!value || typeof value !== "object") return;
  visitor(value);
  if (Array.isArray(value)) value.forEach((item) => walkJson(item, visitor));
  else Object.values(value).forEach((item) => walkJson(item, visitor));
}

function chooseLocation(candidates, context = {}) {
  const unique = new Map();
  for (const candidate of candidates) {
    const value = normalizeLocation(candidate.value);
    const headerLines = context.headerLines || [];
    const contactIndex = headerLines.findIndex((line) => /contact info/i.test(line));
    const valueIndex = headerLines.findIndex((line) => normalizeLocation(line).toLowerCase() === value.toLowerCase());
    const allowSimplePlace = candidate.source === "selector" || candidate.source === "structured" || (contactIndex > 0 && valueIndex === contactIndex - 1);
    if (!isPlausibleLocation(value, context, allowSimplePlace)) continue;
    const score = candidate.score + locationSignals(value, candidate.source, context.headerLines || []);
    const key = value.toLowerCase();
    if (!unique.has(key) || unique.get(key).score < score) unique.set(key, { value, score });
  }
  return [...unique.values()].sort((a, b) => b.score - a.score)[0]?.value || "";
}

function isPlausibleLocation(value, context, allowSimplePlace) {
  if (!value || value.length < 2 || value.length > 100) return false;
  if (value.toLowerCase() === clean(context.name).toLowerCase()) return false;
  if (/connections?|followers?|contact info|message|more actions|open to|provides? services?/i.test(value)) return false;
  if (/full-time|part-time|self-employed|present|\d+\s*(?:mos?|yrs?|years?|months?)/i.test(value)) return false;
  if (/\b(he\/him|she\/her|they\/them|1st|2nd|3rd)\b/i.test(value)) return false;
  if (/https?:|www\.|linkedin\.com|@/i.test(value)) return false;
  if (/\b(CEO|CTO|CFO|COO|Director|Manager|Partner|President|Engineer|Consultant|Recruiter|Founder|Leader|Sales|Marketing|Technology|Strategy)\b/i.test(value) && !locationShape(value, false)) return false;
  return locationShape(value, allowSimplePlace);
}

function locationSignals(value, source, headerLines) {
  let score = 0;
  if (source === "selector") score += 25;
  if (value.includes(",")) score += 20;
  if (/\b(greater|area|region|metropolitan|metro|district|province|state|county)\b/i.test(value)) score += 18;
  if (/\b(india|united states|united kingdom|canada|germany|france|netherlands|belgium|singapore|australia|uae|united arab emirates)\b/i.test(value)) score += 16;
  const contactIndex = headerLines.findIndex((line) => /contact info/i.test(line));
  const valueIndex = headerLines.findIndex((line) => normalizeLocation(line).toLowerCase() === value.toLowerCase());
  if (contactIndex > 0 && valueIndex === contactIndex - 1) score += 35;
  return score;
}

function locationShape(value, allowSimplePlace = false) {
  return /,/.test(value) ||
    /\b(greater|area|region|metropolitan|metro|district|province|state|county)\b/i.test(value) ||
    /\b(india|united states|united kingdom|canada|germany|france|netherlands|belgium|singapore|australia|uae|united arab emirates)\b/i.test(value) ||
    (allowSimplePlace && /^[\p{L}.' -]{2,40}$/u.test(value));
}

function normalizeLocation(value) {
  return clean(value)
    .replace(/\s*[·|]\s*Contact info.*$/i, "")
    .replace(/\s+Contact info$/i, "")
    .replace(/^Location\s*[:·-]?\s*/i, "")
    .trim();
}

function cleanLines(value) {
  return String(value || "").split(/\r?\n|\s{3,}/).map(clean).filter(Boolean);
}

function findProfileHeader(h1, main) {
  if (!h1) return null;
  const section = h1.closest("section");
  if (section) return section;
  let node = h1.parentElement;
  while (node && node !== main) {
    const lines = cleanLines(node.innerText || "");
    if (lines.length >= 4) return node;
    node = node.parentElement;
  }
  return h1.parentElement;
}

function findVisible(selectors) {
  for (const selector of selectors) {
    const match = [...document.querySelectorAll(selector)].find(isVisible);
    if (match) return match;
  }
  return null;
}

function isVisible(node) {
  if (!node) return false;
  const style = window.getComputedStyle(node);
  return style.display !== "none" && style.visibility !== "hidden" && node.getClientRects().length > 0;
}

async function extractCurrentCompany(main) {
  const experienceHeading = [...main.querySelectorAll("h2,span")]
    .find((node) => clean(node.textContent).toLowerCase() === "experience");
  const section = experienceHeading?.closest("section") || document.querySelector("section[id*='experience']");
  if (section) {
    const companyLink = section.querySelector("a[href*='/company/']");
    const company = cleanCompany(companyLink?.querySelector("span[aria-hidden='true']")?.textContent || companyLink?.textContent);
    if (isPlausibleCompany(company)) return company;

    const lines = String(section.innerText || "").split("\n").map(clean).filter(Boolean);
    const filtered = lines.filter((line) =>
      !/^(experience|full-time|part-time|contract|self-employed|internship|freelance|temporary|apprenticeship|seasonal)$/i.test(line) &&
      !/\b(19|20)\d{2}\b|present|\d+\s*(?:mos?|months?|yrs?|years?)/i.test(line)
    );
    if (filtered.length >= 2) {
      const fromLines = cleanCompany(filtered[1]);
      if (isPlausibleCompany(fromLines)) return fromLines;
    }
  }

  const topCompany = document.querySelector("main a[href*='/company/']");
  const company = cleanCompany(topCompany?.querySelector("span[aria-hidden='true']")?.textContent || topCompany?.textContent);
  return isPlausibleCompany(company) ? company : "";
}

function extractCurrentTitle(main, company = "") {
  const experienceHeading = [...main.querySelectorAll("h2,h3,span")]
    .find((node) => clean(node.textContent).toLowerCase() === "experience");
  const section = experienceHeading?.closest("section") || main.querySelector("section[id*='experience']");
  if (!section) return "";

  const itemSelector = "[data-view-name='profile-component-entity'], li.pvs-list__paged-list-item, li.artdeco-list__item";
  // LinkedIn's newer UI uses plain <p> elements with randomized class names;
  // older layouts use aria-hidden spans or time elements.
  const dateNodes = [...section.querySelectorAll("p, span[aria-hidden='true'], time")]
    .filter((node) => /\bpresent\b/i.test(clean(node.textContent)));

  // New LinkedIn markup uses sibling paragraphs inside grouped employers.
  // Read backwards from the exact Present paragraph before considering any
  // broader container, preventing text from later/past role cards leaking in.
  for (const dateNode of dateNodes) {
    const directTitle = extractTitleBeforeDateNode(dateNode, section, company);
    if (directTitle) return directTitle;
  }

  const currentItems = dateNodes
    .map((node) => node.closest(itemSelector) || findCurrentExperienceContainer(node, section))
    .filter((item, index, all) => item && all.indexOf(item) === index)
    .sort((a, b) => clean(a.textContent).length - clean(b.textContent).length);

  if (!currentItems.length) {
    currentItems.push(...[...section.querySelectorAll(itemSelector)]
      .filter((item) => /\bpresent\b/i.test(clean(item.textContent)))
      .sort((a, b) => clean(a.textContent).length - clean(b.textContent).length));
  }

  for (const item of currentItems) {
    const ariaLines = [...item.querySelectorAll("span[aria-hidden='true']")]
      .map((node) => clean(node.textContent))
      .filter(Boolean);
    const title = extractTitleFromExperienceLines(ariaLines.length ? ariaLines : cleanLines(item.innerText || item.textContent || ""), company);
    if (title) return title;
  }
  return "";
}

function extractTitleBeforeDateNode(dateNode, section, company = "") {
  const selector = dateNode?.tagName?.toLowerCase() === "p" ? "p" : "p, span[aria-hidden='true'], time";
  const nodes = [...section.querySelectorAll(selector)];
  const dateIndex = nodes.indexOf(dateNode);
  if (dateIndex < 0) return "";
  const nearbyLines = nodes
    .slice(Math.max(0, dateIndex - 6), dateIndex + 1)
    .map((node) => clean(node.textContent))
    .filter((value, index, all) => value && all.indexOf(value) === index);
  return extractTitleBeforePresentLine(nearbyLines, company);
}

function extractTitleBeforePresentLine(rawLines, company = "") {
  const lines = rawLines.map(clean).filter(Boolean);
  const companyKey = cleanCompany(company).toLowerCase();
  const presentIndex = lines.findIndex((line) => /\bpresent\b/i.test(line));
  if (presentIndex < 1) return "";
  for (let index = presentIndex - 1; index >= Math.max(0, presentIndex - 5); index -= 1) {
    const candidate = lines[index];
    const candidateKey = cleanCompany(candidate).toLowerCase();
    if (!isPlausibleCurrentTitle(candidate)) continue;
    if (companyKey && (candidateKey === companyKey || candidateKey.startsWith(`${companyKey} ·`))) continue;
    if (/\s[·|]\s*(full[- ]?time|part[- ]?time|self-employed|freelance|contract|internship|apprenticeship|temporary|seasonal)\b/i.test(candidate)) continue;
    if (/^(helped me get this job|linkedin helped me get this job|show all.*experience)$/i.test(candidate)) continue;
    return candidate;
  }
  return "";
}

function findCurrentExperienceContainer(dateNode, section) {
  let node = dateNode?.parentElement;
  let fallback = null;
  while (node && node !== section) {
    const text = clean(node.innerText || node.textContent || "");
    if (!/\bpresent\b/i.test(text)) break;
    const lines = [...node.querySelectorAll("p, span[aria-hidden='true'], time")]
      .map((entry) => clean(entry.textContent))
      .filter((value, index, all) => value && all.indexOf(value) === index && value.length <= 300);
    const usableLines = lines.length ? lines : cleanLines(node.innerText || node.textContent || "");
    const hasEmployer = usableLines.some((line) => /\s[·|]\s*(full[- ]?time|part[- ]?time|self-employed|freelance|contract|internship|apprenticeship|temporary|seasonal)\b/i.test(line));
    const hasTitleBeforeDate = usableLines.findIndex((line) => /\bpresent\b/i.test(line)) >= 2;
    if (hasEmployer && hasTitleBeforeDate) return node;
    if (!fallback && hasTitleBeforeDate && usableLines.length <= 8) fallback = node;
    node = node.parentElement;
  }
  return fallback;
}

function extractTitleFromExperienceLines(rawLines, company = "") {
  const companyKey = cleanCompany(company).toLowerCase();
  const lines = rawLines.map(clean).filter((value, index, all) => value && all.indexOf(value) === index);

  // Standard LinkedIn order: current title, employer · employment type, dates.
  // This rule must run before generic scanning so the employer cannot be
  // mistaken for the role and past entries are never consulted.
  for (let index = 1; index < lines.length; index += 1) {
    if (/\s[·|]\s*(full[- ]?time|part[- ]?time|self-employed|freelance|contract|internship|apprenticeship|temporary|seasonal)\b/i.test(lines[index])) {
      const title = lines[index - 1];
      if (isPlausibleCurrentTitle(title)) return title;
    }
  }

  const presentIndex = lines.findIndex((line) => /\bpresent\b/i.test(line));
  const currentLines = presentIndex >= 0 ? lines.slice(0, presentIndex) : lines;

  // Grouped-employer order: Employer, company tenure, role, role dates.
  // Select the nearest plausible role immediately before the Present date.
  if (presentIndex > 0) {
    for (let index = presentIndex - 1; index >= Math.max(0, presentIndex - 3); index -= 1) {
      const candidate = clean(lines[index]);
      const candidateKey = cleanCompany(candidate).toLowerCase();
      if (!isPlausibleCurrentTitle(candidate)) continue;
      if (companyKey && (candidateKey === companyKey || candidateKey.startsWith(`${companyKey} ·`))) continue;
      if (/\s[·|]\s*(full[- ]?time|part[- ]?time|self-employed|freelance|contract|internship|apprenticeship|temporary|seasonal)\b/i.test(candidate)) continue;
      return candidate;
    }
  }

  for (const line of currentLines) {
    const candidate = clean(line);
    const candidateKey = cleanCompany(candidate).toLowerCase();
    if (!isPlausibleCurrentTitle(candidate)) continue;
    if (companyKey && (candidateKey === companyKey || candidateKey.startsWith(`${companyKey} ·`))) continue;
    if (/\s[·|]\s*(full[- ]?time|part[- ]?time|self-employed|freelance|contract|internship|apprenticeship|temporary|seasonal)\b/i.test(candidate)) continue;
    return candidate;
  }
  return "";
}

function isPlausibleCurrentTitle(value) {
  const candidate = clean(value);
  if (!candidate || candidate.length < 2 || candidate.length > 180) return false;
  if (/^(experience|current title|title|position|role|show all.*experience)$/i.test(candidate)) return false;
  if (/^(full-time|part-time|contract|self-employed|internship|freelance|temporary|apprenticeship|seasonal)$/i.test(candidate)) return false;
  if (/\b(19|20)\d{2}\b|\bpresent\b|\bcurrent\b|\d+\s*(?:yrs?|years?|mos?|months?)\b/i.test(candidate)) return false;
  if (/^(hybrid|remote|on-site)$/i.test(candidate)) return false;
  if (/\b(greater|metropolitan|metro)\b.*\b(area|region)\b/i.test(candidate)) return false;
  if (/skills?:|associated with|show all|company logo|helped me get this job/i.test(candidate)) return false;
  return /\p{L}/u.test(candidate);
}

async function fetchExperienceDocument() {
  try {
    const profileMatch = window.location.pathname.match(/^\/in\/[^/]+/i);
    if (!profileMatch) return null;
    const url = new URL(`${profileMatch[0]}/details/experience/`, window.location.origin);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1800);
    const response = await fetch(url.toString(), { credentials: "include", cache: "no-store", signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return null;
    const html = await response.text();
    if (!html || html.length < 500) return null;
    return new DOMParser().parseFromString(html, "text/html");
  } catch (_error) {
    return null;
  }
}

function extractCurrentCompanyFromRoot(root) {
  const experienceHeading = [...root.querySelectorAll("h1,h2,h3,span")].find((node) => clean(node.textContent).toLowerCase() === "experience");
  const section = experienceHeading?.closest("section") || root.querySelector("section[id*='experience']") || root;
  if (section) {
    const currentItem = findCurrentExperienceItem(root) || section;
    const fromItem = extractCompanyFromExperienceItem(currentItem);
    if (fromItem) return fromItem;
  }
  const topCompanyLinks = [...root.querySelectorAll("a[href*='/company/']")];
  for (const link of topCompanyLinks) {
    const candidate = extractCompanyFromCompanyLink(link);
    if (candidate) return candidate;
  }
  return "";
}

function findCurrentExperienceItem(root) {
  const experienceHeading = [...root.querySelectorAll("h1,h2,h3,span,p")].find(node => clean(node.textContent).toLowerCase() === 'experience');
  const section = experienceHeading?.closest('section') || root.querySelector("section[id*='experience']") || root.querySelector('#experience')?.closest('section');
  if (!section) return null;
  const item = findExperienceItems(section).find(item => /\bpresent\b|\bcurrent\b/i.test(clean(item.textContent)));
  if (item) return item;
  // New LinkedIn layouts use paragraphs/divs rather than list items.
  for (const date of section.querySelectorAll("p, span[aria-hidden='true'], time")) {
    if (!/\bpresent\b|\bcurrent\b/i.test(clean(date.textContent))) continue;
    const container = findCurrentExperienceContainer(date, section);
    if (container) return container;
  }
  return null;
}

async function fetchCompanyNameFromItem(item) {
  if (!item) return "";
  const links = [...item.querySelectorAll("a[href*='/company/']")];
  for (const link of links) {
    const href = link.href || link.getAttribute("href") || "";
    const fromSlug = companyFromLinkedInHref(href);
    if (fromSlug) return fromSlug;
    try {
      const companyUrl = new URL(href, window.location.origin);
      const match = companyUrl.pathname.match(/\/company\/[^/]+/i);
      if (!match) continue;
      const canonicalUrl = new URL(`${match[0]}/`, window.location.origin);
      const response = await fetch(canonicalUrl.toString(), { credentials: "include", cache: "no-store" });
      if (!response.ok) continue;
      const html = await response.text();
      const companyDocument = new DOMParser().parseFromString(html, "text/html");
      const titles = [
        companyDocument.querySelector("meta[property='og:title']")?.content,
        companyDocument.querySelector("meta[name='twitter:title']")?.content,
        companyDocument.querySelector("h1")?.textContent,
        companyDocument.title
      ];
      for (const title of titles) {
        const company = companyFromPageTitle(title);
        if (company) return company;
      }
    } catch (_error) {
      // Try the next company link.
    }
  }
  return "";
}

function companyFromPageTitle(value) {
  const candidate = clean(value)
    .replace(/\s*[|·]\s*LinkedIn.*$/i, "")
    .replace(/\s*:\s*(Overview|About|Jobs|People|Life).*$/i, "")
    .trim();
  return isPlausibleCompany(candidate) ? candidate : "";
}

function findExperienceItems(section) {
  const preferred = [...section.querySelectorAll("li.pvs-list__paged-list-item, li.artdeco-list__item, [data-view-name='profile-component-entity']")];
  const items = preferred.length ? preferred : [...section.querySelectorAll("li")];
  return items.filter((item, index, all) => {
    if (!item.querySelector("a[href*='/company/'], img[alt*='logo' i]") && !/\bpresent\b/i.test(clean(item.textContent))) return false;
    return !all.some((other) => other !== item && other.contains(item));
  });
}

function extractCompanyFromExperienceItem(item) {
  const logoAlt = [...item.querySelectorAll("img[alt]")]
    .map((image) => clean(image.alt).replace(/\s+logo$/i, ""))
    .find((value) => value && !/profile photo|background|experience|company$/i.test(value) && isPlausibleCompany(value));
  if (logoAlt) return cleanCompany(logoAlt);

  for (const link of item.querySelectorAll("a[href*='/company/']")) {
    const company = extractCompanyFromCompanyLink(link);
    if (company) return company;
  }

  const ariaLines = [...item.querySelectorAll("span[aria-hidden='true']")].map((node) => clean(node.textContent)).filter(Boolean);
  const fromAria = extractCompanyFromExperienceLines(ariaLines);
  if (fromAria) return fromAria;
  return extractCompanyFromExperienceLines(cleanLines(item.innerText || item.textContent || ""));
}

function extractCompanyFromCompanyLink(link) {
  const logoAlt = clean(link.querySelector("img[alt]")?.alt).replace(/\s+logo$/i, "");
  if (isPlausibleCompany(logoAlt) && !/^company$/i.test(logoAlt)) return cleanCompany(logoAlt);

  const ariaLines = [...link.querySelectorAll("span[aria-hidden='true']")].map((node) => clean(node.textContent)).filter(Boolean);
  const plainName = cleanCompany(link.innerText || link.textContent);
  if (plainName && !/[\n\r]/.test(link.innerText || link.textContent || "") && isPlausibleCompany(plainName) && !/^(view|visit|open)\b/i.test(plainName)) return plainName;
  const fromLines = extractCompanyFromExperienceLines(ariaLines) || extractCompanyFromExperienceLines(cleanLines(link.innerText || link.textContent || ""));
  if (fromLines) return fromLines;

  for (const attribute of [link.getAttribute("aria-label"), link.getAttribute("title")]) {
    const candidate = cleanCompany(attribute);
    if (isPlausibleCompany(candidate) && !/view|visit|open|company page/i.test(candidate)) return candidate;
  }
  return companyFromLinkedInHref(link.href || link.getAttribute("href") || "");
}

function companyFromLinkedInHref(value) {
  try {
    const url = new URL(value, "https://www.linkedin.com");
    const slug = safeDecodeText(url.pathname.match(/\/company\/([^/]+)/i)?.[1] || "");
    if (!slug || /^\d+$/.test(slug)) return "";
    const candidate = slug.split(/[-_]+/).filter(Boolean).map((word) => word.length <= 3 ? word.toUpperCase() : word[0].toUpperCase() + word.slice(1)).join(" ");
    return isPlausibleCompany(candidate) ? candidate : "";
  } catch (_error) {
    return "";
  }
}

function safeDecodeText(value) {
  try { return decodeURIComponent(value); } catch (_error) { return value; }
}

function cleanCompany(value) {
  return clean(value)
    .replace(/\s+logo$/i, "")
    .replace(/\s*[·|]\s*(Full-time|Part-time|Contract|Self-employed|Internship|Freelance|Temporary|Apprenticeship|Seasonal).*$/i, "")
    .trim();
}

function extractCompanyFromExperienceLines(rawLines) {
  const lines = rawLines.map(clean).filter((value, index, all) => value && all.indexOf(value) === index);
  for (const line of lines) {
    const match = line.match(/^(.+?)\s*[·|]\s*(Full-time|Part-time|Contract|Self-employed|Internship|Freelance|Temporary|Apprenticeship|Seasonal)\b/i);
    if (match && isPlausibleCompany(match[1])) return cleanCompany(match[1]);
  }
  if (lines.length >= 2 && /^\d+\s*(yrs?|years?|mos?|months?)/i.test(lines[1]) && isPlausibleCompany(lines[0])) {
    return cleanCompany(lines[0]);
  }
  if (lines.length >= 3 && isDateOrTenure(lines[2]) && isPlausibleCompany(lines[1])) {
    return cleanCompany(lines[1]);
  }
  return "";
}

function isDateOrTenure(value) {
  return /\b(19|20)\d{2}\b|present|\d+\s*(yrs?|years?|mos?|months?)/i.test(value);
}

function isPlausibleCompany(value) {
  const candidate = cleanCompany(value);
  if (!candidate || candidate.length < 2 || candidate.length > 100) return false;
  if (/^(experience|company|company name)$/i.test(candidate) || isDateOrTenure(candidate)) return false;
  if (/^(full-time|part-time|contract|self-employed|internship|freelance|temporary|apprenticeship|seasonal)$/i.test(candidate)) return false;
  if (/\b(greater|metropolitan|metro|area|region|county|province)\b/i.test(candidate)) return false;
  if (/\b(united states|united kingdom|india|germany|france|netherlands|belgium|singapore|australia)\b/i.test(candidate) && /,/.test(candidate)) return false;
  if (/skills?:|associated with|show all/i.test(candidate)) return false;
  return true;
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function locationHref() {
  return window.location.href;
}

function canonicalUrl(value) {
  try {
    const url = new URL(value);
    const match = url.pathname.match(/^\/in\/[^/]+/i);
    return match ? `${url.origin}${match[0]}/` : value;
  } catch (_error) {
    return value;
  }
}
