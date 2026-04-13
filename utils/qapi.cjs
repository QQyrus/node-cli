'use strict';

const https = require('https');
const http = require('http');

/* -------------------------------------------------- */
/* ---------------- CONSTANTS ----------------------- */
/* -------------------------------------------------- */

const GATEWAY_URLS = {
    staging: 'https://stg-gateway.qyrus.com:8243',
    uat:     'https://uat-gateway.qyrus.com:8243',
    prod:    'https://gateway.qyrus.com:8243'
};

const gatewayAuth        = 'Bearer 90540897-748a-3ef2-b3a3-c6f8f42022da';
const baseContext        = '/api-marketplace-qapi/v1';
const POLL_INTERVAL      = 30000;
const HARDCODED_TEAM_ID  = '2ce9dbea7c07499eb907ab836f919548';

/* -------------------------------------------------- */
/* ----------- ENVIRONMENT DERIVATION -------------- */
/* -------------------------------------------------- */

function deriveGatewayUrlFromApiKey(apiKey) {
    if (!apiKey) throw new Error('API key is required to derive gateway URL.');
    if (apiKey.includes('stg')) return GATEWAY_URLS.staging;
    if (apiKey.includes('uat'))     return GATEWAY_URLS.uat;
    if (apiKey.includes('qyrus'))   return GATEWAY_URLS.prod;
    throw new Error('Unable to determine environment from API key. Key must contain "staging", "uat", or "qyrus".');
}

/* -------------------------------------------------- */
/* ---------------- HTTP HELPER --------------------- */
/* -------------------------------------------------- */

function httpRequest(gatewayUrl, options, payload = null) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(gatewayUrl);
        const protocol = parsed.protocol === 'https:' ? https : http;

        const req = protocol.request({
            hostname: parsed.hostname,
            port: parsed.port,
            rejectUnauthorized: false,
            ...options
        }, (res) => {
            const chunks = [];
            res.on('data', (chunk) => { chunks.push(chunk); });
            res.on('end', () => { resolve({ statusCode: res.statusCode, body: Buffer.concat(chunks) }); });
        });

        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

// Builds headers for all authenticated API calls
function apiHeaders(apiKey, extra = {}) {
    return {
        'x-api-key': apiKey,
        authorization: gatewayAuth,
        'scope': 'NODE_CLI',
        'Team-Id': HARDCODED_TEAM_ID,
        ...extra
    };
}

/* -------------------------------------------------- */
/* ---------------- CORE TRIGGER -------------------- */
/* -------------------------------------------------- */

async function trigger(executionType, apiKey, workspaceName, suiteName, emailId, envName, threadCount, latencyThreshold) {
    try {
        const type = (executionType || 'functional').toUpperCase();
        if (!['FUNCTIONAL', 'PERFORMANCE'].includes(type)) {
            throw new Error(`Invalid executionType "${executionType}". Must be "functional" or "performance".`);
        }

        const gatewayUrl = deriveGatewayUrlFromApiKey(apiKey);
        console.log('\x1b[32m%s\x1b[0m', `Preparing API ${type.toLowerCase()} execution...`);

        const validation = await validateSaltToken(apiKey, gatewayUrl);
        if (!validation.success) throw new Error(validation.message);
        console.log('\x1b[36m%s\x1b[0m', `✔ Token validated — User: ${validation.login}`);

        const userEmail = validation.login;

        const projectId = await getProjectId(gatewayUrl, apiKey, workspaceName);
        console.log('\x1b[36m%s\x1b[0m', `✔ Resolved workspace: "${workspaceName}" → ${projectId}`);

        const suiteId = await getSuiteId(gatewayUrl, apiKey, projectId, suiteName);
        console.log('\x1b[36m%s\x1b[0m', `✔ Located suite: "${suiteName}" → ${suiteId}`);

        const envId = await getEnvironmentId(gatewayUrl, apiKey, projectId, envName);
        console.log('\x1b[36m%s\x1b[0m', envId ? `✔ Bound environment: "${envName}" → ${envId}` : `✔ Environment: Global Default`);

        const runId = await executeTest(gatewayUrl, apiKey, projectId, suiteId, envId, userEmail, emailId, type, threadCount, latencyThreshold);
        console.log('\x1b[32m%s\x1b[0m', `✔ Execution dispatched — Run ID: ${runId}`);

        await pollExecutionStatus(gatewayUrl, apiKey, runId, suiteName);

    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', `✖ ${error.message}`);
        process.exit(1);
    }
}

/* -------------------------------------------------- */
/* ---------------- EXECUTION ----------------------- */
/* -------------------------------------------------- */

async function executeTest(gatewayUrl, apiKey, projectId, suiteId, envId, userEmail, emailId, executionType, threadCount, latencyThreshold) {
    const body = {
        suiteIds: [suiteId],
        scriptIds: [],
        userEmail: emailId || userEmail,
        projectId,
        isJenkins: false,
        pluginName: 'CLI',
        isScheduled: false,
        environmentId: envId || null,
        executionType
    };

    if (executionType === 'PERFORMANCE') {
        body.threadCount         = threadCount ? parseInt(threadCount, 10) : 1;
        body.latencyThreshold    = latencyThreshold ? parseInt(latencyThreshold, 10) : null;
        body.virtualUserWalletType = 'PRIVATE';
    }

    const payload = JSON.stringify(body);

    const response = await httpRequest(gatewayUrl, {
        path: `${baseContext}/api/execute-test`,
        method: 'POST',
        headers: apiHeaders(apiKey, {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        })
    }, payload);

    if (![200, 202].includes(response.statusCode)) {
        throw new Error(`Execution trigger failed — HTTP ${response.statusCode}: ${response.body.toString()}`);
    }

    const data = JSON.parse(response.body.toString());
    const run = Array.isArray(data) ? data[0] : data;
    if (!run?.id) throw new Error('Run ID absent in execution response.');
    return run.id.toString();
}

/* -------------------------------------------------- */
/* ---------------- POLLING ------------------------- */
/* -------------------------------------------------- */

const STATUS_LABELS = {
    SPAWNING_INSTANCE:     'Spawning instance...',
    INSTANCE_SPAWNED:      'Instance spawned',
    EXECUTION_NOT_STARTED: 'Waiting to start...',
    RUN_SCHEDULED:         'Run scheduled',
    RUN_INITIATED:         'Run initiated',
    P1:                    'Processing (P1)',
    RUNNING:               'Running tests...',
    EXECUTING:             'Executing tests...',
    UPLOADING_RESULTS:     'Uploading results...',
    GENERATING_REPORTS:    'Generating report...',
    COMPLETED:             'Execution completed',
    CANCELLED:             'Execution cancelled',
    ABORTING:              'Execution aborting',
    ABORTED:               'Execution aborted',
    FAILED:                'Execution failed',
    ERROR_IN_RUN:          'Error in run'
};

const TERMINAL_FAILURE_STATUSES = new Set(['CANCELLED', 'ABORTING', 'ABORTED', 'FAILED', 'ERROR_IN_RUN']);

async function pollExecutionStatus(gatewayUrl, apiKey, runId, suiteName) {
    let lastStatus = null;

    while (true) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL));

        const response = await httpRequest(gatewayUrl, {
            path: `${baseContext}/api/get-all-report-list`,
            method: 'POST',
            headers: apiHeaders(apiKey, {
                'Content-Type': 'application/json',
                'Content-Length': '2'
            })
        }, '{}');

        if (response.statusCode !== 200) {
            console.log('\x1b[33m%s\x1b[0m', `Poll returned HTTP ${response.statusCode}, retrying...`);
            continue;
        }

        const data = JSON.parse(response.body.toString());
        const runs = data.content || [];
        const run  = runs.find(r => r.id === runId);

        if (!run) {
            console.log('\x1b[33m%s\x1b[0m', `Run ${runId} not yet visible in report list, retrying...`);
            continue;
        }

        const status = run.executionStatus;

        if (status !== lastStatus) {
            const label = STATUS_LABELS[status] || `Status: ${status}`;
            console.log('\x1b[33m%s\x1b[0m', `  ${label}`);
            lastStatus = status;
        }

        if (status === 'COMPLETED') {
            await showReport(gatewayUrl, apiKey, run, suiteName);
            return;
        }

        if (TERMINAL_FAILURE_STATUSES.has(status)) {
            console.error('\x1b[31m%s\x1b[0m', `✖ Run terminated with status: ${status}`);
            process.exit(1);
        }
    }
}

/* -------------------------------------------------- */
/* ---------------- REPORT -------------------------- */
/* -------------------------------------------------- */

async function showReport(gatewayUrl, apiKey, run, suiteName) {
    console.log('\n\x1b[32m%s\x1b[0m', `━━━ Execution Summary: ${suiteName} ━━━`);

    const hasFailed  = run.status === 'FAIL' || run.status === 'FAILED';
    const resultColor = hasFailed ? '\x1b[31m' : '\x1b[32m';
    console.log(`${resultColor}Result: ${run.status ?? (hasFailed ? 'FAIL' : 'PASS')}\x1b[0m`);

    if (run.passTestCase  != null) console.log(`  Passed : ${run.passTestCase}`);
    if (run.failTestCase  != null) console.log(`  Failed : ${run.failTestCase}`);
    if (run.totalTestCases != null) console.log(`  Total  : ${run.totalTestCases}`);

    // htmlReportUrl from the run record is the resource path for signed-cookies
    if (run.htmlReportUrl && run.htmlReportStatus === 'COMPLETED') {
        const signedUrl = await getSignedCookieUrl(gatewayUrl, apiKey, run.htmlReportUrl);
        if (signedUrl) {
            process.stdout.write(`\nReport: \x1b]8;;${signedUrl}\x1b\\View Report\x1b]8;;\x1b\\\n`);
            console.log('(Ctrl+Click to open in browser)\n');
        }
    } else {
        console.log('\x1b[33m%s\x1b[0m', 'Report not yet available or still processing.');
    }

    process.exit(hasFailed ? 1 : 0);
}

async function getSignedCookieUrl(gatewayUrl, apiKey, resourcePath) {
    const response = await httpRequest(gatewayUrl, {
        path: `${baseContext}/api/signed-cookies?resourcePath=${encodeURIComponent(resourcePath)}`,
        method: 'GET',
        headers: apiHeaders(apiKey)
    });

    if (response.statusCode !== 200) {
        console.log('\x1b[33m%s\x1b[0m', `Could not fetch signed cookie URL — HTTP ${response.statusCode}`);
        return null;
    }

    const data = JSON.parse(response.body.toString());
    return data.signedUrl || null;
}

/* -------------------------------------------------- */
/* ---------------- SUPPORT APIS -------------------- */
/* -------------------------------------------------- */

async function validateSaltToken(token, gatewayUrl) {
    const rawToken = token.startsWith('Bearer ') ? token.substring(7) : token;

    const response = await httpRequest(gatewayUrl, {
        path: `/um-noauth/v1/api/validateAPIToken?apiToken=${rawToken}&scope=NODE_CLI`,
        method: 'GET'
    });

    if (response.statusCode !== 200) {
        return { success: false, message: `Token validation failed — HTTP ${response.statusCode}: ${response.body.toString()}` };
    }

    const data = JSON.parse(response.body.toString());
    return { success: true, login: data.login || null };
}

async function getProjectId(gatewayUrl, apiKey, workspaceName) {
    const payload = JSON.stringify({
        type: null, projectName: null, page: 0, size: 0,
        normalUserId: null, collaborators: null
    });

    const response = await httpRequest(gatewayUrl, {
        path: `${baseContext}/api/project-details`,
        method: 'POST',
        headers: apiHeaders(apiKey, {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        })
    }, payload);

    if (response.statusCode !== 200) throw new Error(`Failed to fetch projects — HTTP ${response.statusCode}`);

    const projects = JSON.parse(response.body.toString());
    const project  = projects.find(p => p.name?.toLowerCase() === workspaceName.toLowerCase());
    if (!project) throw new Error(`Workspace not found: "${workspaceName}"`);
    return project.id.trim();
}

async function getSuiteId(gatewayUrl, apiKey, projectId, suiteName) {
    const response = await httpRequest(gatewayUrl, {
        path: `${baseContext}/api/suites?projectId=${projectId}&isChaining=false`,
        method: 'GET',
        headers: apiHeaders(apiKey)
    });

    if (response.statusCode !== 200) throw new Error(`Failed to fetch suites — HTTP ${response.statusCode}`);

    const data  = JSON.parse(response.body.toString());
    const suite = (data.content || []).find(s => s.name?.toLowerCase() === suiteName.toLowerCase());
    if (!suite) throw new Error(`Suite not found: "${suiteName}"`);
    return suite.id.trim();
}

async function getEnvironmentId(gatewayUrl, apiKey, projectId, envName) {
    if (!envName || envName.trim() === '') return null;

    const response = await httpRequest(gatewayUrl, {
        path: `${baseContext}/api/get-environments-by-projectId?projectId=${projectId}`,
        method: 'GET',
        headers: apiHeaders(apiKey)
    });

    if (response.statusCode !== 200) throw new Error(`Failed to fetch environments — HTTP ${response.statusCode}`);

    const envs = JSON.parse(response.body.toString());
    const env  = envs.find(e => e.name?.toLowerCase() === envName.toLowerCase());
    return env ? env.id.trim() : null;
}

module.exports = { trigger, validateSaltToken };