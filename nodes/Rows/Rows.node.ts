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
                                description: 'The table to operate on. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                        },
                        {
                                displayName: 'Range',
                                name: 'range',
                                type: 'string',
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
                                default: '',
                                required: true,
                                description: 'The data to write (JSON array of arrays)',
                                placeholder: '[["Name", "Email"], ["John Doe", "john@example.com"]]',
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
