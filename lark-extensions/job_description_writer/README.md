# Lark Base Job Description Processor Extension - Integration Guide

This guide will help you integrate the Job Description Processor as a Lark Base Extension.

## Prerequisites

- Node.js (v14 or later)
- npm or yarn
- Access to Lark Base developer portal

## Project Setup

1. Clone or download the project files
2. Install dependencies:

```bash
npm install
# or
yarn install
```

3. Create necessary font files:
   - Place the Panton Bold font files in the `public/fonts` directory
   - The files should be named:
     - `Panton-Bold.woff`
     - `Panton-Bold.woff2`

## Configuration

### Connecting to Your API

1. Open `src/utils/api.ts`
2. Replace the mock implementation with your actual API endpoint:
   - Uncomment the real API implementation at the bottom of the file
   - Replace `https://your-api-endpoint.com/process-job-descriptions` with your API URL

### Testing Locally

1. Start the development server:

```bash
npm start
# or
yarn start
```

2. The app will run at `http://localhost:3000`
3. You can test file uploads and the mock API integration

## Building for Production

1. Build the project:

```bash
npm run build
# or
yarn build
```

2. The output will be in the `build` directory

## Registering Extension with Lark Base

1. Log in to the Lark Base developer portal
2. Create a new extension:
   - Name: "Job Description Processor"
   - Description: "Process job descriptions from text files and update Lark Base tables"
   - Upload your built files from the `build` directory

3. Configure extension permissions:
   - Request read/write access to tables
   - Request access to user's files for processing

4. Submit the extension for review

## Extension Configuration in Lark Base

Once your extension is approved:

1. Open your Lark Base workspace
2. Navigate to the Extensions menu
3. Find and enable the "Job Description Processor" extension
4. Configure table field mappings if necessary
5. Start using the extension!

## Table Structure Requirements

The extension requires your Lark Base table to have the following fields:

1. Job Description (text field)
2. Job Position (text field)
3. Job Expiry Date (date field)

The extension will automatically detect fields with similar names, but it's best to use these exact names for compatibility.

## Troubleshooting

### Extension Not Loading

- Ensure you've granted all necessary permissions
- Check browser console for any JavaScript errors
- Verify the extension is enabled in your workspace

### API Connection Issues

- Check your network connection
- Ensure your API endpoint is accessible from the client
- Verify your API returns data in the expected format

### Field Mapping Problems

- Make sure your table has the required fields
- Field names should include "job description", "job position", and "expiry"
- If fields aren't being detected, try renaming them to match these patterns

## Support

If you encounter any issues with this extension, please contact support at your-email@example.