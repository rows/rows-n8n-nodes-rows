import {
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
    ILoadOptionsFunctions,
    INodePropertyOptions,
    NodeConnectionType,
    IHttpRequestOptions,
    NodeOperationError,
} from 'n8n-workflow';
import { appendDataToTable } from './operations/appendData';
import { overwriteDataInTable } from './operations/overwriteData';
import { importVisionData, importVisionDataFromAllItems } from './operations/importVisionData';

export class Rows implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Rows',
        name: 'rows',
        icon: 'file:rows.svg',
        group: ['transform'],
        version: 1,
        subtitle: '={{$parameter["operation"]}}',
        description: 'Integrate with the Rows AI spreadsheet',
        defaults: {
            name: 'Rows',
        },
        inputs: [NodeConnectionType.Main],
        outputs: [NodeConnectionType.Main],
        credentials: [
            {
                name: 'rowsApi',
                required: true,
            },
        ],
        properties: [
            {
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                noDataExpression: true,
                options: [
                    {
                        name: 'Append Data',
                        value: 'append',
                        description: 'Append data to a table',
                        action: 'Append data to a table',
                    },
                    {
                        name: 'Overwrite Data',
                        value: 'overwrite',
                        description: 'Overwrite data in a table',
                        action: 'Overwrite data in a table',
                    },
                    {
                        name: 'Import Vision Data',
                        value: 'importVision',
                        description: 'Extract data from image files using AI vision',
                        action: 'Import vision data',
                    },
                ],
                default: 'append',
            },
            {
                displayName: 'Spreadsheet Name or ID',
                name: 'spreadsheetId',
                type: 'options',
                typeOptions: {
                    loadOptionsMethod: 'getSpreadsheets',
                },
                displayOptions: {
                    show: {
                        operation: ['append', 'overwrite'],
                    },
                },
                default: '',
                required: true,
                description:
                    'The spreadsheet to operate on. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
            },
            {
                displayName: 'Table Name or ID',
                name: 'tableId',
                type: 'options',
                typeOptions: {
                    loadOptionsMethod: 'getTables',
                    loadOptionsDependsOn: ['spreadsheetId'],
                },
                displayOptions: {
                    show: {
                        operation: ['append', 'overwrite'],
                    },
                },
                default: '',
                required: true,
                description:
                    'The table to operate on. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
            },
            {
                displayName: 'Range',
                name: 'range',
                type: 'string',
                displayOptions: {
                    show: {
                        operation: ['append', 'overwrite'],
                    },
                },
                default: 'A1:B',
                required: true,
                description: 'The range of cells to operate on (e.g., A1:B1000)',
            },
            {
                displayName: 'Data',
                name: 'data',
                type: 'string',
                typeOptions: {
                    rows: 10,
                },
                displayOptions: {
                    show: {
                        operation: ['append', 'overwrite'],
                    },
                },
                default: '',
                required: true,
                description: 'The data to write (JSON array of arrays)',
                placeholder: '[["Name", "Email"], ["John Doe", "john@example.com"]]',
            },
            {
                displayName: 'Binary Property',
                name: 'binaryPropertyName',
                type: 'string',
                displayOptions: {
                    show: {
                        operation: ['importVision'],
                    },
                },
                default: 'data',
                required: true,
                description:
                    'Name of the binary property that contains the file(s) to upload. Default is "data" (used by "Read/Write files from disc" node). The files will be sent to the API as "files" parameter. Supported formats: png, jpg, jpeg, webp, pdf. Max size: 100MB per file, 100MB total.',
            },
            {
                displayName: 'Collect All Files From All Items',
                name: 'collectAllItems',
                type: 'boolean',
                displayOptions: {
                    show: {
                        operation: ['importVision'],
                    },
                },
                default: true,
                required: false,
                description:
                    'When enabled, collects files from all input items and sends them in a single API request. When disabled, processes each item separately.',
            },
            {
                displayName: 'Folder ID',
                name: 'folderId',
                type: 'options',
                typeOptions: {
                    loadOptionsMethod: 'getFolders',
                },
                displayOptions: {
                    show: {
                        operation: ['importVision'],
                    },
                },
                default: '',
                required: false,
                description:
                    'The folder to use. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
            },
            {
                displayName: 'Spreadsheet ID',
                name: 'appId',
                type: 'options',
                typeOptions: {
                    loadOptionsMethod: 'getSpreadsheets',
                    loadOptionsDependsOn: ['folderId'],
                },
                displayOptions: {
                    show: {
                        operation: ['importVision'],
                    },
                },
                default: '',
                required: false,
                description:
                    'The spreadsheet to use. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>. Sent to API as "app_id" parameter. Filtered by Folder ID if provided.',
            },
            {
                displayName: 'Table ID',
                name: 'tableId',
                type: 'options',
                typeOptions: {
                    loadOptionsMethod: 'getTables',
                    loadOptionsDependsOn: ['appId'],
                },
                displayOptions: {
                    show: {
                        operation: ['importVision'],
                    },
                },
                default: '',
                required: false,
                description:
                    'The table to use. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>. Required when Spreadsheet ID is provided.',
            },
            {
                displayName: 'Mode',
                name: 'mode',
                type: 'options',
                displayOptions: {
                    show: {
                        operation: ['importVision'],
                    },
                },
                options: [
                    {
                        name: 'Create',
                        value: 'create',
                        description: 'Create new data from the image',
                    },
                    {
                        name: 'Read',
                        value: 'read',
                        description: 'Read and extract data from the image',
                    },
                    {
                        name: 'Read Simplified',
                        value: 'read_simplified',
                        description: 'Read and extract simplified data from the image',
                    },
                ],
                default: 'create',
                required: false,
                description: 'Processing mode that affects the response format',
            },
            {
                displayName: 'Merge',
                name: 'merge',
                type: 'boolean',
                displayOptions: {
                    show: {
                        operation: ['importVision'],
                    },
                },
                default: false,
                required: false,
                description: 'Whether to merge with existing data',
            },
            {
                displayName: 'Instructions',
                name: 'instructions',
                type: 'string',
                typeOptions: {
                    rows: 4,
                },
                displayOptions: {
                    show: {
                        operation: ['importVision'],
                    },
                },
                default: '',
                required: false,
                description:
                    'Custom instructions for data extraction (e.g., "Extract all data from this image")',
            },
        ],
    };

    methods = {
        loadOptions: {
            async getFolders(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
                const credentials = await this.getCredentials('rowsApi');

                const options: IHttpRequestOptions = {
                    method: 'GET',
                    url: 'https://api.rows.com/v1/folders',
                    headers: {
                        Authorization: `Bearer ${credentials.apiKey}`,
                    },
                    json: true,
                };

                try {
                    const response = await this.helpers.httpRequest(options);
                    const folders: INodePropertyOptions[] = [];

                    // Add empty option to allow clearing the selection
                    folders.push({
                        name: '-- None --',
                        value: '',
                    });

                    if (response.items && Array.isArray(response.items)) {
                        for (const folder of response.items) {
                            folders.push({
                                name: folder.name,
                                value: folder.id,
                            });
                        }
                    }

                    return folders;
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Unknown error';
                    throw new NodeOperationError(
                        this.getNode(),
                        `Failed to load folders: ${message}`,
                    );
                }
            },

            async getSpreadsheets(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
                const credentials = await this.getCredentials('rowsApi');

                // Check if folderId is set (used by vision import operation)
                const folderId = (this.getNodeParameter('folderId', 0) as string) || '';

                // Build URL with optional folder_id query parameter
                let url = 'https://api.rows.com/v1/spreadsheets';
                if (folderId) {
                    url += `?folder_id=${encodeURIComponent(folderId)}`;
                }

                const options: IHttpRequestOptions = {
                    method: 'GET',
                    url: url,
                    headers: {
                        Authorization: `Bearer ${credentials.apiKey}`,
                    },
                    json: true,
                };

                try {
                    const response = await this.helpers.httpRequest(options);
                    const spreadsheets: INodePropertyOptions[] = [];

                    // Add empty option to allow clearing the selection
                    spreadsheets.push({
                        name: '-- None --',
                        value: '',
                    });

                    if (response.items && Array.isArray(response.items)) {
                        for (const spreadsheet of response.items) {
                            spreadsheets.push({
                                name: spreadsheet.name,
                                value: spreadsheet.id,
                            });
                        }
                    }

                    return spreadsheets;
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Unknown error';
                    throw new NodeOperationError(
                        this.getNode(),
                        `Failed to load spreadsheets: ${message}`,
                    );
                }
            },

            async getTables(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
                // Check for spreadsheetId (used by append/overwrite) or appId (used by vision import)
                const spreadsheetId =
                    (this.getNodeParameter('spreadsheetId', 0) as string) ||
                    (this.getNodeParameter('appId', 0) as string);

                const tables: INodePropertyOptions[] = [];

                // Always add empty option to allow clearing the selection
                tables.push({
                    name: '-- None --',
                    value: '',
                });

                if (!spreadsheetId) {
                    return tables;
                }

                const credentials = await this.getCredentials('rowsApi');

                const options: IHttpRequestOptions = {
                    method: 'GET',
                    url: `https://api.rows.com/v1/spreadsheets/${spreadsheetId}`,
                    headers: {
                        Authorization: `Bearer ${credentials.apiKey}`,
                    },
                    json: true,
                };

                try {
                    const response = await this.helpers.httpRequest(options);

                    if (response.pages && Array.isArray(response.pages)) {
                        for (const page of response.pages) {
                            if (page.tables && Array.isArray(page.tables)) {
                                for (const table of page.tables) {
                                    tables.push({
                                        name: `${page.name} / ${table.name}` || table.id,
                                        value: table.id,
                                    });
                                }
                            }
                        }
                    }

                    return tables;
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Unknown error';
                    throw new NodeOperationError(
                        this.getNode(),
                        `Failed to load tables: ${message}`,
                    );
                }
            },
        },
    };

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const items = this.getInputData();
        const returnData: INodeExecutionData[] = [];
        const operation = this.getNodeParameter('operation', 0) as string;

        // Special use case for importVision with collectAllItems toggle enabled
        // useful in conjunction with `merge` node
        if (operation === 'importVision') {
            const collectAllItems = this.getNodeParameter('collectAllItems', 0, false) as boolean;

            if (collectAllItems && items.length > 0) {
                // Collect all files from all items and send in one request
                try {
                    const result = await importVisionDataFromAllItems(this);
                    // Create a single output item that represents all input items
                    returnData.push({
                        json: result,
                        pairedItem: { item: 0 }, // Reference first item as representative
                    });
                    return [returnData];
                } catch (error) {
                    if (this.continueOnFail()) {
                        const message = error instanceof Error ? error.message : 'Unknown error';
                        returnData.push({
                            json: { error: message },
                            pairedItem: { item: 0 },
                        });
                        return [returnData];
                    }
                    throw error;
                }
            }
        }

        // Process each item separately (default behavior)
        for (let i = 0; i < items.length; i++) {
            try {
                if (operation === 'append') {
                    const result = await appendDataToTable(this, i);
                    returnData.push({
                        json: result,
                        pairedItem: { item: i },
                    });
                } else if (operation === 'overwrite') {
                    const result = await overwriteDataInTable(this, i);
                    returnData.push({
                        json: result,
                        pairedItem: { item: i },
                    });
                } else if (operation === 'importVision') {
                    // Only process individually if collectAllItems is false
                    const collectAllItems = this.getNodeParameter(
                        'collectAllItems',
                        i,
                        false,
                    ) as boolean;
                    if (!collectAllItems) {
                        const result = await importVisionData(this, i);
                        returnData.push({
                            json: result,
                            pairedItem: { item: i },
                        });
                    }
                }
            } catch (error) {
                if (this.continueOnFail()) {
                    const message = error instanceof Error ? error.message : 'Unknown error';
                    returnData.push({
                        json: { error: message },
                        pairedItem: { item: i },
                    });
                    continue;
                }
                throw error;
            }
        }

        return [returnData];
    }
}
