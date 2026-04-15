'use strict';

const https = require('https');
const http = require('http');

/* -------------------------------------------------- */
/* ---------------- CONSTANTS ----------------------- */
/* -------------------------------------------------- */

const GATEWAY_URLS = {
    staging: 'https://stg-gateway.qyrus.com:8243',
    uat: 'https://uat-gateway.qyrus.com:8243',
    prod: 'https://gateway.qyrus.com:8243'
};

const baseContext = '/desktop-service-noauth/v1';
const POLL_INTERVAL = 30000;
const HARDCODED_PORT = 3000;

/* -------------------------------------------------- */
/* ----------- ENVIRONMENT DERIVATION -------------- */
/* -------------------------------------------------- */

function deriveGatewayUrlFromApiKey(apiKey) {
    if (!apiKey) {
        throw new Error('API key is required to derive gateway URL.');
    }

    if (apiKey.includes('staging')) return GATEWAY_URLS.staging;
    if (apiKey.includes('uat')) return GATEWAY_URLS.uat;
    if (apiKey.includes('qyrus')) return GATEWAY_URLS.prod;

    throw new Error('Unable to determine environment from API key. Key must contain "staging", "uat", or "prod".');
}

/* -------------------------------------------------- */
/* ---------------- HTTP HELPER --------------------- */
/* -------------------------------------------------- */

function httpRequest(gatewayUrl, options, payload = null) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(gatewayUrl);
        const protocol = parsed.protocol === 'https:' ? https : http;

        const requestOptions = {
            hostname: parsed.hostname,
            port: parsed.port,
            ...options
            // rejectUnauthorized: false  // Commented out - enable only if certificate issues occur
        };

        const req = protocol.request(requestOptions, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk.toString(); });
            res.on('end', () => { resolve({ statusCode: res.statusCode, body }); });
        });

        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

/* -------------------------------------------------- */
/* ---------------- CORE TRIGGER -------------------- */
/* -------------------------------------------------- */

async function trigger(
    apiKey,
    teamName,
    projectName,
    testSuiteName,
    nodeName,
    osType,
    onErrorContinue,
    parameterFileSource,
    emailId,
    envName
) {
    try {
        const gatewayUrl = deriveGatewayUrlFromApiKey(apiKey);

        console.log('\x1b[32m%s\x1b[0m', 'Preparing desktop execution...');

        const validation = await validateSaltToken(apiKey, gatewayUrl);
        if (!validation.success) throw new Error(validation.message);
        console.log('\x1b[36m%s\x1b[0m', `✔ Token validated`);

        const teamId = await getTeamUuid(gatewayUrl, apiKey, teamName);
        console.log('\x1b[36m%s\x1b[0m', `✔ Resolved team: "${teamName}"`);

        const projectId = await getProjectUuid(gatewayUrl, apiKey, teamId, projectName);
        console.log('\x1b[36m%s\x1b[0m', `✔ Resolved project: "${projectName}"`);

        const suiteId = await getTestSuiteUuid(gatewayUrl, apiKey, projectId, testSuiteName, teamId);
        console.log('\x1b[36m%s\x1b[0m', `✔ Located test suite: "${testSuiteName}"`);

        const envId = await getEnvironmentUuid(gatewayUrl, apiKey, projectId, envName, teamId);
        console.log('\x1b[36m%s\x1b[0m', envId ? `✔ Found environment: "${envName}"` : `✔ Environment: global (no variable env)`);

        // NEW: Single call to get both node UUID and IP
        const { nodeId, ipAddress } = await getNodeDetailsFromTeam(gatewayUrl, apiKey, teamId, nodeName);
        console.log('\x1b[36m%s\x1b[0m', `✔ Identified node: "${nodeName}" (UUID: ${nodeId})`);
        console.log('\x1b[36m%s\x1b[0m', `✔ Fetched node IP: ${ipAddress}`);

        const runId = await executeTest(
            gatewayUrl, apiKey, projectId, suiteId,
            nodeName, nodeId, ipAddress, osType,
            onErrorContinue, parameterFileSource, emailId, envId, teamId
        );

        console.log('\x1b[32m%s\x1b[0m', `✔ Execution Started — Run ID: ${runId}`);

        await pollExecutionStatus(gatewayUrl, apiKey, teamId, runId, testSuiteName);

    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', `✖ ${error.message}`);
        process.exit(1);
    }
}

/* -------------------------------------------------- */
/* ---------------- NEW NODE FUNCTION --------------- */
/* -------------------------------------------------- */

async function getNodeDetailsFromTeam(gatewayUrl, apiKey, teamId, nodeName) {
    const response = await httpRequest(gatewayUrl, {
        path: `/node-registration-service-noauth/v1/api/node-based-on-team?teamId=${teamId}`,
        method: 'GET',
        headers: {
            'x-api-key': apiKey,
            scope: 'NODE_CLI',
            'Team-Id': teamId
        }
    });

    if (response.statusCode !== 200) {
        throw new Error(`Failed to fetch nodes for team — HTTP ${response.statusCode}`);
    }

    let nodes;
    try {
        nodes = JSON.parse(response.body);
    } catch (e) {
        throw new Error('Invalid JSON response from node-based-on-team endpoint');
    }

    if (!Array.isArray(nodes)) {
        throw new Error('Unexpected response format from node-based-on-team endpoint');
    }

    const node = nodes.find(n =>
        n.nodeName?.toLowerCase() === nodeName.toLowerCase() &&
        n.isActive !== false
    );

    if (!node) {
        throw new Error(`Node not found or inactive in team: "${nodeName}"`);
    }

    if (!node.uuid) {
        throw new Error(`Node "${nodeName}" is missing UUID in response`);
    }

    return {
        nodeId: node.uuid.trim(),
        ipAddress: node.ipAddress?.trim() || null
    };
}

/* -------------------------------------------------- */
/* ---------------- EXECUTION ----------------------- */
/* -------------------------------------------------- */

async function executeTest(
    gatewayUrl, apiKey, projectId, suiteId,
    nodeName, nodeId, ipAddress, osType,
    onErrorContinue, parameterFileSource, emailId, envId, teamId
) {
    const multiRuns = [
        JSON.stringify({
            nodeName,
            ipAddress,
            portNumber: HARDCODED_PORT,
            osType: osType?.toUpperCase(),
            nodeUUID: nodeId
        })
    ];

    const payload = {
        testScript: null,
        testSuite: { uuid: suiteId },
        pluginName: 'AZURE',
        isJenkins: false,
        multiRuns,
        moduleRun: false,
        isDryRun: false,
        project: { uuid: projectId },
        databaseConfiguration: null,
        emailRecipients: emailId ? [emailId] : [],
        isEmail: false,
        variableEnvironmentId: envId || null,
        testLabRun: true,
        onErrorContinue: onErrorContinue === 'true' || onErrorContinue === true,
        parameterFileSource: parameterFileSource || 'DATATABLE'
    };

    const json = JSON.stringify(payload);

    const response = await httpRequest(gatewayUrl, {
        path: `${baseContext}/api/execute-test`,
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            scope: 'NODE_CLI',
            'Content-Type': 'application/json',
            'Team-Id': teamId,
            'Content-Length': Buffer.byteLength(json)
        }
    }, json);

    if (![200, 202].includes(response.statusCode)) {
        throw new Error(`Execution trigger failed — HTTP ${response.statusCode}: ${response.body}`);
    }

    const data = JSON.parse(response.body);
    if (!data.runId) throw new Error('Run ID absent in execution response.');

    return data.runId.toString();
}

/* -------------------------------------------------- */
/* ---------------- POLLING ------------------------- */
/* -------------------------------------------------- */


const STATUS_LABELS = {
    EXECUTION_NOT_STARTED: 'Waiting to start...',
    RUN_SCHEDULED: 'Run scheduled',
    RUN_INITIATED: 'Run initiated',
    Q1: 'Queued (Q1)', Q2: 'Queued (Q2)',
    Q3: 'Queued (Q3)', Q4: 'Queued (Q4)',
    P1: 'Processing (P1)', P2: 'Processing (P2)', P3: 'Processing (P3)',
    EXECUTING: 'Executing tests...',
    UPLOADING_RESULTS: 'Uploading results...',
    GENERATING_REPORT: 'Generating report...',
    COMPLETED: 'Execution completed',
    CANCELLED: 'Execution cancelled',
    ABORTING: 'Execution aborting',
    PAUSED: 'Execution paused'
};

async function pollExecutionStatus(gatewayUrl, apiKey, teamId, runId, suiteName) {
    let lastStatus = null;

    while (true) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL));

        const response = await httpRequest(gatewayUrl, {
            path: `${baseContext}/api/test-report-details?runId=${runId}`,
            method: 'GET',
            headers: {
                'x-api-key': apiKey,
                scope: 'NODE_CLI',
                'Team-Id': teamId
            }
        });

        if (response.statusCode !== 200) {
            console.log('\x1b[33m%s\x1b[0m', `⚠ Poll returned HTTP ${response.statusCode}, retrying...`);
            continue;
        }

        const data = JSON.parse(response.body);
        const status = data.executionStatus;

        if (status !== lastStatus) {
            const label = STATUS_LABELS[status] || `Status: ${status}`;
            console.log('\x1b[33m%s\x1b[0m', `  ${label}`);
            lastStatus = status;
        }

        if (status === 'COMPLETED') {
            await showReport(gatewayUrl, apiKey, teamId, data, suiteName);
            return;
        }

        if (['CANCELLED', 'ABORTING', 'PAUSED'].includes(status)) {
            console.error('\x1b[31m%s\x1b[0m', `✖ Run terminated with status: ${status}`);
            process.exit(1);
        }
    }
}

/* -------------------------------------------------- */
/* ---------------- REPORT -------------------------- */
/* -------------------------------------------------- */

async function showReport(gatewayUrl, apiKey, teamId, data, suiteName) {
    console.log('\n\x1b[32m%s\x1b[0m', `━━━ Execution Summary:  ━━━`);

    const hasFailed = data.status === 'FAIL' || data.failCount > 0;
    const resultColor = hasFailed ? '\x1b[31m' : '\x1b[32m';
    console.log(`${resultColor}Result: ${data.status ?? (hasFailed ? 'FAIL' : 'PASS')}\x1b[0m`);

    if (data.shortnedUrl) {
        const signedUrl = await getSignedUrl(gatewayUrl, apiKey, teamId, data.shortnedUrl);
        if (signedUrl) {
            process.stdout.write(`\nReport: \x1b]8;;${signedUrl}\x1b\\View Report\x1b]8;;\x1b\\\n`);
            console.log('(Ctrl+Click to open)\n');
        }
    }

    process.exit(hasFailed ? 1 : 0);
}

async function getSignedUrl(gatewayUrl, apiKey, teamId, shortnedUrl) {
    const payload = JSON.stringify({ objectKeys: [shortnedUrl] });

    const response = await httpRequest(gatewayUrl, {
        path: `${baseContext}/api/sign-url`,
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            scope: 'NODE_CLI',
            'Content-Type': 'application/json',
            'Team-Id': teamId,
            'Content-Length': Buffer.byteLength(payload)
        }
    }, payload);

    if (response.statusCode !== 200) {
        console.log('\x1b[33m%s\x1b[0m', '⚠ Could not fetch signed report URL.');
        return null;
    }

    const data = JSON.parse(response.body);
    const entry = data?.signedUrls?.[0];

    if (!entry || entry.error) {
        console.log('\x1b[33m%s\x1b[0m', '⚠ Signed URL entry missing or errored.');
        return null;
    }

    // queryParams is the CloudFront signed URL
    return entry.queryParams || null;
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
        return { success: false, message: `Token validation failed — HTTP ${response.statusCode}: ${response.body}` };
    }

    const data = JSON.parse(response.body);
    return { success: true, login: data.login || null };
}

async function getTeamUuid(gatewayUrl, apiKey, teamName) {
    const response = await httpRequest(gatewayUrl, {
        path: '/um-noauth/v1/api/teams-by-user-and-role',
        method: 'GET',
        headers: { 'x-api-key': apiKey, scope: 'NODE_CLI' }
    });

    const teams = JSON.parse(response.body);
    const team = teams.find(t => t.teamName?.toLowerCase() === teamName.toLowerCase());
    if (!team) throw new Error(`Team not found: "${teamName}"`);
    return team.uuid.trim();
}

async function getProjectUuid(gatewayUrl, apiKey, teamId, projectName) {
    const response = await httpRequest(gatewayUrl, {
        path: `${baseContext}/api/projects-by-team-and-servicestore?teamId=${teamId}`,
        method: 'GET',
        headers: { 'x-api-key': apiKey, scope: 'NODE_CLI', 'Team-Id': teamId }
    });

    const projects = JSON.parse(response.body);
    const project = projects.find(p => p.projectName?.toLowerCase() === projectName.toLowerCase());
    if (!project) throw new Error(`Project not found: "${projectName}"`);
    return project.uuid.trim();
}

async function getTestSuiteUuid(gatewayUrl, apiKey, projectId, suiteName, teamId) {
    const response = await httpRequest(gatewayUrl, {
        path: `${baseContext}/api/test-suites-for-test-lab?projectUUID=${projectId}`,
        method: 'GET',
        headers: { 'x-api-key': apiKey, scope: 'NODE_CLI', 'Team-Id': teamId }
    });

    const suites = JSON.parse(response.body);
    const suite = suites.find(s => s.testSuiteName?.toLowerCase() === suiteName.toLowerCase());
    if (!suite) throw new Error(`Test suite not found: "${suiteName}"`);
    return suite.uuid.trim();
}

async function getEnvironmentUuid(gatewayUrl, apiKey, projectId, envName, teamId) {
    if (!envName || envName.toLowerCase() === 'global') return null;

    const response = await httpRequest(gatewayUrl, {
        path: `${baseContext}/api/variables-environment?projectUUID=${projectId}`,
        method: 'GET',
        headers: { 'x-api-key': apiKey, scope: 'NODE_CLI', 'Team-Id': teamId }
    });

    const envs = JSON.parse(response.body);
    const env = envs.find(e => e.environmentName?.toLowerCase() === envName.toLowerCase());
    return env ? env.uuid.trim() : null;
}

module.exports = {
    trigger,
    validateSaltToken
};