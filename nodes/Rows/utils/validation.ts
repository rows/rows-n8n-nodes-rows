export const VISION_ALLOWED_FILE_TYPES = ['png', 'jpg', 'jpeg', 'webp', 'pdf'];
export const VISION_MAX_FILE_SIZE = 80 * 1024 * 1024; // 80MB in bytes
export const VISION_MAX_TOTAL_SIZE = 80 * 1024 * 1024; // 80MB in bytes
export const VISION_MAX_NR_OF_FILES = 50;

export function getFileExtension(filename: string): string {
        const parts = filename.split('.');
        return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

export function validateFileType(filename: string): boolean {
        const ext = getFileExtension(filename);
        return VISION_ALLOWED_FILE_TYPES.includes(ext);
}


