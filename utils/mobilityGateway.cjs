'use strict';

const fs = require('fs');
const https = require('https');
const http = require('http');
const FormData = require('form-data');

/* -------------------------------------------------- */
/* ---------------- CONSTANTS ----------------------- */
/* -------------------------------------------------- */

const GATEWAY_URLS = {
    staging: 'https://stg-gateway.qyrus.com',
    uat: 'https://uat-gateway.qyrus.com',
    prod: 'https://gateway.qyrus.com'
};

const MOBILITY_CONTEXT = '/mobility-no-auth/v1';
const UM_CONTEXT = '/um-noauth/v1';
const POLL_INTERVAL = 30000;
const APP_UPLOAD_LIMIT = 20;

/* -------------------------------------------------- */
/* ----------- ENVIRONMENT DERIVATION -------------- */
/* -------------------------------------------------- */

function getEnvName(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') return null;
    const parts = apiKey.split('_');
    // format: sk_<envName>_<uuid>
    return parts.length >= 3 ? parts[1] : null;
}

function deriveGatewayUrlFromApiKey(apiKey) {
    const env = getEnvName(apiKey);
    if (!env) throw new Error('Unable to parse environment from API key. Expected format: sk_<env>_<uuid>');
    if (env === 'stg' || env === 'staging') return GATEWAY_URLS.staging;
    if (env === 'qyrus') return GATEWAY_URLS.prod;
    return `https://${env}-gateway.qyrus.com`;
}

/* -------------------------------------------------- */
/* ---------------- DEBUG TRACING ------------------- */
/* -------------------------------------------------- */

let debugEnabled = false;

function setDebug(enabled) {
    debugEnabled = enabled === true || enabled === 'yes';
}

function isDebugEnabled() {
    return debugEnabled;
}

function truncate(text, limit = 4000) {
    const value = typeof text === 'string' ? text : String(text);
    return value.length > limit ? `${value.slice(0, limit)}... (${value.length} bytes total)` : value;
}

function traceRequest(gatewayUrl, method, path, payload) {
    if (!debugEnabled) return;
    console.log('\x1b[90m%s\x1b[0m', `--> ${method} ${gatewayUrl}${path}`);
    if (payload) console.log('\x1b[90m%s\x1b[0m', `    request body : ${truncate(payload)}`);
}

function traceResponse(method, path, response) {
    if (!debugEnabled) return;
    const failed = response.statusCode >= 400;
    const colour = failed ? '\x1b[31m' : '\x1b[90m';
    console.log(`${colour}<-- ${response.statusCode} ${method} ${path}\x1b[0m`);
    if (failed) console.log(`${colour}    response body: ${truncate(response.body)}\x1b[0m`);
}

/**
 * Failure text that always names the endpoint, so a bad response can be traced
 * back to the API that produced it without re-running under --enableDebug.
 */
function describeFailure(method, path, response, payload) {
    const detail = extractErrorMessage(response.body);
    let message = `${method} ${path} responded HTTP ${response.statusCode}: ${detail}`;
    if (payload) message += `\n         request sent: ${truncate(payload)}`;
    return message;
}

/* -------------------------------------------------- */
/* ---------------- HTTP HELPERS -------------------- */
/* -------------------------------------------------- */

function apiHeaders(apiKey, teamId, extra = {}) {
    const headers = { 'x-api-key': apiKey, scope: 'NODE_CLI', ...extra };
    if (teamId) headers['Team-Id'] = teamId;
    return headers;
}

function httpRequest(gatewayUrl, options, payload = null) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(gatewayUrl);
        const protocol = parsed.protocol === 'https:' ? https : http;

        traceRequest(gatewayUrl, options.method, options.path, payload);

        const req = protocol.request({
            hostname: parsed.hostname,
            port: parsed.port,
            ...options
        }, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk.toString(); });
            res.on('end', () => {
                const response = { statusCode: res.statusCode, body };
                traceResponse(options.method, options.path, response);
                resolve(response);
            });
        });

        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

function getJson(gatewayUrl, apiKey, teamId, path, description) {
    return httpRequest(gatewayUrl, {
        path,
        method: 'GET',
        headers: apiHeaders(apiKey, teamId)
    }).then((response) => parseJsonResponse(response, description, path));
}

function postJson(gatewayUrl, apiKey, teamId, path, body) {
    const payload = JSON.stringify(body);
    return httpRequest(gatewayUrl, {
        path,
        method: 'POST',
        headers: apiHeaders(apiKey, teamId, {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        })
    }, payload);
}

/**
 * Streams a multipart body to the gateway. Used for app and script uploads;
 * piping keeps large apk files off the heap.
 */
function multipartRequest(gatewayUrl, apiKey, teamId, path, formData) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(gatewayUrl);
        const protocol = parsed.protocol === 'https:' ? https : http;

        traceRequest(gatewayUrl, 'POST', path, '<multipart form-data>');

        const headers = { ...formData.getHeaders(), ...apiHeaders(apiKey, teamId) };
        try {
            headers['Content-Length'] = formData.getLengthSync();
        } catch (error) {
            // falls back to chunked transfer-encoding if a part's length isn't known
        }
        if (isDebugEnabled()) {
            console.log('\x1b[90m%s\x1b[0m', `    request headers: ${JSON.stringify(headers)}`);
        }

        const req = protocol.request({
            hostname: parsed.hostname,
            port: parsed.port,
            path,
            method: 'POST',
            headers
        }, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk.toString(); });
            res.on('end', () => {
                const response = { statusCode: res.statusCode, body };
                traceResponse('POST', path, response);
                resolve(response);
            });
        });

        req.on('error', reject);
        formData.pipe(req);
    });
}

function parseJsonResponse(response, description, path) {
    if (response.statusCode !== 200) {
        const where = path ? ` (GET ${path})` : '';
        throw new Error(`Failed to fetch ${description}${where} — HTTP ${response.statusCode}: ${extractErrorMessage(response.body)}`);
    }
    try {
        return JSON.parse(response.body);
    } catch (error) {
        throw new Error(`Invalid JSON response while fetching ${description}.`);
    }
}

/**
 * Gateways return either a bare message or a JSON envelope on failure.
 * Prefer the service's own errorMessage when one is present.
 */
function extractErrorMessage(responseBody) {
    if (!responseBody) return 'no response body';
    try {
        const parsed = JSON.parse(responseBody);
        return parsed.errorMessage || parsed.message || responseBody;
    } catch (error) {
        return responseBody;
    }
}

function matchesName(value, name) {
    return typeof value === 'string' && typeof name === 'string' &&
        value.toLowerCase() === name.toLowerCase();
}

/* -------------------------------------------------- */
/* ---------------- AUTHENTICATION ------------------ */
/* -------------------------------------------------- */

async function validateApiKey(gatewayUrl, apiKey) {
    if (!apiKey) throw new Error('API key is missing. Provide it with --apiKey or in your configuration file.');

    const rawToken = apiKey.startsWith('Bearer ') ? apiKey.substring(7) : apiKey;

    const response = await httpRequest(gatewayUrl, {
        path: `${UM_CONTEXT}/api/validateAPIToken?apiToken=${encodeURIComponent(rawToken)}&scope=NODE_CLI`,
        method: 'GET',
        headers: { accept: 'application/json' }
    });

    if (response.statusCode !== 200) {
        throw new Error(`API key validation failed — HTTP ${response.statusCode}: ${extractErrorMessage(response.body)}`);
    }

    const data = JSON.parse(response.body);
    return { login: data.login || null, organizationName: data.organizationName || null };
}

/* -------------------------------------------------- */
/* ---------------- NAME RESOLUTION ----------------- */
/* -------------------------------------------------- */

async function getTeamUuid(gatewayUrl, apiKey, teamName) {
    const teams = await getJson(gatewayUrl, apiKey, null, `${UM_CONTEXT}/api/teams-by-user-and-role`, 'teams');
    const team = teams.find((t) => matchesName(t.teamName, teamName));
    if (!team) throw new Error('Invalid teamName, please provide valid teamName!');
    return team.uuid.trim();
}

async function getProjectUuid(gatewayUrl, apiKey, teamId, projectName) {
    const path = `${MOBILITY_CONTEXT}/api/projects-by-team-and-service-store?teamId=${teamId}&serviceStoreId=${teamId}`;
    const projects = await getJson(gatewayUrl, apiKey, teamId, path, 'projects');
    const project = projects.find((p) => matchesName(p.projectName, projectName));
    if (!project) throw new Error('Invalid projectName, please provide valid projectName!');
    return project.uuid.trim();
}

async function getSuiteUuid(gatewayUrl, apiKey, teamId, projectId, suiteName) {
    const path = `${MOBILITY_CONTEXT}/api/active-test-suites?projectId=${projectId}`;
    const suites = await getJson(gatewayUrl, apiKey, teamId, path, 'test suites');
    const suite = suites.find((s) => matchesName(s.testSuiteName, suiteName));
    if (!suite) throw new Error('Invalid suiteName, please provide valid suiteName!');
    return suite.uuid.trim();
}

/**
 * Resolves a global-variable environment name to its id.
 * An empty name or "Global" means the run is not scoped to an environment.
 */
async function getEnvironmentId(gatewayUrl, apiKey, teamId, projectId, envName) {
    if (!envName || envName.trim() === '' || envName.trim().toLowerCase() === 'global') return null;

    const environments = await getEnvironments(gatewayUrl, apiKey, teamId, projectId);
    const environment = environments.find((e) => matchesName(e.environmentName, envName));
    if (!environment) throw new Error('Invalid environmentName, please provide valid environmentName!');
    return environment.environmentId;
}

async function getEnvironments(gatewayUrl, apiKey, teamId, projectId) {
    const path = `${MOBILITY_CONTEXT}/api/get-all-global-variable-environments/${projectId}`;
    return getJson(gatewayUrl, apiKey, teamId, path, 'variable environments');
}

async function getDevicePoolUuid(gatewayUrl, apiKey, teamId, projectId, poolName) {
    const path = `${MOBILITY_CONTEXT}/api/device-pools?projectArn=${projectId}`;
    const pools = await getJson(gatewayUrl, apiKey, teamId, path, 'device pools');
    const pool = pools.find((p) => matchesName(p.poolName, poolName));
    if (!pool) {
        throw new Error('Unable to find device pool with the given name! Please verify given device pool exists on Qyrus.');
    }
    return pool.uuid.trim();
}

async function listApps(gatewayUrl, apiKey, teamId, projectId) {
    const path = `${MOBILITY_CONTEXT}/api/upload-apk?projectArn=${projectId}`;
    return getJson(gatewayUrl, apiKey, teamId, path, 'apps');
}

async function getActiveScripts(gatewayUrl, apiKey, teamId, suiteId) {
    const path = `${MOBILITY_CONTEXT}/api/active-test-scripts?testSuiteId=${suiteId}`;
    return getJson(gatewayUrl, apiKey, teamId, path, 'test scripts');
}

/**
 * Resolves team and project in one step - every mobility command needs both.
 */
async function resolveProjectContext(gatewayUrl, apiKey, teamName, projectName) {
    const teamId = await getTeamUuid(gatewayUrl, apiKey, teamName);
    const projectId = await getProjectUuid(gatewayUrl, apiKey, teamId, projectName);
    return { teamId, projectId };
}

/* -------------------------------------------------- */
/* ---------------- CONFIG FILE --------------------- */
/* -------------------------------------------------- */

function readConfigFile(filePath) {
    let fileInfo;
    try {
        fileInfo = fs.readFileSync(filePath);
    } catch (error) {
        throw new Error('There was an error while trying to read your file.  Check your file and filepath.');
    }

    try {
        return JSON.parse(fileInfo);
    } catch (error) {
        throw new Error('Could not parse your JSON file.  Check your configuration.');
    }
}

/**
 * Command line flags take precedence over the configuration file.
 */
function resolveOption(flagValue, fileValue, fallback = null) {
    if (flagValue != null) return flagValue;
    if (fileValue != null) return fileValue;
    return fallback;
}

module.exports = {
    GATEWAY_URLS,
    MOBILITY_CONTEXT,
    UM_CONTEXT,
    POLL_INTERVAL,
    APP_UPLOAD_LIMIT,
    getEnvName,
    deriveGatewayUrlFromApiKey,
    apiHeaders,
    httpRequest,
    getJson,
    postJson,
    multipartRequest,
    parseJsonResponse,
    extractErrorMessage,
    describeFailure,
    setDebug,
    isDebugEnabled,
    matchesName,
    validateApiKey,
    getTeamUuid,
    getProjectUuid,
    getSuiteUuid,
    getEnvironmentId,
    getEnvironments,
    getDevicePoolUuid,
    listApps,
    getActiveScripts,
    resolveProjectContext,
    readConfigFile,
    resolveOption
};
