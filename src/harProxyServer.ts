#!/usr/bin/env node

import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import pkg from '../package.json';
import { recordedHarMiddleware } from './recordedHarMiddleware';
import { recorderHarMiddleware } from './recorderHarMiddleware';
import { loadHarData, appendEntryAndSaveHar } from './harFileUtils';

const dateAndTime = new Date();
const defaultHarFileName = `recording-${dateAndTime.toISOString().replace(/[:.]/g, '-')}.har`;

const argv = yargs(hideBin(process.argv))
  .options({
    port: {
      alias: 'p',
      type: 'number',
      description: 'The port to listen on',
      default: 3000,
    },
    'target-url': {
      alias: 't',
      type: 'string',
      description: 'The target URL to proxy',
    },
    'har-file': {
      alias: 'f',
      type: 'string',
      description: 'The file path to save the HAR file',
      default: defaultHarFileName,
    },
    mode: {
      alias: 'm',
      type: 'string',
      description: 'The mode to run the server in (play or record)',
      choices: ['play', 'record'],
      default: 'play',
    },
  })
  .version('version', 'Show version and app information', `App: ${pkg.name}\nVersion: ${pkg.version}\nDescription: ${pkg.description}`)
  .help('h')
  .alias('h', 'help')
  .parseSync();

// Check if target-url is provided when required
if (argv.mode === 'record' && !argv['target-url']) {
  console.error("Error: --target-url is required when --mode is 'record'");
  process.exit(1);
}

const targetUrl = argv['target-url'] || '';
const harFile = argv['har-file'];
const app = express();
const port = argv['port'];
const prefix = argv['prefix'];
const mode = argv['mode'];

// This route returns the application's name, version, and description as a JSON object.
app.get('/harproxyserver/version', (req, res) => {
  res.json({
    app: pkg.name,
    version: pkg.version,
    description: pkg.description,
  });
});

// Set up the server based on the selected mode.
switch(mode) {
case 'play': {
  /**
   * Use the recorded HAR middleware to serve HAR data.
   */
  app.use(`${prefix}/`, recordedHarMiddleware(harFile, loadHarData));
  break;
}
case 'record': {
  const onProxyResHandler = recorderHarMiddleware(harFile, appendEntryAndSaveHar);

  /**
   * Set up the proxy middleware to forward requests to the target server.
   */
  app.use(
    '/',
    createProxyMiddleware({
      target: targetUrl,
      changeOrigin: true,
      selfHandleResponse: true,
      onProxyRes: onProxyResHandler,
    })
  );
  break;
}
}

app.listen(port, () => {
  console.log(`Proxy server listening at http://localhost:${port}`);
});