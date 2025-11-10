import { IExecuteFunctions, NodeOperationError, IHttpRequestOptions } from 'n8n-workflow';

export async function appendDataToTable(context: IExecuteFunctions, itemIndex: number) {
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

    if (!Array.isArray(data) || !data.every((row) => Array.isArray(row))) {
        throw new NodeOperationError(context.getNode(), 'Data must be an array of arrays');
    }

    const values = data.map((row) => row.map((value) => String(value)));

    const options: IHttpRequestOptions = {
        method: 'POST',
        url: `https://api.rows.com/v1/spreadsheets/${spreadsheetId}/tables/${tableId}/values/${range}:append`,
        json: true,
        body: {
            values,
        },
    };

    const response = await context.helpers.httpRequestWithAuthentication.call(
        context,
        'rowsApi',
        options,
    );
    return response;
}
