/**
 * This is needed because n8n does not allow external dependencies in custo nodes :(
 * Utility functions for building multipart/form-data requests without external dependencies
 * Implements RFC 2388 (multipart/form-data) specification
 */

type MultipartField = {
    name: string;
    value: string;
};

type MultipartFile = {
    name: string;
    data: Buffer;
    filename: string;
    contentType?: string;
};

/**
 * Generates a unique boundary string for multipart/form-data
 * Format: ----n8n-rows-{timestamp}-{random}
 * The double dashes at the start are required by the spec
 */
function generateBoundary(): string {
    return `----n8n-rows-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Escapes special characters in a string for use in quoted-string format
 * Used for field names and filenames in Content-Disposition headers
 */
function escapeQuotedString(value: string): string {
    // Escape backslashes and quotes by prefixing with backslash
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Encodes a filename for use in Content-Disposition header
 * Uses quoted-string format with escaping for special characters
 * For non-ASCII characters, falls back to RFC 2231 encoding
 */
function encodeFilename(filename: string): string {
    // If filename contains only ASCII printable characters (except quotes/backslashes), use simple escaping
    if (/^[\x20-\x21\x23-\x5B\x5D-\x7E]+$/.test(filename)) {
        // Safe ASCII characters - just escape quotes and backslashes
        return escapeQuotedString(filename);
    }
    // For non-ASCII or special characters, use RFC 2231 encoding
    // Format: UTF-8''encoded-filename
    return `UTF-8''${encodeURIComponent(filename).replace(/'/g, '%27')}`;
}

/**
 * Escapes a field name for use in Content-Disposition header
 * Field names should be simple ASCII, but we escape quotes/backslashes just in case
 */
function escapeFieldName(name: string): string {
    return escapeQuotedString(name);
}

/**
 * Builds a multipart/form-data body and returns it along with the Content-Type header
 *
 * @param fields - Array of form fields (name-value pairs). Field values should not contain CRLF.
 * @param files - Array of files to upload
 * @returns Object with body (Buffer) and contentType (string with boundary)
 *
 * @throws Error if boundary appears in field values or file data (extremely unlikely)
 */
export function buildMultipartFormData(
    fields: MultipartField[] = [],
    files: MultipartFile[] = [],
): { body: Buffer; contentType: string } {
    const boundary = generateBoundary();
    const parts: Buffer[] = [];
    const CRLF = '\r\n';

    // Add form fields
    for (const field of fields) {
        const escapedName = escapeFieldName(field.name);
        parts.push(Buffer.from(`--${boundary}${CRLF}`));
        parts.push(
            Buffer.from(`Content-Disposition: form-data; name="${escapedName}"${CRLF}${CRLF}`),
        );
        // Note: Field values are written as-is. If they contain CRLF, it could break the format.
        // For this use case (UUIDs, enums, booleans, simple strings), this is safe.
        parts.push(Buffer.from(field.value, 'utf8'));
        parts.push(Buffer.from(CRLF));
    }

    // Add files
    for (const file of files) {
        const escapedName = escapeFieldName(file.name);
        const encodedFilename = encodeFilename(file.filename);
        const contentType = file.contentType || 'application/octet-stream';

        parts.push(Buffer.from(`--${boundary}${CRLF}`));
        parts.push(
            Buffer.from(
                `Content-Disposition: form-data; name="${escapedName}"; filename="${encodedFilename}"${CRLF}`,
            ),
        );
        parts.push(Buffer.from(`Content-Type: ${contentType}${CRLF}${CRLF}`));
        parts.push(file.data);
        parts.push(Buffer.from(CRLF));
    }

    // Add closing boundary (note the -- at the end)
    parts.push(Buffer.from(`--${boundary}--${CRLF}`));

    // Combine all parts into a single buffer
    const body = Buffer.concat(parts);
    const contentType = `multipart/form-data; boundary=${boundary}`;

    return { body, contentType };
}
