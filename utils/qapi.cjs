'use strict';

const https = require('https');
const http = require('http');

/* -------------------------------------------------- */
/* ---------------- CONSTANTS ----------------------- */
/* -------------------------------------------------- */

const GATEWAY_URLS = {
    stg: 'https://stg-gateway.qyrus.com:8243',
    uat: 'https://uat-gateway.qyrus.com',
    prod: 'https://gateway.qyrus.com'
};

const baseContext = '/api-marketplace-qapi-noauth/v1';
const POLL_INTERVAL = 30000;

/* -------------------------------------------------- */
/* ----------- ENVIRONMENT DERIVATION -------------- */
/* -------------------------------------------------- */

function deriveGatewayUrlFromApiKey(apiKey) {
    const env = getEnvName(apiKey);
    if (!env) throw new Error('Unable to parse environment from API key.');
    if (env === 'stg' || env === 'staging') return GATEWAY_URLS.stg;
    if (env === 'qyrus') return GATEWAY_URLS.prod;
    return `https://${env}-gateway.qyrus.com`;
}

function getEnvName(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') return null;
    const parts = apiKey.split('_');
    if (parts.length < 3) return null;
    // parts[1] = "stg-qapi" → strip "-qapi" to get "stg"
    return parts[1].replace(/-qapi$/i, '');
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

function apiHeaders(apiKey, teamId, extra = {}) {
    return {
        'x-api-key': apiKey,
        'scope': 'NODE_CLI',
        'Team-Id': teamId,
        ...extra
    };
}

/* -------------------------------------------------- */
/* ---------------- CORE TRIGGER -------------------- */
/* -------------------------------------------------- */

async function trigger(executionType, apiKey, workspaceName, suiteName, scriptName, envName, threadCount, latencyThreshold, virtualUserWalletType) {
    try {
        const type = (executionType || 'functional').toUpperCase();
        if (!['FUNCTIONAL', 'PERFORMANCE'].includes(type)) {
            throw new Error(`Invalid executionType "${executionType}". Must be "functional" or "performance".`);
        }

        const walletType = (virtualUserWalletType || 'PRIVATE').toUpperCase();
        if (!['PRIVATE', 'SHARED'].includes(walletType)) {
            throw new Error(`Invalid virtualUserWalletType "${virtualUserWalletType}". Must be "PRIVATE" or "SHARED".`);
        }

        const gatewayUrl = deriveGatewayUrlFromApiKey(apiKey);
        console.log('\x1b[32m%s\x1b[0m', `Preparing API ${type.toLowerCase()} execution...`);

        const validation = await validateSaltToken(apiKey, gatewayUrl);
        if (!validation.success) throw new Error(validation.message);
        console.log('\x1b[36m%s\x1b[0m', `✔ Token validated — User: ${validation.login}`);

        const userEmail = validation.login;

        const teamId = await getTeamId(gatewayUrl, apiKey);
        console.log('\x1b[36m%s\x1b[0m', `✔ Resolved team → ${teamId}`);

        const projectId = await getProjectId(gatewayUrl, apiKey, teamId, workspaceName);
        console.log('\x1b[36m%s\x1b[0m', `✔ Resolved workspace: "${workspaceName}" → ${projectId}`);

        const suiteId = await getSuiteId(gatewayUrl, apiKey, teamId, projectId, suiteName);
        console.log('\x1b[36m%s\x1b[0m', `✔ Located suite: "${suiteName}" → ${suiteId}`);

        let scriptId = null;
        if (scriptName && scriptName.trim() !== '') {
            scriptId = await getScriptId(gatewayUrl, apiKey, teamId, projectId, suiteId, scriptName);
            console.log('\x1b[36m%s\x1b[0m', `✔ Located script: "${scriptName}" → ${scriptId}`);
        }

        const envId = await getEnvironmentId(gatewayUrl, apiKey, teamId, projectId, envName);

        const runId = await executeTest(gatewayUrl, apiKey, teamId, projectId, suiteId, scriptId, envId, userEmail, type, threadCount, latencyThreshold, walletType);
        console.log('\x1b[32m%s\x1b[0m', `✔ Execution dispatched — Run ID: ${runId}`);

        await pollExecutionStatus(gatewayUrl, apiKey, teamId, runId);

    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', `✖ ${error.message}`);
        process.exit(1);
    }
}

/* -------------------------------------------------- */
/* ---------------- EXECUTION ----------------------- */
/* -------------------------------------------------- */

async function executeTest(gatewayUrl, apiKey, teamId, projectId, suiteId, scriptId, envId, userEmail, executionType, threadCount, latencyThreshold, virtualUserWalletType) {
    const body = {
        suiteIds: [suiteId],
        scriptIds: scriptId ? [scriptId] : null,
        userEmail: userEmail,
        projectId,
        isJenkins: false,
        pluginName: 'CLI',
        isScheduled: false,
        environmentId: envId || null,
        executionType,
        virtualUserWalletType
    };

    if (executionType === 'PERFORMANCE') {
        body.threadCount = threadCount ? parseInt(threadCount, 10) : 1;
        body.latencyThreshold = latencyThreshold ? parseInt(latencyThreshold, 10) : null;
    }

    const payload = JSON.stringify(body);

    const response = await httpRequest(gatewayUrl, {
        path: `${baseContext}/api/execute-test`,
        method: 'POST',
        headers: apiHeaders(apiKey, teamId, {
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
    SPAWNING_INSTANCE: 'Spawning instance...',
    INSTANCE_SPAWNED: 'Instance spawned',
    EXECUTION_NOT_STARTED: 'Waiting to start...',
    RUN_SCHEDULED: 'Run scheduled',
    RUN_INITIATED: 'Run initiated',
    P1: 'Processing (P1)',
    RUNNING: 'Running tests...',
    EXECUTING: 'Executing tests...',
    UPLOADING_RESULTS: 'Uploading results...',
    GENERATING_REPORTS: 'Generating report...',
    COMPLETED: 'Execution completed',
    CANCELLED: 'Execution cancelled',
    ABORTING: 'Execution aborting',
    ABORTED: 'Execution aborted',
    FAILED: 'Execution failed',
    ERROR_IN_RUN: 'Error in run'
};

const TERMINAL_FAILURE_STATUSES = new Set(['CANCELLED', 'ABORTING', 'ABORTED', 'FAILED', 'ERROR_IN_RUN']);

async function pollExecutionStatus(gatewayUrl, apiKey, teamId, runId) {
    let lastStatus = null;

    while (true) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL));

        const response = await httpRequest(gatewayUrl, {
            path: `${baseContext}/api/get-execution?runId=${encodeURIComponent(runId)}`,
            method: 'GET',
            headers: apiHeaders(apiKey, teamId)
        });

        if (response.statusCode !== 200) {
            console.log('\x1b[33m%s\x1b[0m', `Poll returned HTTP ${response.statusCode}, retrying...`);
            continue;
        }

        const run = JSON.parse(response.body.toString());

        if (!run || !run.id) {
            console.log('\x1b[33m%s\x1b[0m', `Run ${runId} not yet visible, retrying...`);
            continue;
        }

        const status = run.executionStatus;

        if (status !== lastStatus) {
            const label = STATUS_LABELS[status] || `Status: ${status}`;
            console.log('\x1b[33m%s\x1b[0m', `  ${label}`);
            lastStatus = status;
        }

        if (status === 'COMPLETED') {
            await showReport(gatewayUrl, apiKey, teamId, run);
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

async function showReport(gatewayUrl, apiKey, teamId, run) {
    const hasFailed = run.status === 'FAIL' || run.status === 'FAILED';
    const resultColor = hasFailed ? '\x1b[31m' : '\x1b[32m';
    console.log(`${resultColor}Result: ${run.status ?? (hasFailed ? 'FAIL' : 'PASS')}\x1b[0m`);

    if (run.passTestCase != null) console.log(`  Passed : ${run.passTestCase}`);
    if (run.failTestCase != null) console.log(`  Failed : ${run.failTestCase}`);
    if (run.totalTestCases != null) console.log(`  Total  : ${run.totalTestCases}`);

    // If the report is already ready, use it; otherwise poll until it is
    let htmlReportUrl = run.htmlReportStatus === 'COMPLETED'
        ? run.htmlReportUrl
        : await pollHtmlReport(gatewayUrl, apiKey, teamId, run.id.toString());

    if (htmlReportUrl) {
        const signedUrl = await getReportUrl(gatewayUrl, apiKey, teamId, htmlReportUrl);
        if (signedUrl) {
            process.stdout.write(`\nReport: \x1b]8;;${signedUrl}\x1b\\View Report\x1b]8;;\x1b\\\n`);
            console.log('(Ctrl+Click to open in browser)\n');
        }
    } else {
        console.log('\x1b[33m%s\x1b[0m', 'HTML report could not be retrieved.');
    }

    process.exit(hasFailed ? 1 : 0);
}

async function pollHtmlReport(gatewayUrl, apiKey, teamId, runId) {
    const HTML_REPORT_POLL_INTERVAL = 10000;
    const HTML_REPORT_TIMEOUT = 5 * 60 * 1000; // 5 minutes
    const started = Date.now();

    console.log('\x1b[33m%s\x1b[0m', 'Waiting for HTML report to be ready...');

    while (true) {
        if (Date.now() - started > HTML_REPORT_TIMEOUT) {
            console.log('\x1b[33m%s\x1b[0m', 'Timed out waiting for HTML report.');
            return null;
        }

        await new Promise(r => setTimeout(r, HTML_REPORT_POLL_INTERVAL));

        const response = await httpRequest(gatewayUrl, {
            path: `${baseContext}/api/get-execution?runId=${encodeURIComponent(runId)}`,
            method: 'GET',
            headers: apiHeaders(apiKey, teamId)
        });

        if (response.statusCode !== 200) continue;

        const run = JSON.parse(response.body.toString());

        if (run?.htmlReportStatus === 'COMPLETED' && run?.htmlReportUrl) {
            return run.htmlReportUrl;
        }
    }
}

async function getReportUrl(gatewayUrl, apiKey, teamId, resourcePath) {
    const response = await httpRequest(gatewayUrl, {
        path: `${baseContext}/api/get-reports-url?resourcePath=${encodeURIComponent(resourcePath)}`,
        method: 'GET',
        headers: apiHeaders(apiKey, teamId)
    });

    if (response.statusCode !== 200) {
        console.log('\x1b[33m%s\x1b[0m', `Could not fetch report URL — HTTP ${response.statusCode}`);
        return null;
    }

    const data = JSON.parse(response.body.toString());
    return data.signedUrl || null;
}

/* -------------------------------------------------- */
/* ---------------- SUPPORT APIS -------------------- */
/* -------------------------------------------------- */

async function validateSaltToken(apiKey, gatewayUrl) {
    const response = await httpRequest(gatewayUrl, {
        path: `/um-noauth/v1/api/validateAPIToken?apiToken=${apiKey}&scope=NODE_CLI`,
        method: 'GET'
    });

    if (response.statusCode !== 200) {
        return { success: false, message: `Token validation failed — HTTP ${response.statusCode}: ${response.body.toString()}` };
    }

    const data = JSON.parse(response.body.toString());
    return { success: true, login: data.login || null };
}

async function getTeamId(gatewayUrl, apiKey) {
    const response = await httpRequest(gatewayUrl, {
        path: '/um-noauth/v1/api/team-list',
        method: 'GET',
        headers: {
            'x-api-key': apiKey,
            'scope': 'NODE_CLI'
        }
    });

    if (response.statusCode !== 200) throw new Error(`Failed to fetch team list — HTTP ${response.statusCode}`);

    const teams = JSON.parse(response.body.toString());
    if (!teams?.length) throw new Error('No teams found for this API key.');
    return teams[0].uuid.trim();
}

async function getProjectId(gatewayUrl, apiKey, teamId, workspaceName) {
    const payload = JSON.stringify({
        type: null, projectName: null, page: 0, size: 0,
        normalUserId: null, collaborators: null
    });

    const response = await httpRequest(gatewayUrl, {
        path: `${baseContext}/api/project-details`,
        method: 'POST',
        headers: apiHeaders(apiKey, teamId, {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        })
    }, payload);

    if (response.statusCode !== 200) throw new Error(`Failed to fetch projects — HTTP ${response.statusCode}`);

    const projects = JSON.parse(response.body.toString());
    const project = projects.find(p => p.name?.toLowerCase() === workspaceName.toLowerCase());
    if (!project) throw new Error(`Workspace not found: "${workspaceName}"`);
    return project.id.trim();
}

async function getSuiteId(gatewayUrl, apiKey, teamId, projectId, suiteName) {
    const response = await httpRequest(gatewayUrl, {
        path: `${baseContext}/api/suites?projectId=${projectId}&isChaining=false`,
        method: 'GET',
        headers: apiHeaders(apiKey, teamId)
    });

    if (response.statusCode !== 200) throw new Error(`Failed to fetch suites — HTTP ${response.statusCode}`);

    const data = JSON.parse(response.body.toString());
    const suite = (data.content || []).find(s => s.name?.toLowerCase() === suiteName.toLowerCase());
    if (!suite) throw new Error(`Suite not found: "${suiteName}"`);
    return suite.id.trim();
}

async function getScriptId(gatewayUrl, apiKey, teamId, projectId, suiteId, scriptName) {
    const response = await httpRequest(gatewayUrl, {
        path: `${baseContext}/api/scripts?projectId=${projectId}&suiteId=${suiteId}&scriptType=SUITE&isChaining=false`,
        method: 'GET',
        headers: apiHeaders(apiKey, teamId)
    });

    if (response.statusCode !== 200) throw new Error(`Failed to fetch scripts — HTTP ${response.statusCode}`);

    const data = JSON.parse(response.body.toString());
    const scripts = Array.isArray(data) ? data : (data.content || []);
    const script = scripts.find(s => s.name?.toLowerCase() === scriptName.toLowerCase());
    if (!script) throw new Error(`Script not found: "${scriptName}"`);
    return script.id.trim();
}

async function getEnvironmentId(gatewayUrl, apiKey, teamId, projectId, envName) {
    const response = await httpRequest(gatewayUrl, {
        path: `${baseContext}/api/get-environments-by-projectId?projectId=${projectId}`,
        method: 'GET',
        headers: apiHeaders(apiKey, teamId)
    });

    if (response.statusCode !== 200) throw new Error(`Failed to fetch environments — HTTP ${response.statusCode}`);

    const envs = JSON.parse(response.body.toString());

    let selectedEnv;
    if (!envName || envName.trim() === '') {
        selectedEnv = envs.find(e =>
            e.name?.toLowerCase() === 'global default' ||
            e.isGlobal === true || e.isGlobal === 'true'
        ) || envs[0];
    } else {
        selectedEnv = envs.find(e => e.name?.toLowerCase() === envName.toLowerCase());
        if (!selectedEnv) throw new Error(`Environment not found: "${envName}"`);
    }

    if (!selectedEnv) throw new Error('No environment available for this project.');

    console.log('\x1b[36m%s\x1b[0m', `✔ Environment: "${selectedEnv.name}" → ${selectedEnv.id}`);
    return selectedEnv.id.trim();
}

module.exports = { trigger, validateSaltToken };