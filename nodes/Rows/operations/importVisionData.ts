import { IBinaryData, IExecuteFunctions, IHttpRequestOptions, NodeOperationError, } from 'n8n-workflow';
import FormData from 'form-data';
import {
    getFileExtension,
    validateFileType,
    VISION_ALLOWED_FILE_TYPES,
    VISION_MAX_FILE_SIZE,
    VISION_MAX_NR_OF_FILES,
    VISION_MAX_TOTAL_SIZE,
} from '../utils/validation';

type BinaryFile = {
    data: Buffer;
    filename: string;
    mimeType?: string;
};

/**
 * Helper function to send vision import API request with collected files and parameters
 */
async function sendVisionImportRequest(
    context: IExecuteFunctions,
    itemIndex: number,
    allBinaryFiles: BinaryFile[],
): Promise<any> {
    // Get optional parameters
    const folderId = context.getNodeParameter('folderId', itemIndex, '') as string;
    const appId = context.getNodeParameter('appId', itemIndex, '') as string;
    const tableId = context.getNodeParameter('tableId', itemIndex, '') as string;

    // Validate: if tableId is provided, appId is required
    if (tableId && !appId) {
        throw new NodeOperationError(
            context.getNode(),
            'Spreadsheet ID is required when Table ID is provided.',
        );
    }

    const mode = context.getNodeParameter('mode', itemIndex, 'create') as string;
    const merge = context.getNodeParameter('merge', itemIndex, false) as boolean;
    const instructions = context.getNodeParameter('instructions', itemIndex, '') as string;

    // Build multipart form data
    const formData = new FormData();

    // Add all files
    for (const file of allBinaryFiles) {
        formData.append('files', file.data, {
            filename: file.filename,
            contentType: file.mimeType || 'application/octet-stream',
        });
    }

    // Add optional parameters only if provided
    if (folderId) {
        formData.append('folder_id', folderId);
    }
    if (appId) {
        formData.append('app_id', appId);
    }
    if (tableId) {
        formData.append('table_id', tableId);
    }
    if (mode) {
        formData.append('mode', mode);
    }
    formData.append('merge', merge.toString());
    if (instructions) {
        formData.append('instructions', instructions);
    }

    // Make authenticated request
    const options: IHttpRequestOptions = {
        method: 'POST',
        url: 'https://api.rows.com/v1/vision/import',
        body: formData,
        headers: formData.getHeaders(),
    };

    return await context.helpers.httpRequestWithAuthentication.call(context, 'rowsApi', options);
}

/**
 * Import vision data from a single item (one file per API request).
 * Used when "Collect All Files From All Items" is disabled.
 * Processes each item separately, making one API call per item.
 *
 * @param context - The execution context from n8n
 * @param itemIndex - The index of the current item being processed
 * @returns The API response from the vision import endpoint
 */
export async function importVisionData(context: IExecuteFunctions, itemIndex: number) {
    const item = context.getInputData()[itemIndex];

    // Get binary data - check common binary property names
    const binaryPropertyName = context.getNodeParameter('binaryPropertyName', itemIndex, 'data');

    if (!item.binary || !item.binary[binaryPropertyName]) {
        throw new NodeOperationError(
            context.getNode(),
            `No binary data found for property "${binaryPropertyName}". Please ensure the previous node outputs binary data.`,
        );
    }

    const binaryData: IBinaryData = item.binary[binaryPropertyName];

    // Validate file type
    const fileName = binaryData.fileName || 'file';
    if (!validateFileType(fileName)) {
        const ext = getFileExtension(fileName);
        throw new NodeOperationError(
            context.getNode(),
            `File type "${ext}" is not supported. Allowed types: ${VISION_ALLOWED_FILE_TYPES.join(', ')}`,
        );
    }

    // Get file data
    const fileData = await context.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);

    // Validate file size
    if (fileData.length > VISION_MAX_FILE_SIZE) {
        throw new NodeOperationError(
            context.getNode(),
            `File size (${(fileData.length / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size of ${VISION_MAX_FILE_SIZE}MB`,
        );
    }

    // Collect all binary files if multiple exist
    const allBinaryFiles: Array<{ data: Buffer; filename: string; mimeType?: string }> = [];
    let totalSize = fileData.length;

    allBinaryFiles.push({
        data: fileData,
        filename: binaryData.fileName || 'file',
        mimeType: binaryData.mimeType,
    });

    // Check for additional binary properties (in case user has multiple files in the same item)
    if (item.binary) {
        for (const [key, value] of Object.entries(item.binary)) {
            if (key !== binaryPropertyName && value) {
                try {
                    const additionalData = await context.helpers.getBinaryDataBuffer(
                        itemIndex,
                        key,
                    );
                    totalSize += additionalData.length;

                    if (additionalData.length > VISION_MAX_FILE_SIZE) {
                        throw new NodeOperationError(
                            context.getNode(),
                            `File "${value.fileName || key}" size exceeds maximum allowed size of ${VISION_MAX_FILE_SIZE}MB`,
                        );
                    }

                    const additionalFileName = value.fileName || key;
                    if (!validateFileType(additionalFileName)) {
                        const ext = getFileExtension(additionalFileName);
                        throw new NodeOperationError(
                            context.getNode(),
                            `File "${additionalFileName}" has unsupported type "${ext}". Allowed types: ${VISION_ALLOWED_FILE_TYPES.join(', ')}`,
                        );
                    }

                    allBinaryFiles.push({
                        data: additionalData,
                        filename: additionalFileName,
                        mimeType: value.mimeType,
                    });
                } catch (error) {
                    // Skip binary properties that can't be read
                    if (error instanceof NodeOperationError) {
                        throw error;
                    }
                    // Continue if it's just a missing property
                }
            }
        }
    }

    // Validate total size
    if (totalSize > VISION_MAX_TOTAL_SIZE) {
        throw new NodeOperationError(
            context.getNode(),
            `Total size of all files (${(totalSize / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size of 100MB`,
        );
    }

    // Send API request with collected files and parameters
    return await sendVisionImportRequest(context, itemIndex, allBinaryFiles);
}

/**
 * Import vision data from all items (multiple files in one API request).
 * Used when "Collect All Files From All Items" is enabled.
 * Collects files from all input items and sends them in a single API request.
 *
 * @param context - The execution context from n8n
 * @returns The API response from the vision import endpoint
 */
export async function importVisionDataFromAllItems(context: IExecuteFunctions): Promise<any> {
    const items = context.getInputData();
    const binaryPropertyName = context.getNodeParameter('binaryPropertyName', 0, 'data');

    if (items.length === 0) {
        throw new NodeOperationError(
            context.getNode(),
            'No input items found. Please ensure at least one item with binary data is connected.',
        );
    }

    const allBinaryFiles: Array<{ data: Buffer; filename: string; mimeType?: string }> = [];
    let totalSize = 0;

    // Collect files from all items
    for (let i = 0; i < items.length; i++) {
        const item = items[i];

        if (!item.binary || !item.binary[binaryPropertyName]) {
            continue; // Skip items without the specified binary property
        }

        const binaryData: IBinaryData = item.binary[binaryPropertyName];

        // Validate file type
        const fileName = binaryData.fileName || 'file';
        if (!validateFileType(fileName)) {
            const ext = getFileExtension(fileName);
            throw new NodeOperationError(
                context.getNode(),
                `File "${fileName}" has unsupported type "${ext}". Allowed types: ${VISION_ALLOWED_FILE_TYPES.join(', ')}`,
            );
        }

        // Get file data
        const fileData = await context.helpers.getBinaryDataBuffer(i, binaryPropertyName);

        // Validate file size
        if (fileData.length > VISION_MAX_FILE_SIZE) {
            throw new NodeOperationError(
                context.getNode(),
                `File "${fileName}" size (${(fileData.length / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size of ${VISION_MAX_FILE_SIZE}MB`,
            );
        }

        totalSize += fileData.length;

        allBinaryFiles.push({
            data: fileData,
            filename: fileName,
            mimeType: binaryData.mimeType,
        });

        // Also check for additional binary properties in the same item
        if (item.binary) {
            for (const [key, value] of Object.entries(item.binary)) {
                if (key !== binaryPropertyName && value) {
                    try {
                        const additionalData = await context.helpers.getBinaryDataBuffer(i, key);
                        totalSize += additionalData.length;

                        if (additionalData.length > VISION_MAX_FILE_SIZE) {
                            throw new NodeOperationError(
                                context.getNode(),
                                `File "${value.fileName || key}" size exceeds maximum allowed size of ${VISION_MAX_FILE_SIZE}MB`,
                            );
                        }

                        const additionalFileName = value.fileName || key;
                        if (!validateFileType(additionalFileName)) {
                            const ext = getFileExtension(additionalFileName);
                            throw new NodeOperationError(
                                context.getNode(),
                                `File "${additionalFileName}" has unsupported type "${ext}". Allowed types: ${VISION_ALLOWED_FILE_TYPES.join(', ')}`,
                            );
                        }

                        allBinaryFiles.push({
                            data: additionalData,
                            filename: additionalFileName,
                            mimeType: value.mimeType,
                        });
                    } catch (error) {
                        if (error instanceof NodeOperationError) {
                            throw error;
                        }
                    }
                }
            }
        }
    }

    if (allBinaryFiles.length === 0) {
        throw new NodeOperationError(
            context.getNode(),
            `No binary data found for property "${binaryPropertyName}" in any input items. Please ensure at least one item contains binary data.`,
        );
    }

    // Validate maximum number of files
    if (allBinaryFiles.length > VISION_MAX_NR_OF_FILES) {
        throw new NodeOperationError(
            context.getNode(),
            `Too many files (${allBinaryFiles.length}). Maximum allowed is ${VISION_MAX_NR_OF_FILES} files per request.`,
        );
    }

    // Validate total size
    if (totalSize > VISION_MAX_TOTAL_SIZE) {
        throw new NodeOperationError(
            context.getNode(),
            `Total size of all files (${(totalSize / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size of ${VISION_MAX_TOTAL_SIZE}MB`,
        );
    }

    // Send API request with collected files and parameters (using first item index for parameters)
    return await sendVisionImportRequest(context, 0, allBinaryFiles);
}
