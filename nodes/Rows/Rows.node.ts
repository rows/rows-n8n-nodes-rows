import {
        IExecuteFunctions,
        INodeExecutionData,
        INodeType,
        INodeTypeDescription,
        NodeOperationError,
        IHttpRequestOptions,
        ILoadOptionsFunctions,
        INodePropertyOptions,
        NodeConnectionType,
} from 'n8n-workflow';

// Buffer is available in Node.js runtime
declare const Buffer: {
        from(data: string, encoding?: string): any;
};

async function appendDataToTable(context: IExecuteFunctions, itemIndex: number) {
        const spreadsheetId = context.getNodeParameter('spreadsheetId', itemIndex) as string;
        const tableId = context.getNodeParameter('tableId', itemIndex) as string;
        const range = context.getNodeParameter('range', itemIndex) as string;
        const dataString = context.getNodeParameter('data', itemIndex) as string;

        let data;
        try {
                data = JSON.parse(dataString);
        } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                throw new NodeOperationError(context.getNode(), `Invalid JSON data: ${message}`);
        }

        if (!Array.isArray(data) || !data.every(row => Array.isArray(row))) {
                throw new NodeOperationError(context.getNode(), 'Data must be an array of arrays');
        }

        const values = data.map(row => row.map(value => String(value)));

        const options: IHttpRequestOptions = {
                method: 'POST',
                url: `https://api.rows.com/v1/spreadsheets/${spreadsheetId}/tables/${tableId}/values/${range}:append`,
                json: true,
                body: {
                        values,
                },
        };

        const response = await context.helpers.httpRequestWithAuthentication.call(context, 'rowsApi', options);
        return response;
}

async function overwriteDataInTable(context: IExecuteFunctions, itemIndex: number) {
        const spreadsheetId = context.getNodeParameter('spreadsheetId', itemIndex) as string;
        const tableId = context.getNodeParameter('tableId', itemIndex) as string;
        const range = context.getNodeParameter('range', itemIndex) as string;
        const dataString = context.getNodeParameter('data', itemIndex) as string;

        let data;
        try {
                data = JSON.parse(dataString);
        } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                throw new NodeOperationError(context.getNode(), `Invalid JSON data: ${message}`);
        }

        if (!Array.isArray(data) || !data.every(row => Array.isArray(row))) {
                throw new NodeOperationError(context.getNode(), 'Data must be an array of arrays');
        }

        const cells = data.map(row => row.map(value => ({ value: String(value) })));

        const options: IHttpRequestOptions = {
                method: 'POST',
                url: `https://api.rows.com/v1/spreadsheets/${spreadsheetId}/tables/${tableId}/cells/${range}`,
                json: true,
                body: {
                        cells,
                },
        };

        const response = await context.helpers.httpRequestWithAuthentication.call(context, 'rowsApi', options);
        return response;
}

async function importDataFromVisionAI(context: IExecuteFunctions, itemIndex: number) {
        const mode = context.getNodeParameter('visionMode', itemIndex) as string;
        const binaryPropertyNames = context.getNodeParameter('binaryPropertyNames', itemIndex) as string | string[] | Array<{ name?: string; value?: string }>;
        const folderId = context.getNodeParameter('folderId', itemIndex, '') as string;
        const appId = context.getNodeParameter('appId', itemIndex, '') as string;
        const tableId = context.getNodeParameter('tableId', itemIndex, '') as string;
        const instructions = context.getNodeParameter('instructions', itemIndex, '') as string;
        const merge = context.getNodeParameter('merge', itemIndex, false) as boolean;
      
        // Normalize to array and extract string values
        let propertyNames: string[] = [];
        if (Array.isArray(binaryPropertyNames)) {
                // Handle array - could be strings or objects
                propertyNames = binaryPropertyNames.map(item => {
                        if (typeof item === 'string') {
                                return item;
                        } else if (item && typeof item === 'object') {
                                // Handle various object structures that n8n might return
                                // Try common property names that n8n uses
                                const obj = item as any;
                                return obj.name || obj.value || obj.propertyName || obj.key || 
                                       (obj.fileName ? 'data' : undefined) || // fallback if it's binary data itself
                                       JSON.stringify(item); // last resort
                        }
                        return String(item);
                }).filter((name): name is string => {
                        // Filter out any invalid values and ensure we have strings
                        return typeof name === 'string' && name.length > 0 && name !== 'undefined';
                });
        } else if (binaryPropertyNames && typeof binaryPropertyNames === 'object') {
                // Single object case
                const obj = binaryPropertyNames as any;
                const name = obj.name || obj.value || obj.propertyName || obj.key || 'data';
                if (typeof name === 'string' && name.length > 0) {
                        propertyNames = [name];
                } else {
                        propertyNames = ['data']; // default fallback
                }
        } else {
                propertyNames = [String(binaryPropertyNames || 'data')];
        }
      
        // Build the multipart form
        const formData: any = { mode };
        const files: any[] = [];
      
        const item = context.getInputData()[itemIndex];
        
        if (propertyNames.length === 0) {
                throw new NodeOperationError(
                        context.getNode(),
                        `No valid binary property names found. Received: ${JSON.stringify(binaryPropertyNames)}. Please specify binary property names (e.g., "data").`,
                );
        }
        
        for (const propertyName of propertyNames) {
                if (!propertyName || typeof propertyName !== 'string') {
                        throw new NodeOperationError(
                                context.getNode(),
                                `Invalid binary property name: ${JSON.stringify(propertyName)}. Expected a string.`,
                        );
                }
                
                // Get binary data from the item
                const binaryData = item.binary?.[propertyName];
                if (!binaryData) {
                        const availableProperties = item.binary ? Object.keys(item.binary).join(', ') : 'none';
                        throw new NodeOperationError(
                                context.getNode(),
                                `No binary data found for property "${propertyName}". Available binary properties: ${availableProperties}. Make sure the previous node outputs binary data with the specified property name.`,
                        );
                }
                
                // Get buffer from binary data
                const buffer = await context.helpers.getBinaryDataBuffer(itemIndex, propertyName);
                if (!buffer) {
                        throw new NodeOperationError(
                                context.getNode(),
                                `Failed to get binary buffer for property "${propertyName}".`,
                        );
                }
        
                files.push({
                        value: buffer,
                        options: {
                                filename: binaryData.fileName || 'file',
                                contentType: binaryData.mimeType || 'application/pdf',
                        },
                });
        }
      
        if (files.length === 0) {
                throw new NodeOperationError(context.getNode(), 'At least one file is required.');
        }
      
        // Validate that all files have buffers
        for (let i = 0; i < files.length; i++) {
                if (!files[i] || !files[i].value) {
                        throw new NodeOperationError(
                                context.getNode(),
                                `File at index ${i} is missing a valid buffer.`,
                        );
                }
        }
      
        // n8n's httpRequest automatically detects Buffers and sends as multipart/form-data
        // The API expects 'files' to be an array, even for a single file
        // Each file object should have: { value: Buffer, options: { filename, contentType } }
        formData.files = files;
      
        // Add optional params as strings
        if (folderId) formData.folder_id = folderId;
        if (appId) formData.app_id = appId;
        if (tableId) formData.table_id = tableId;
        if (instructions) formData.instructions = instructions;
        if (merge) formData.merge = merge.toString();
      
        const options: IHttpRequestOptions = {
                method: 'POST',
                url: 'https://api.rows.com/v1/vision/import',
                headers: {
                        'Accept': 'application/json',
                },
                body: formData as any,
        };
      
        const response = await context.helpers.httpRequestWithAuthentication.call(context, 'rowsApi', options);
        return response;
      }

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
                                                name: 'Import from Vision AI',
                                                value: 'importVisionAI',
                                                description: 'Import data from PDF or image using Vision AI',
                                                action: 'Import data from PDF or image using Vision AI',
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
                                default: '',
                                required: true,
                                displayOptions: {
                                        hide: {
                                                operation: ['importVisionAI'],
                                        },
                                },
                                description: 'The spreadsheet to operate on. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                        },
                        {
                                displayName: 'Table Name or ID',
                                name: 'tableId',
                                type: 'options',
                                typeOptions: {
                                        loadOptionsMethod: 'getTables',
                                        loadOptionsDependsOn: ['spreadsheetId'],
                                },
                                default: '',
                                required: true,
                                displayOptions: {
                                        hide: {
                                                operation: ['importVisionAI'],
                                        },
                                },
                                description: 'The table to operate on. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                        },
                        {
                                displayName: 'Range',
                                name: 'range',
                                type: 'string',
                                default: 'A1:B',
                                required: true,
                                displayOptions: {
                                        hide: {
                                                operation: ['importVisionAI'],
                                        },
                                },
                                description: 'The range of cells to operate on (e.g., A1:B1000)',
                        },
                        {
                                displayName: 'Data',
                                name: 'data',
                                type: 'string',
                                typeOptions: {
                                        rows: 10,
                                },
                                default: '',
                                required: true,
                                displayOptions: {
                                        hide: {
                                                operation: ['importVisionAI'],
                                        },
                                },
                                description: 'The data to write (JSON array of arrays)',
                                placeholder: '[["Name", "Email"], ["John Doe", "john@example.com"]]',
                        },
                        {
                                displayName: 'Processing Mode',
                                name: 'visionMode',
                                type: 'options',
                                default: 'read',
                                required: true,
                                displayOptions: {
                                        show: {
                                                operation: ['importVisionAI'],
                                        },
                                },
                                options: [
                                        {
                                                name: 'Read',
                                                value: 'read',
                                                description: 'Extracts and returns table data with cell objects (col, row, value) without creating a spreadsheet',
                                        },
                                        {
                                                name: 'Read Simplified',
                                                value: 'read_simplified',
                                                description: 'Extracts and returns table data with simple string values (no cell metadata) without creating a spreadsheet',
                                        },
                                        {
                                                name: 'Create',
                                                value: 'create',
                                                description: 'Creates a spreadsheet with extracted tables',
                                        },
                                ],
                                description: 'Processing mode for Vision AI',
                        },
                        {
                                displayName: 'Binary Property',
                                name: 'binaryPropertyNames',
                                type: 'string',
                                typeOptions: {
                                        multipleValues: true,
                                },
                                default: 'data',
                                required: true,
                                displayOptions: {
                                        show: {
                                                operation: ['importVisionAI'],
                                        },
                                },
                                description: 'One or more image files to process. Supported formats: PNG, JPG, JPEG, WEBP, PDF. The files should be provided by a previous node that outputs binary data.',
                                placeholder: 'data',
                        },
                        {
                                displayName: 'Folder ID',
                                name: 'folderId',
                                type: 'string',
                                default: '',
                                required: false,
                                displayOptions: {
                                        show: {
                                                operation: ['importVisionAI'],
                                                visionMode: ['create'],
                                        },
                                },
                                description: 'The folder unique identifier where the spreadsheet will be created (for create mode). If not present, the system will use the first available folder.',
                        },
                        {
                                displayName: 'Spreadsheet ID',
                                name: 'appId',
                                type: 'string',
                                default: '',
                                required: false,
                                displayOptions: {
                                        show: {
                                                operation: ['importVisionAI'],
                                                visionMode: ['create'],
                                        },
                                },
                                description: 'Target spreadsheet ID (for create mode when appending to existing spreadsheet). Optional. If not provided, a new spreadsheet will be created.',
                        },
                        {
                                displayName: 'Table ID',
                                name: 'tableId',
                                type: 'string',
                                default: '',
                                required: false,
                                displayOptions: {
                                        show: {
                                                operation: ['importVisionAI'],
                                                visionMode: ['create'],
                                        },
                                },
                                description: 'Target table ID (for create mode when appending to existing table). Optional. If provided, data will be appended to the specified table.',
                        },
                        {
                                displayName: 'Instructions',
                                name: 'instructions',
                                type: 'string',
                                typeOptions: {
                                        rows: 3,
                                },
                                default: '',
                                required: false,
                                displayOptions: {
                                        show: {
                                                operation: ['importVisionAI'],
                                        },
                                },
                                description: 'Optional instructions for the AI to guide the extraction process. Examples: "Extract only the financial data"',
                                placeholder: 'Extract table data from images',
                        },
                        {
                                displayName: 'Merge',
                                name: 'merge',
                                type: 'boolean',
                                default: false,
                                required: false,
                                displayOptions: {
                                        show: {
                                                operation: ['importVisionAI'],
                                        },
                                },
                                description: 'Whether to merge data from all files in a single table. If the table_id is provided, the data will be automatically merged into the specified table.',
                        },
                ],
        };

        methods = {
                loadOptions: {
                        async getTables(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
                                const spreadsheetId = this.getNodeParameter('spreadsheetId', 0) as string;

                                if (!spreadsheetId) {
                                        return [];
                                }

                                const credentials = await this.getCredentials('rowsApi');

                                const options: IHttpRequestOptions = {
                                        method: 'GET',
                                        url: `https://api.rows.com/v1/spreadsheets/${spreadsheetId}`,
                                        headers: {
                                                'Authorization': `Bearer ${credentials.apiKey}`,
                                        },
                                        json: true,
                                };

                                try {
                                        const response = await this.helpers.httpRequest(options);
                                        const tables: INodePropertyOptions[] = [];

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
                                        throw new NodeOperationError(this.getNode(), `Failed to load tables: ${message}`);
                                }
                        },

                        async getSpreadsheets(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
                                const credentials = await this.getCredentials('rowsApi');

                                const options: IHttpRequestOptions = {
                                        method: 'GET',
                                        url: 'https://api.rows.com/v1/spreadsheets',
                                        headers: {
                                                'Authorization': `Bearer ${credentials.apiKey}`,
                                        },
                                        json: true,
                                };

                                try {
                                        const response = await this.helpers.httpRequest(options);

                                        if (response.items && Array.isArray(response.items)) {
                                                return response.items.map((spreadsheet: any) => ({
                                                        name: spreadsheet.name,
                                                        value: spreadsheet.id,
                                                }));
                                        }

                                        return [];
                                } catch (error) {
                                        const message = error instanceof Error ? error.message : 'Unknown error';
                                        throw new NodeOperationError(this.getNode(), `Failed to load spreadsheets: ${message}`);
                                }
                        },
                },
        };

        async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
                const items = this.getInputData();
                const returnData: INodeExecutionData[] = [];
                const operation = this.getNodeParameter('operation', 0) as string;

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
                                } else if (operation === 'importVisionAI') {
                                        const result = await importDataFromVisionAI(this, i);
                                        returnData.push({
                                                json: result,
                                                pairedItem: { item: i },
                                        });
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
