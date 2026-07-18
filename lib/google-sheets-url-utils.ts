/**
 * Utility functions for Google Sheets URL handling
 */

/**
 * Extract sheet ID from various Google Sheets URL formats
 * Supports:
 * - https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit
 * - https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit#gid=0
 * - https://docs.google.com/spreadsheets/d/{SHEET_ID}
 */
export function extractSheetId(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null
  }

  // Remove whitespace
  const cleanUrl = url.trim()

  // Pattern: /spreadsheets/d/{SHEET_ID}
  const match = cleanUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  
  if (match && match[1]) {
    return match[1]
  }

  return null
}

/**
 * Validate if a string looks like a Google Sheets URL
 */
export function isValidGoogleSheetsUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false
  }

  const cleanUrl = url.trim()
  return cleanUrl.includes('docs.google.com/spreadsheets') && extractSheetId(cleanUrl) !== null
}


