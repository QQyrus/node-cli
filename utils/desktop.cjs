'use strict';

const https = require('https');
const http = require('http');

const gatewayAuth = 'Bearer 90540897-748a-3ef2-b3a3-c6f8f42022da';
const baseContext = '/desktop-service/v1';
const POLL_INTERVAL = 30000;
const HARDCODED_PORT = 3000;
const SERVICE_STORE_ID = 'a2b452a5-d87c-11ed-a294-0241437b4ff9';
//const endpoints

/* -------------------------------------------------- */
/* ----------- ENVIRONMENT DERIVATION -------------- */
/* -------------------------------------------------- */

function deriveEndpointFromApiKey(apiKey, providedEndpoint) {
    if (providedEndpoint) {
        return providedEndpoint;
    }

    if (!apiKey) {
        throw new Error('API Key is required to derive endpoint.');
    }

    if (apiKey.includes('staging')) {
        return 'https://stg-gateway.qyrus.com:8243';
    }

    if (apiKey.includes('uat')) {
        return 'https://uat-gateway.qyrus.com:8243';
    }

    if (apiKey.includes('prod')) {
        return 'https://gateway.qyrus.com:8243';
    }

    throw new Error('Unable to determine environment from API key.');
}

/* -------------------------------------------------- */
/* ---------------- HTTP HELPER --------------------- */
/* -------------------------------------------------- */

function httpRequest(endpoint, options, payload = null) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(endpoint);
        const protocol = parsed.protocol === 'https:' ? https : http;

        const requestOptions = {
            hostname: parsed.hostname,
            port: parsed.port,
            ...options,
            rejectUnauthorized: false
        };

        const req = protocol.request(requestOptions, (res) => {
            let body = '';

            res.on('data', (chunk) => {
                body += chunk.toString();
            });

            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    body
                });
            });
        });

        req.on('error', reject);

        if (payload) {
            req.write(payload);
        }

        req.end();
    });
}

/* -------------------------------------------------- */
/* ---------------- CORE TRIGGER -------------------- */
/* -------------------------------------------------- */

async function trigger(
    endPoint,
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
        const endpoint = deriveEndpointFromApiKey(apiKey, endPoint);

        console.log('\x1b[32m%s\x1b[0m', 'Preparing desktop execution...');

        const validation = await validateSaltToken(apiKey, endpoint);
        if (!validation.success) {
            throw new Error(validation.message);
        }

        console.log('\x1b[36m%s\x1b[0m', `User: ${validation.login}`);

        const teamId = await getTeamUuid(endpoint, apiKey, teamName);
        const projectId = await getProjectUuid(endpoint, apiKey, teamId, projectName);
        const suiteId = await getTestSuiteUuid(endpoint, apiKey, projectId, testSuiteName, teamId);
        const envId = await getEnvironmentUuid(endpoint, apiKey, projectId, envName, teamId);
        const nodeId = await getNodeUuid(endpoint, apiKey, teamId, nodeName);
        const ipAddress = await getIpAddress(endpoint, apiKey, teamId, nodeId);

        const runId = await executeTest(
            endpoint,
            apiKey,
            projectId,
            suiteId,
            nodeName,
            nodeId,
            ipAddress,
            osType,
            onErrorContinue,
            parameterFileSource,
            emailId,
            envId,
            teamId
        );

        console.log('\x1b[32m%s\x1b[0m', `Execution started. Run ID: ${runId}`);

        await pollExecutionStatus(endpoint, apiKey, teamId, runId, testSuiteName);

    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', error.message);
        process.exit(1);
    }
}

/* -------------------------------------------------- */
/* ---------------- EXECUTION ----------------------- */
/* -------------------------------------------------- */

async function executeTest(
    endpoint,
    apiKey,
    projectId,
    suiteId,
    nodeName,
    nodeId,
    ipAddress,
    osType,
    onErrorContinue,
    parameterFileSource,
    emailId,
    envId,
    teamId
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
        isEmail: Boolean(emailId),
        variableEnvironmentId: envId || null,
        testLabRun: true,
        onErrorContinue: onErrorContinue === 'true' || onErrorContinue === true,
        parameterFileSource: parameterFileSource || 'DATATABLE'
    };

    const json = JSON.stringify(payload);

    const response = await httpRequest(endpoint, {
        path: `${baseContext}/api/execute-test`,
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            authorization: gatewayAuth,
            'Content-Type': 'application/json',
            'Team-Id': teamId,
            'Content-Length': Buffer.byteLength(json)
        }
    }, json);

    if (![200, 202].includes(response.statusCode)) {
        throw new Error(`Execution failed with status ${response.statusCode}`);
    }

    const data = JSON.parse(response.body);

    if (!data.runId) {
        throw new Error('Run ID missing in response');
    }

    return data.runId.toString();
}

/* -------------------------------------------------- */
/* ---------------- POLLING ------------------------- */
/* -------------------------------------------------- */

async function pollExecutionStatus(endpoint, apiKey, teamId, runId, suiteName) {
    while (true) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL));

        const response = await httpRequest(endpoint, {
            path: `${baseContext}/api/test-report-details?runId=${runId}`,
            method: 'GET',
            headers: {
                'x-api-key': apiKey,
                authorization: gatewayAuth,
                'Team-Id': teamId
            }
        });

        if (response.statusCode !== 200) continue;

        const data = JSON.parse(response.body);
        const status = data.executionStatus;

        if (status === 'COMPLETED') {
            await showReport(endpoint, apiKey, teamId, data, suiteName);
            return;
        }

        if (['CANCELLED', 'ABORTING', 'PAUSED'].includes(status)) {
            process.exit(1);
        }
    }
}

/* -------------------------------------------------- */
/* ---------------- REPORT -------------------------- */
/* -------------------------------------------------- */

async function showReport(endpoint, apiKey, teamId, data, suiteName) {
    console.log(`\nExecution Summary: ${suiteName}`);
    // console.log(`Total: ${data.total || 0}`);
    // console.log(`Passed: ${data.passCount || 0}`);
    // console.log(`Failed: ${data.failCount || 0}`);

    if (data.shortnedUrl) {
        const signedUrl = await getSignedUrl(endpoint, apiKey, teamId, data.shortnedUrl);
        if (signedUrl) {
            console.log('\nReport URL:');
            console.log(signedUrl);
        }
    }

    process.exit(data.failCount > 0 ? 1 : 0);
}

async function getSignedUrl(endpoint, apiKey, teamId, shortnedUrl) {
    const payload = JSON.stringify({ objectKeys: [shortnedUrl] });

    const response = await httpRequest(endpoint, {
        path: `${baseContext}/api/sign-url`,
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            authorization: gatewayAuth,
            'Content-Type': 'application/json',
            'Team-Id': teamId,
            'Content-Length': Buffer.byteLength(payload)
        }
    }, payload);

    if (response.statusCode !== 200) return null;

    const data = JSON.parse(response.body);
    return data?.signedUrls?.[0] || null;
}

/* -------------------------------------------------- */
/* ---------------- SUPPORT APIS -------------------- */
/* -------------------------------------------------- */

async function validateSaltToken(token, endpoint) {
    const rawToken = token.startsWith('Bearer ') ? token.substring(7) : token;

    const response = await httpRequest(endpoint, {
        path: `/usermgmt/v2/api/validateAPIToken?apiToken=${rawToken}`,
        method: 'GET',
        headers: { authorization: gatewayAuth }
    });

    if (response.statusCode !== 200) {
        return { success: false, message: response.body };
    }

    const data = JSON.parse(response.body);
    return { success: true, login: data.login || null };
}

async function getTeamUuid(endpoint, apiKey, teamName) {
    const response = await httpRequest(endpoint, {
        path: '/usermgmt/v2/api/teams-by-user-and-role',
        method: 'GET',
        headers: { 'x-api-key': apiKey, authorization: gatewayAuth }
    });

    const teams = JSON.parse(response.body);

    const team = teams.find(t =>
        t.teamName?.toLowerCase() === teamName.toLowerCase()
    );

    if (!team) throw new Error(`Team not found: ${teamName}`);
    return team.uuid.trim();
}

async function getProjectUuid(endpoint, apiKey, teamId, projectName) {
    const response = await httpRequest(endpoint, {
        path: `${baseContext}/api/projects-by-team-and-servicestore?teamId=${teamId}&serviceStoreId=${SERVICE_STORE_ID}`,
        method: 'GET',
        headers: { 'x-api-key': apiKey, authorization: gatewayAuth, 'Team-Id': teamId }
    });

    const projects = JSON.parse(response.body);

    const project = projects.find(p =>
        p.projectName?.toLowerCase() === projectName.toLowerCase()
    );

    if (!project) throw new Error(`Project not found: ${projectName}`);
    return project.uuid.trim();
}

async function getTestSuiteUuid(endpoint, apiKey, projectId, suiteName, teamId) {
    const response = await httpRequest(endpoint, {
        path: `${baseContext}/api/test-suites-for-test-lab?projectUUID=${projectId}`,
        method: 'GET',
        headers: { 'x-api-key': apiKey, authorization: gatewayAuth, 'Team-Id': teamId }
    });

    const suites = JSON.parse(response.body);

    const suite = suites.find(s =>
        s.testSuiteName?.toLowerCase() === suiteName.toLowerCase()
    );

    if (!suite) throw new Error(`Test Suite not found: ${suiteName}`);
    return suite.uuid.trim();
}

async function getEnvironmentUuid(endpoint, apiKey, projectId, envName, teamId) {
    if (!envName || envName.toLowerCase() === 'global') return null;

    const response = await httpRequest(endpoint, {
        path: `${baseContext}/api/variables-environment?projectUUID=${projectId}`,
        method: 'GET',
        headers: { 'x-api-key': apiKey, authorization: gatewayAuth, 'Team-Id': teamId }
    });

    const envs = JSON.parse(response.body);

    const env = envs.find(e =>
        e.environmentName?.toLowerCase() === envName.toLowerCase()
    );

    return env ? env.uuid.trim() : null;
}

async function getNodeUuid(endpoint, apiKey, teamId, nodeName) {
    const response = await httpRequest(endpoint, {
        path: `/node-registration-service/v1/api-public/get-nodeUuid?nodeName=${encodeURIComponent(nodeName)}`,
        method: 'GET',
        headers: { authorization: gatewayAuth }
    });

    if (response.statusCode !== 200) throw new Error('Node UUID not found');
    return response.body.trim();
}

async function getIpAddress(endpoint, apiKey, teamId, nodeId) {
    const response = await httpRequest(endpoint, {
        path: `/node-registration-service/v1/api-public/get-ip?uuid=${nodeId}`,
        method: 'GET',
        headers: { authorization: gatewayAuth }
    });

    if (response.statusCode !== 200) throw new Error('IP not found');
    return response.body.trim();
}

module.exports = {
    trigger,
    validateSaltToken
};
