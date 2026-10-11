/**
 * Firebase HTTPS function `consultaAvgust`.
 * Binds GEMINI_API_KEY from Secret Manager. The value is not in this file.
 */
import {onRequest} from 'firebase-functions/v2/https';
import {defineSecret} from 'firebase-functions/params';
import {consultaAvgustHandler} from './consulta-avgust.js';

const geminiApiKey = defineSecret('GEMINI_API_KEY');

export const consultaAvgust = onRequest(
  {
    region: 'us-central1',
    secrets: [geminiApiKey],
    cors: false,
    invoker: 'public',
    timeoutSeconds: 60,
    memory: '256MiB',
    maxInstances: 3
  },
  (req, res) => {
    const secret = geminiApiKey.value();
    if (secret) process.env.GEMINI_API_KEY = secret;
    return consultaAvgustHandler(req, res);
  }
);
