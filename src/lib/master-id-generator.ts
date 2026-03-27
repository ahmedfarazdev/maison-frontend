// ============================================================
// Maison Em — Master ID Generator
// Formula: ME-PER/{AURA_COLOR_CODE}-{BRAND_ABBREV}-{NAME_ABBREV}-{CONCENTRATION_CODE}
// Matches the exact Google Sheets ARRAYFORMULA logic
// ============================================================

import type { AuraColor, Concentration } from '@/types';

const AURA_COLOR_CODES: Record<AuraColor, string> = {
  Red: 'RED',
  Blue: 'BLU',
  Violet: 'VIO',
  Green: 'GRN',
  Yellow: 'YEL',
  Orange: 'ORG',
  Pink: 'PNK',
};

const CONCENTRATION_CODES: Record<Concentration, string> = {
  'Extrait de Parfum': 'EXT',
  'Eau de Parfum': 'EDP',
  'Parfum': 'PAR',
  'Eau de Toilette': 'EDT',
  'Cologne': 'COL',
};

/**
 * Generate brand abbreviation from brand name.
 * Rule: First 3 letters of first word + first 2 letters of second word (if exists)
 * e.g., "Amouage" → "AMO", "Tom Ford" → "TOMFO", "Maison Francis Kurkdjian" → "MAI"
 */
function generateBrandAbbrev(brand: string): string {
  const words = brand.trim().split(/\s+/);
  let abbrev = words[0].substring(0, 3);
  if (words.length > 1) {
    abbrev += words[1].substring(0, 2);
  }
  return abbrev.toUpperCase();
}

/**
 * Generate perfume name abbreviation from perfume name.
 * Rule: First 4 letters of first word + first 3 letters of second word (if exists)
 *       + first 2 letters of third word (if exists) + any numbers extracted
 * e.g., "Interlude 53" → "INTE53", "Oud for Greatness" → "OUDFORGRE"
 */
function generateNameAbbrev(name: string): string {
  // Extract numbers from the name
  const numbers = name.match(/\d+/g)?.join('') || '';
  
  // Remove numbers for word processing
  const cleanName = name.replace(/\d+/g, '').trim();
  const words = cleanName.split(/\s+/).filter(w => w.length > 0);
  
  let abbrev = '';
  if (words.length >= 1) {
    abbrev += words[0].substring(0, 4);
  }
  if (words.length >= 2) {
    abbrev += words[1].substring(0, 3);
  }
  if (words.length >= 3) {
    abbrev += words[2].substring(0, 2);
  }
  
  return (abbrev + numbers).toUpperCase();
}

/**
 * Generate the full Maison Em Master ID.
 * Format: ME-PER/{AURA_COLOR_CODE}-{BRAND_ABBREV}-{NAME_ABBREV}-{CONCENTRATION_CODE}
 */
export function generateMasterId(
  auraColor: AuraColor | '',
  brand: string,
  perfumeName: string,
  concentration: Concentration | ''
): string {
  if (!auraColor || !brand || !perfumeName || !concentration) {
    return 'ME-PER/___-___-___-___';
  }
  
  const colorCode = AURA_COLOR_CODES[auraColor] || 'UNK';
  const brandAbbrev = generateBrandAbbrev(brand);
  const nameAbbrev = generateNameAbbrev(perfumeName);
  const concCode = CONCENTRATION_CODES[concentration] || 'UNK';
  
  return `ME-PER/${colorCode}-${brandAbbrev}-${nameAbbrev}-${concCode}`;
}

/**
 * Parse a Master ID back into its components for display.
 */
export function parseMasterId(masterId: string): {
  prefix: string;
  colorCode: string;
  brandCode: string;
  nameCode: string;
  concCode: string;
} | null {
  const match = masterId.match(/^(ME-PER)\/([A-Z]{3})-([A-Z]{2,5})-([A-Z0-9]+)-([A-Z]{3})$/);
  if (!match) return null;
  return {
    prefix: match[1],
    colorCode: match[2],
    brandCode: match[3],
    nameCode: match[4],
    concCode: match[5],
  };
}

// ---- Constants aligned with mockFilterConfig (from Excel framework) ----
export const AURA_COLORS: AuraColor[] = ['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Pink', 'Violet'];
export const CONCENTRATIONS: Concentration[] = ['Extrait de Parfum', 'Eau de Parfum', 'Parfum', 'Eau de Toilette', 'Cologne'];
export const HYPE_LEVELS = ['Extreme', 'High', 'Medium', 'Low', 'Rare', 'Discontinued'] as const;
export const SCENT_TYPES = ['Fresh', 'Light', 'Powdery', 'Strong', 'Sweet', 'Warm'] as const;
export const GENDERS = ['masculine', 'feminine', 'unisex'] as const;
export const SEASONS = ['All Year Round', 'Fall', 'Spring', 'Summer', 'Winter'] as const;
export const OCCASIONS = ['Date Night', 'Everyday', 'Office', 'Party', 'Vacation', 'Workout'] as const;
export const PERSONALITIES = ['Classic', 'Elegant', 'Flirty', 'Mysterious', 'Sexy'] as const;
export const DECANT_SIZES = [1, 2, 3, 5, 8, 10, 20, 30] as const;
