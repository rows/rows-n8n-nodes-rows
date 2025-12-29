export const VISION_ALLOWED_FILE_TYPES = ['png', 'jpg', 'jpeg', 'webp', 'pdf', 'heic', 'csv', 'tsv', 'xls', 'xlsx'];
export const VISION_MAX_FILE_SIZE = 80 * 1024 * 1024; // 80MB in bytes
export const VISION_MAX_TOTAL_SIZE = 80 * 1024 * 1024; // 80MB in bytes
export const VISION_MAX_NR_OF_FILES = 50;

// File types that require 'create' mode
export const FILE_TYPES_REQUIRING_CREATE_MODE = ['csv', 'tsv', 'xls', 'xlsx'];

export function getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

export function validateFileType(filename: string): boolean {
    const ext = getFileExtension(filename);
    return VISION_ALLOWED_FILE_TYPES.includes(ext);
}

/**
 * Checks if a file type requires 'create' mode
 * @param filename - The filename to check
 * @returns true if the file type requires 'create' mode, false otherwise
 */
export function requiresCreateMode(filename: string): boolean {
    const ext = getFileExtension(filename);
    return FILE_TYPES_REQUIRING_CREATE_MODE.includes(ext);
}
