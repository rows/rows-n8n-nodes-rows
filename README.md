# n8n-nodes-rows

An n8n community node for integrating with the [Rows API](https://rows.com/docs/api).

## Development Setup

### Prerequisites

* Node.js 20+ and npm
* n8n installed globally: `npm install n8n -g`
* Git

### Installation

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd n8n-nodes-rows
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the node:
   ```bash
   npm run build
   ```

4. Link for local development:
   ```bash
   npm link
   ```

5. Link in your n8n installation:
   ```bash
   cd ~/.n8n/custom
   npm link n8n-nodes-rows
   ```

In case you don't have the folder `custom` locally, you can create it with `mkdir custom`

6. Restart n8n to load the node

### Project Structure

```
n8n-nodes-rows/
├── credentials/
│   └── RowsApi.credentials.ts    # API credential configuration
├── nodes/
│   └── Rows/
│       ├── Rows.node.ts           # Main node implementation
│       ├── Rows.node.json         # Node codex metadata
│       └── rows.svg               # Node icon
├── package.json
└── tsconfig.json
```

## Implementation Details

### Node Architecture

The node implements two operations:
- **Append Data**: Uses the `/values/{range}:append` endpoint
- **Overwrite Data**: Uses the `/cells/{range}` endpoint

Both operations are extracted into standalone async functions (`appendDataToTable`, `overwriteDataInTable`) that receive the execution context and item index as parameters.

### API Integration

The node uses:
- `httpRequestWithAuthentication` for authenticated API calls
- Dynamic option loading for spreadsheets and tables
- Bearer token authentication via credentials

### Key Files

#### `Rows.node.ts`
Main node implementation with:
- Node description and properties
- `loadOptions` methods for dynamic dropdowns
- `execute` method for processing workflow items
- Helper functions for API operations

#### `RowsApi.credentials.ts`
Defines the credential schema for Rows API key authentication.

## Development Workflow

### Making Changes

1. Edit the TypeScript files in `nodes/` or `credentials/`
2. Run linter:
   ```bash
   npm run lint
   # or auto-fix issues:
   npm run lintfix
   ```
3. Rebuild:
   ```bash
   npm run build
   ```

### Testing Locally

1. Start n8n in development mode:
   ```bash
   n8n start
   ```

2. Access n8n at `http://localhost:5678`

3. Create a workflow with the Rows node

### Debugging

Enable n8n debug logging:
```bash
export N8N_LOG_LEVEL=debug
n8n start
```

Check logs for API request/response details.

## Publishing

1. Update version in `package.json`
2. Build: `npm run build`
3. Publish to npm: `npm publish`
4. (Optional) Submit for n8n cloud verification: [docs](https://docs.n8n.io/integrations/creating-nodes/deploy/submit-community-nodes/)

## Resources

* [n8n node development docs](https://docs.n8n.io/integrations/creating-nodes/)
* [Rows API documentation](https://rows.com/docs/api)
* [n8n community nodes](https://docs.n8n.io/integrations/community-nodes/)
