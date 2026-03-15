/**
 * Outbreak Data Fetcher Lambda Function Entry Point
 * 
 * Delegates to the actual implementation in src/index.js
 * This file exists to maintain compatibility with the Dockerfile CMD
 */

const { handler: actualHandler } = require('./src/index');

exports.handler = actualHandler;
