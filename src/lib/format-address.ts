/**
 * Auto-correct address field capitalization and formatting.
 * Designed to run onBlur so the user sees corrections after leaving a field.
 */

// Words that should stay lowercase in title case (unless first word)
const LOWERCASE_WORDS = new Set(["of", "the", "and", "in", "at", "to", "for", "on", "by"]);

// US state abbreviations (2-letter) — always uppercase
const STATE_ABBREVIATIONS = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC","PR","VI","GU","AS","MP",
]);

// Common directional abbreviations
const DIRECTIONALS: Record<string, string> = {
  "n": "N", "n.": "N", "north": "N",
  "s": "S", "s.": "S", "south": "S",
  "e": "E", "e.": "E", "east": "E",
  "w": "W", "w.": "W", "west": "W",
  "ne": "NE", "nw": "NW", "se": "SE", "sw": "SW",
};

// Common street suffix abbreviations
const STREET_SUFFIXES: Record<string, string> = {
  "st": "St", "st.": "St", "street": "St",
  "ave": "Ave", "ave.": "Ave", "avenue": "Ave",
  "blvd": "Blvd", "blvd.": "Blvd", "boulevard": "Blvd",
  "dr": "Dr", "dr.": "Dr", "drive": "Dr",
  "ln": "Ln", "ln.": "Ln", "lane": "Ln",
  "rd": "Rd", "rd.": "Rd", "road": "Rd",
  "ct": "Ct", "ct.": "Ct", "court": "Ct",
  "pl": "Pl", "pl.": "Pl", "place": "Pl",
  "cir": "Cir", "cir.": "Cir", "circle": "Cir",
  "way": "Way",
  "pkwy": "Pkwy", "parkway": "Pkwy",
  "ter": "Ter", "terrace": "Ter",
  "trl": "Trl", "trail": "Trl",
  "hwy": "Hwy", "highway": "Hwy",
};

// Unit designators that should stay uppercase
const UNIT_DESIGNATORS: Record<string, string> = {
  "apt": "Apt", "apt.": "Apt",
  "suite": "Suite", "ste": "Suite", "ste.": "Suite",
  "unit": "Unit",
  "fl": "Fl", "floor": "Fl",
  "rm": "Rm", "room": "Rm",
  "bldg": "Bldg", "building": "Bldg",
};

function titleCaseWord(word: string, index: number): string {
  const lower = word.toLowerCase();
  if (index > 0 && LOWERCASE_WORDS.has(lower)) return lower;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/** Format a street address line (e.g., "123 main st" → "123 Main St") */
export function formatStreetAddress(value: string): string {
  if (!value.trim()) return value;

  const words = value.trim().replace(/\s+/g, " ").split(" ");
  const result: string[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const lower = word.toLowerCase().replace(/\.$/, "") + (word.endsWith(".") ? "." : "");
    const lowerNoDot = word.toLowerCase().replace(/\.$/, "");

    // Check directionals
    if (DIRECTIONALS[lowerNoDot]) {
      result.push(DIRECTIONALS[lowerNoDot]);
      continue;
    }

    // Check street suffixes
    if (STREET_SUFFIXES[lowerNoDot]) {
      result.push(STREET_SUFFIXES[lowerNoDot]);
      continue;
    }

    // Check unit designators
    if (UNIT_DESIGNATORS[lowerNoDot]) {
      result.push(UNIT_DESIGNATORS[lowerNoDot]);
      continue;
    }

    // Numbers stay as-is
    if (/^\d/.test(word)) {
      result.push(word);
      continue;
    }

    // Default: title case
    result.push(titleCaseWord(word, i));
  }

  return result.join(" ");
}

/** Format a city name (e.g., "new york" → "New York") */
export function formatCity(value: string): string {
  if (!value.trim()) return value;
  return value.trim().replace(/\s+/g, " ").split(" ")
    .map((w, i) => titleCaseWord(w, i))
    .join(" ");
}

/** Format state to uppercase abbreviation (e.g., "ny" → "NY", "new york" → "NY") */
export function formatState(value: string): string {
  if (!value.trim()) return value;
  const upper = value.trim().toUpperCase();
  if (STATE_ABBREVIATIONS.has(upper)) return upper;
  // Already formatted or full state name — just uppercase it
  return upper;
}

/** Format a person/company name (e.g., "john doe" → "John Doe") */
export function formatName(value: string): string {
  if (!value.trim()) return value;
  return value.trim().replace(/\s+/g, " ").split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Format zip code — trim whitespace, keep as-is (handles 5-digit and ZIP+4) */
export function formatZip(value: string): string {
  return value.trim();
}
