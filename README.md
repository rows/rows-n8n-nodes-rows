# n8n-nodes-rows

An n8n community node for integrating with the [Rows API](https://rows.com/docs/api).

- [Development Setup](#development-setup)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Project Structure](#project-structure)
- [Implementation Details](#implementation-details)
  - [Node Architecture](#node-architecture)
  - [API Integration](#api-integration)
  - [Key Files](#key-files)
    - [`Rows.node.ts`](#rowsnodets)
    - [`operations/`](#operations)
    - [`utils/validation.ts`](#utilsvalidationts)
    - [`RowsApi.credentials.ts`](#rowsapicredentialsts)
- [Development Workflow](#development-workflow)
  - [Making Changes](#making-changes)
  - [Testing Locally](#testing-locally)
  - [Debugging](#debugging)
- [Publishing](#publishing)
- [Resources](#resources)
- [Example workflows](#example-workflows)
  - [Vision](#vision)

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
│       ├── operations/          # Operation-specific implementations
│       │   ├── appendData.ts    # Append Data operation
│       │   ├── overwriteData.ts # Overwrite Data operation
│       │   └── importVisionData.ts # Vision Import operation
│       ├── utils/                # Shared utilities
│       │   └── validation.ts    # File validation functions
│       ├── Rows.node.ts         # Main node implementation
│       ├── Rows.node.json       # Node codex metadata
│       └── rows.svg             # Node icon
├── package.json
└── tsconfig.json
```

## Implementation Details

### Node Architecture

The node implements three operations:
- **Append Data**: Uses the `/values/{range}:append` endpoint
- **Overwrite Data**: Uses the `/cells/{range}` endpoint
- **Import Vision Data**: Uses the `/vision/import` endpoint for extracting data from image files

All operations are extracted into standalone async functions in the `operations/` directory:
- `appendDataToTable`: Appends data to a table
- `overwriteDataInTable`: Overwrites data in a table
- `importVisionData`: Processes a single item (one file per request)
- `importVisionDataFromAllItems`: Processes all items (multiple files in one request)

Shared utilities (file validation, constants) are in the `utils/` directory.

### API Integration

The node uses:
- `httpRequestWithAuthentication` for authenticated API calls
- Dynamic option loading for spreadsheets, tables, and folders
- Bearer token authentication via credentials
- Multipart form data for file uploads (vision import)

### Key Files

#### `Rows.node.ts`
Main node implementation with:
- Node description and properties
- `loadOptions` methods for dynamic dropdowns (spreadsheets, tables, folders)
- `execute` method for processing workflow items
- Orchestrates calls to operation functions

#### `operations/`
Operation-specific implementations:
- `appendData.ts`: Append data to spreadsheet tables
- `overwriteData.ts`: Overwrite data in spreadsheet tables
- `importVisionData.ts`: Vision import with file handling and multipart form data

#### `utils/validation.ts`
Shared validation utilities:
- File type validation (png, jpg, jpeg, webp, pdf)
- File size validation (per file and total limits)
- Maximum number of files validation

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
* [Rows API documentation](https://rows.com/docs/using-rows-api)
* [n8n community nodes](https://docs.n8n.io/integrations/community-nodes/)

## Example workflows

### Vision

```
Read/Write files (file1) ──┐
                           ├──> Merge ──> Rows (Import Vision Data)
Read/Write files (file2) ──┘
```
