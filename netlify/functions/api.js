/* Netlify Serverless Function Handler for Trevy API */
process.env.NETLIFY = 'true';
process.env.TREVY_DB_PATH = '/tmp/trevy.sqlite';
process.env.TREVY_UPLOAD_DIR = '/tmp/trevy-uploads';
const serverless = require('serverless-http');
const { app, seedDevelopmentUsers } = require('../../server.js');

let initialized = false;
let initPromise = null;

async function ensureInitialized() {
  if (initialized) return;
  if (!initPromise) {
    initPromise = seedDevelopmentUsers()
      .then(() => {
        initialized = true;
      })
      .catch((err) => {
        console.error('Initialization error in Netlify function:', err);
        initPromise = null;
        throw err;
      });
  }
  return initPromise;
}

const serverlessHandler = serverless(app);

module.exports.handler = async (event, context) => {
  // Ensure database admin user & seeds are initialized on cold start
  try {
    await ensureInitialized();
  } catch (err) {
    console.error('Failed to initialize users in Netlify function:', err.message);
  }

  // Normalize path if Netlify function redirect prefixed /.netlify/functions/api or /api/api
  if (event.path) {
    let clean = event.path.replace(/^\/\.netlify\/functions\/api/, '');
    clean = clean.replace(/^\/api\/api\//, '/api/');
    if (!clean.startsWith('/api') && !clean.startsWith('/dashboard')) {
      clean = '/api' + (clean.startsWith('/') ? clean : '/' + clean);
    }
    event.path = clean;
  }

  return serverlessHandler(event, context);
};
