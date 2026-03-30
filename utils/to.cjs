var url = require('url');
var https = require('https');
var http = require('http');
var delay = require('q');

let count1 = 0;
let oldSet = new Set();
let newSet = new Set();
let array3 = [];
const toContext = '/orchestration-noauth/v1';
const umContext = '/um-noauth/v1';

const trigger = function (apiKey, teamName,
    deepLinkId, isFolder) {

    // Input validation
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
        console.log('\x1b[31m%s\x1b[0m', "Error: apiKey is required and cannot be empty.");
        process.exit(1);
    }
    if (!teamName || typeof teamName !== 'string' || teamName.trim() === '') {
        console.log('\x1b[31m%s\x1b[0m', "Error: teamName is required and cannot be empty.");
        process.exit(1);
    }
    if (!deepLinkId || typeof deepLinkId !== 'string' || deepLinkId.trim() === '') {
        console.log('\x1b[31m%s\x1b[0m', "Error: deepLinkId is required and cannot be empty.");
        process.exit(1);
    }

    // isFolder is passed as a string from Commander.js
    if (isFolder === undefined || isFolder === null ||
        (typeof isFolder === 'string' && !['true', 'false'].includes(isFolder.trim().toLowerCase())) ||
        typeof isFolder === 'number') {
        console.log('\x1b[31m%s\x1b[0m', "Error: isFolder must be either 'true' or 'false' (case-insensitive).");
        process.exit(1);
    }

    let endpoint = '';
    const env = getEnvName(apiKey);
    if (env == 'staging') {
        endpoint = 'https://stg-gateway.qyrus.com:8243';
    }
    else if (env == 'qyrus') {
        endpoint = 'https://gateway.qyrus.com';
    }
    else {
        endpoint = 'https://' + env + '-gateway.qyrus.com';
    }

    console.log('\x1b[32m%s\x1b[0m', "Getting your environment ready, your test will start running soon.");

    // Validate the API key using validateSaltToken
    validateSaltToken(apiKey, endpoint).then(function (validationResult) {
        if (validationResult.success) {
            console.log('\x1b[32m%s\x1b[0m', "Credentials Validated Successfully");
            const login = validationResult.login;
            const organizationName = validationResult.details.organization_name || 'org';

            // Fetch teamId using team name before proceeding to execution
            getTeamsInformation(endpoint, apiKey).then(function (responseBody) {
                const teamsArray = JSON.parse(responseBody);
                let teamId = null;
                for (let i = 0; i < teamsArray.length; i++) {
                    if (teamsArray[i].teamName && teamsArray[i].teamName.toLowerCase() === teamName.toLowerCase()) {
                        teamId = teamsArray[i].uuid.trim();
                        break;
                    }
                }

                if (!teamId) {
                    throw new Error("Team not found: " + teamName);
                }

                console.log('\x1b[32m%s\x1b[0m', "Team ID resolved: " + teamId);

                // Check if the execution target is a folder or a workflow
                // isFolder comes as a string from CLI, so compare against 'true'
                if (isFolder === true || String(isFolder).toLowerCase() === 'true') {
                    executeFolder(endpoint, login, organizationName, apiKey, teamId, deepLinkId);
                } else {
                    executeWorkflow(endpoint, login, organizationName, apiKey, teamId, deepLinkId);
                }
            }).catch(function (error) {
                console.log('\x1b[31m%s\x1b[0m', "Error resolving team: " + error.message);
                process.exit(1);
            });
        } else {
            // Parse error message from validation response
            try {
                const errorJson = JSON.parse(validationResult.message.replace('Invalid API Token: ', ''));
                console.log('\x1b[31m%s\x1b[0m', "❌ " + (errorJson.message || validationResult.message));
            } catch (e) {
                console.log('\x1b[31m%s\x1b[0m', "❌ " + validationResult.message);
            }
            process.exit(1);
        }
    }).catch(function (error) {
        console.log('\x1b[31m%s\x1b[0m', "Validation Error: " + error.message);
        process.exit(1);
    });
};

// Execute folder block - handles folder-level execution
function executeFolder(endpoint, login, organizationName, apiKey, teamId, deepLinkId) {
    console.log('\x1b[36m%s\x1b[0m', "Entering Folder Execution block...");

    const parsedUrl = url.parse(endpoint);
    const hostName = parsedUrl.hostname;
    const port = parsedUrl.port;
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
        host: hostName,
        port: port,
        path: toContext + '/api/execute-folder',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // 'Authorization': gatewayAuth,
            'Team-Id': teamId,
            'scope': 'NODE_CLI',
            'x-api-key': apiKey
        }
    };

    const requestBody = {
        isScheduled: false,
        // pluginName: 'NODE_CLI',
        pluginName: 'AZURE',
        userEmail: login,
        folderDeepLinkIds: deepLinkId
    };

    const req = protocol.request(options, function (res) {
        let body = '';

        res.on('data', chunk => {
            body += chunk.toString();
        });

        res.on('end', () => {
            if (res.statusCode === 200) {
                console.log('\x1b[32m%s\x1b[0m', "Folder execution triggered successfully!");

                try {
                    const response = JSON.parse(body);
                    console.log('\x1b[36m%s\x1b[0m', "Workflow Count: " + response.workFlowCount);
                    console.log('\x1b[36m%s\x1b[0m', "Folder Execution UUID: " + response.folderExecutionUuid);

                    // Start polling for folder execution status
                    checkFolderExecutionStatus(endpoint, apiKey, teamId, response.folderExecutionUuid, response.workFlowCount);
                } catch (parseError) {
                    console.log('\x1b[31m%s\x1b[0m', "Error parsing response: " + parseError.message);
                    console.log('Raw response:', body);
                    process.exit(1);
                }
            } else {
                // Parse error message from response
                try {
                    const errorResponse = JSON.parse(body);
                    console.log('\x1b[31m%s\x1b[0m', "❌ " + (errorResponse.errorMessage || 'Failed to execute folder.'));
                } catch (e) {
                    console.log('\x1b[31m%s\x1b[0m', "❌ Failed to execute folder. Status code: " + res.statusCode);
                }
                process.exit(1);
            }
        });
    });

    req.on('error', function (err) {
        console.error('\x1b[31m%s\x1b[0m', "❌ Request error: " + err.message);
        process.exit(1);
    });

    req.write(JSON.stringify(requestBody));
    req.end();
}

// Poll folder execution status
function checkFolderExecutionStatus(endpoint, apiKey, teamId, folderExecutionUuid, workFlowCount) {

    const parsedUrl = url.parse(endpoint);
    const hostName = parsedUrl.hostname;
    const port = parsedUrl.port;
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
        host: hostName,
        port: port,
        path: toContext + '/api/folder-execution-status?folderExecutionUuid=' + encodeURIComponent(folderExecutionUuid),
        method: 'GET',
        headers: {
            // 'Authorization': gatewayAuth,
            'Team-Id': teamId,
            'scope': 'NODE_CLI',
            'x-api-key': apiKey
        }
    };

    const req = protocol.request(options, function (res) {
        let body = '';

        res.on('data', chunk => {
            body += chunk.toString();
        });

        res.on('end', () => {
            if (res.statusCode === 200) {
                // Status comes as a plain string (e.g. "RUNNING", "PASS", "FAIL")
                const executionStatus = body.trim().replace(/"/g, '');
                console.log('\x1b[36m%s\x1b[0m', "Folder Execution Status: " + executionStatus);

                // if execution status is "ERROR" make it "ERROR IN RUN"
                if (executionStatus === 'ERROR') {
                    executionStatus = 'ERROR IN RUN';
                }

                if (executionStatus === 'PASS') {
                    console.log('\x1b[32m%s\x1b[0m', "✅ Folder execution completed successfully!");
                    console.log('\x1b[36m%s\x1b[0m', "Fetching report download URLs...");
                    downloadReports(endpoint, apiKey, teamId, null, folderExecutionUuid, workFlowCount);
                } else if (executionStatus === 'FAIL') {
                    console.log('\x1b[31m%s\x1b[0m', "❌ Folder execution failed.");
                    console.log('\x1b[36m%s\x1b[0m', "Fetching report download URLs...");
                    downloadReports(endpoint, apiKey, teamId, null, folderExecutionUuid, workFlowCount);
                } else if (executionStatus === 'ERROR IN RUN' || executionStatus === 'ABORTED') {
                    console.log('\x1b[31m%s\x1b[0m', "❌ Execution ended with status: " + executionStatus);
                    process.exit(1);
                } else {
                    // Still running, poll again after delay
                    console.log('\x1b[33m%s\x1b[0m', "Execution still in progress, checking again in 30 seconds...");
                    setTimeout(function () {
                        checkFolderExecutionStatus(endpoint, apiKey, teamId, folderExecutionUuid, workFlowCount);
                    }, 30000);
                }
            } else {
                console.log('\x1b[31m%s\x1b[0m', "Failed to get folder execution status. Status code: " + res.statusCode);
                console.log('Response:', body);
            }
        });
    });

    req.on('error', function (err) {
        console.error('\x1b[31m%s\x1b[0m', "❌ Status check error: " + err.message);
    });

    req.end();
}

// Execute workflow block - handles individual workflow execution
function executeWorkflow(endpoint, login, organizationName, apiKey, teamId, deepLinkId) {
    console.log('\x1b[36m%s\x1b[0m', "Entering Workflow Execution block...");

    const parsedUrl = url.parse(endpoint);
    const hostName = parsedUrl.hostname;
    const port = parsedUrl.port;
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
        host: hostName,
        port: port,
        path: toContext + '/api/execute-workflow',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // 'Authorization': gatewayAuth,
            'Team-Id': teamId,
            'scope': 'NODE_CLI',
            'x-api-key': apiKey
        }
    };

    const requestBody = {
        isScheduled: false,
        pluginName: 'AZURE',
        userEmail: login,
        workFlowDeepLinkIds: deepLinkId
    };

    const req = protocol.request(options, function (res) {
        let body = '';

        res.on('data', chunk => {
            body += chunk.toString();
        });

        res.on('end', () => {
            if (res.statusCode === 200) {
                console.log('\x1b[32m%s\x1b[0m', "Workflow execution triggered successfully!");

                try {
                    const response = JSON.parse(body);
                    console.log('\x1b[36m%s\x1b[0m', "Test Execution UUID: " + response.testExecutionUuid);
                    console.log('\x1b[32m%s\x1b[0m', response.successMessage);

                    // Start polling for workflow execution status
                    checkWorkflowExecutionStatus(endpoint, apiKey, teamId, response.testExecutionUuid);
                } catch (parseError) {
                    console.log('\x1b[31m%s\x1b[0m', "Error parsing response: " + parseError.message);
                    console.log('Raw response:', body);
                    process.exit(1);
                }
            } else {
                // Parse error message from response
                try {
                    const errorResponse = JSON.parse(body);
                    console.log('\x1b[31m%s\x1b[0m', "❌ " + (errorResponse.errorMessage || 'Failed to execute workflow.'));
                } catch (e) {
                    console.log('\x1b[31m%s\x1b[0m', "❌ Failed to execute workflow. Status code: " + res.statusCode);
                }
                process.exit(1);
            }
        });
    });

    req.on('error', function (err) {
        console.error('\x1b[31m%s\x1b[0m', "❌ Request error: " + err.message);
        process.exit(1);
    });

    req.write(JSON.stringify(requestBody));
    req.end();
}

// Poll workflow execution status
function checkWorkflowExecutionStatus(endpoint, apiKey, teamId, testExecutionUuid) {

    const parsedUrl = url.parse(endpoint);
    const hostName = parsedUrl.hostname;
    const port = parsedUrl.port;
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
        host: hostName,
        port: port,
        path: toContext + '/api/get-workflow-execution-details?testExecutionUUID=' + encodeURIComponent(testExecutionUuid),
        method: 'GET',
        headers: {
            // 'Authorization': gatewayAuth,
            'Team-Id': teamId,
            'scope': 'NODE_CLI',
            'x-api-key': apiKey
        }
    };

    const req = protocol.request(options, function (res) {
        let body = '';

        res.on('data', chunk => {
            body += chunk.toString();
        });

        res.on('end', () => {
            // console.log(`📡 Status check response: ${res.statusCode}`);
            if (res.statusCode === 200) {
                try {
                    const statusResponse = JSON.parse(body);
                    const executionStatus = statusResponse.executionStatus;
                    const executionTime = statusResponse.executionTime;

                    console.log('\x1b[36m%s\x1b[0m', "Execution Status: " + executionStatus);
                    // console.log('\x1b[36m%s\x1b[0m', "Execution Time: " + executionTime);

                    // if execution status is "ERROR" make it "ERROR IN RUN"
                    if (executionStatus === 'ERROR') {
                        executionStatus = 'ERROR IN RUN';
                    }

                    if (executionStatus === 'PASS') {
                        console.log('\x1b[36m%s\x1b[0m', "Execution Time: " + executionTime);
                        console.log('\x1b[32m%s\x1b[0m', "✅ Workflow execution completed successfully!");
                        console.log('\x1b[36m%s\x1b[0m', "Execution Date: " + statusResponse.executionDate);
                        // console.log('\x1b[36m%s\x1b[0m', "User: " + statusResponse.userName);
                        // Download reports on completion
                        console.log('\x1b[36m%s\x1b[0m', "Fetching report download URLs...");
                        downloadReports(endpoint, apiKey, teamId, testExecutionUuid, null);
                    } else if (executionStatus === 'FAIL') {
                        console.log('\x1b[36m%s\x1b[0m', "Execution Time: " + executionTime);
                        console.log('\x1b[31m%s\x1b[0m', "❌ Workflow execution failed.");
                        // Download reports even on failure
                        console.log('\x1b[36m%s\x1b[0m', "Fetching report download URLs...");
                        downloadReports(endpoint, apiKey, teamId, testExecutionUuid, null);
                    } else if (executionStatus === 'ERROR IN RUN' || executionStatus === 'ABORTED') {
                        // For these negative statuses report will not be generated
                        console.log('\x1b[31m%s\x1b[0m', "❌ Execution ended with status: " + executionStatus);
                        process.exit(1);
                    } else {
                        // Still running, poll again after delay
                        console.log('\x1b[33m%s\x1b[0m', "Execution still in progress, checking again in 30 seconds...");
                        setTimeout(function () {
                            checkWorkflowExecutionStatus(endpoint, apiKey, teamId, testExecutionUuid);
                        }, 30000);
                    }
                } catch (parseError) {
                    console.log('\x1b[31m%s\x1b[0m', "Error parsing status response: " + parseError.message);
                    console.log('Raw response:', body);
                }
            } else {
                console.log('\x1b[31m%s\x1b[0m', "Failed to get workflow execution status. Status code: " + res.statusCode);
                console.log('Response:', body);
            }
        });
    });

    req.on('error', function (err) {
        console.error('\x1b[31m%s\x1b[0m', "❌ Status check error: " + err.message);
    });

    req.end();
}

// Download HTML reports for workflow or folder execution
function downloadReports(endpoint, apiKey, teamId, testExecutionUuid, folderExecutionUuid, expectedCount) {
    // console.log('\x1b[36m%s\x1b[0m', "Fetching report download URLs...");

    const parsedUrl = url.parse(endpoint);
    const hostName = parsedUrl.hostname;
    const port = parsedUrl.port;
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    let queryParam = '';
    if (testExecutionUuid) {
        queryParam = 'testExecutionUuid=' + encodeURIComponent(testExecutionUuid);
    } else if (folderExecutionUuid) {
        queryParam = 'folderExecutionUuid=' + encodeURIComponent(folderExecutionUuid);
    }

    const options = {
        host: hostName,
        port: port,
        path: toContext + '/api/download-html-reports-plugin?' + queryParam,
        method: 'GET',
        headers: {
            // 'Authorization': gatewayAuth,
            'Team-Id': teamId,
            'scope': 'NODE_CLI',
            'x-api-key': apiKey
        }
    };

    const req = protocol.request(options, function (res) {
        let body = '';

        res.on('data', chunk => {
            body += chunk.toString();
        });

        res.on('end', () => {
            if (res.statusCode === 200) {
                try {
                    // If body is empty, report is not yet generated - retry
                    if (!body || body.trim() === '') {
                        console.log('\x1b[33m%s\x1b[0m', "Reports not yet generated, retrying in 30 seconds...");
                        setTimeout(function () {
                            downloadReports(endpoint, apiKey, teamId, testExecutionUuid, folderExecutionUuid);
                        }, 30000);
                        return;
                    }

                    const reports = JSON.parse(body);

                    // If parsed array is empty or not all reports are ready yet, retry
                    if (!reports || reports.length === 0 || (expectedCount && reports.length < expectedCount)) {
                        console.log('\x1b[33m%s\x1b[0m', "Reports not yet generated (" + reports.length + "/" + (expectedCount || '?') + "), retrying in 30 seconds...");
                        setTimeout(function () {
                            downloadReports(endpoint, apiKey, teamId, testExecutionUuid, folderExecutionUuid, expectedCount);
                        }, 30000);
                        return;
                    }

                    console.log('\x1b[32m%s\x1b[0m', "\n📋 Download Reports:");
                    for (let i = 0; i < reports.length; i++) {
                        console.log('\x1b[36m%s\x1b[0m', "\n  Workflow: " + reports[i].workflowName);
                        // console.log('\x1b[36m%s\x1b[0m', "  Test Execution UUID: " + reports[i].testExecutionUuid);
                        console.log('\x1b[32m%s\x1b[0m', "  📥 Report URL: " + reports[i].ReportsUrl);
                    }
                } catch (parseError) {
                    console.log('\x1b[31m%s\x1b[0m', "Error parsing reports response: " + parseError.message);
                    console.log('Raw response:', body);
                }
            } else {
                console.log('\x1b[31m%s\x1b[0m', "Failed to get reports. Status code: " + res.statusCode);
                console.log('Response:', body);
            }
        });
    });

    req.on('error', function (err) {
        console.error('\x1b[31m%s\x1b[0m', "❌ Report download error: " + err.message);
    });

    req.end();
}

// Fetches teams information from the gateway
const getTeamsInformation = function (gatewayUrl, customAuth) {
    return new Promise((resolve, reject) => {
        try {
            const parsedUrl = url.parse(gatewayUrl);
            const hostName = parsedUrl.hostname;
            const port = parsedUrl.port;
            const protocol = parsedUrl.protocol === 'https:' ? https : http;

            const options = {
                host: hostName,
                port: port,
                path: umContext + '/api/teams-by-user-and-role',
                method: 'GET',
                headers: {
                    'x-api-key': customAuth,
                    'scope': 'NODE_CLI'
                }
            };

            const req = protocol.request(options, function (res) {
                let bodyString = '';

                res.on('data', chunk => {
                    bodyString += chunk.toString();
                });

                res.on('end', () => {
                    if (res.statusCode === 200) {
                        resolve(bodyString);
                    } else {
                        console.log('\x1b[31m%s\x1b[0m', "Failed to get teams information. Status code: " + res.statusCode);
                        reject(new Error("Request failed with status code: " + res.statusCode));
                    }
                });
            });

            req.on('error', function (err) {
                console.log('\x1b[31m%s\x1b[0m', "Error getting teams information: " + err.message);
                reject(err);
            });

            req.end();
        } catch (error) {
            console.log('\x1b[31m%s\x1b[0m', "Error in getTeamsInformation: " + error.message);
            reject(error);
        }
    });
};

function getEnvName(apiKey) {
    if (!apiKey || typeof apiKey !== "string") return null;

    const parts = apiKey.split("_");

    // expecting: ["sk", "envName", "uuidToken"]
    if (parts.length < 3) return null;

    return parts[1];
}

const validateSaltToken = function (token, gatewayUrl) {
    return new Promise((resolve, reject) => {
        try {
            // Remove "Bearer " prefix if present for API token call
            // Though usually Salt tokens are raw, handle both cases
            const rawToken = token.startsWith("Bearer ") ? token.substring(7) : token;

            // Parse the gateway URL to extract host and port
            const parsedUrl = url.parse(gatewayUrl);
            const hostName = parsedUrl.hostname;
            const port = parsedUrl.port;
            const protocol = parsedUrl.protocol === 'https:' ? https : http;

            // Construct request options
            const options = {
                host: hostName,
                port: port,
                path: umContext + `/api/validateAPIToken?apiToken=${rawToken}&scope=NODE_CLI`,
                method: 'GET',
                headers: {
                    'accept': 'application/json'
                }
            };

            // Make the HTTP request
            const req = protocol.request(options, function (res) {
                const responseCode = res.statusCode;
                let bodyString = '';

                res.on('data', chunk => {
                    bodyString += chunk.toString();
                });

                res.on('end', () => {

                    if (responseCode === 200) {
                        try {
                            const json = JSON.parse(bodyString);
                            const login = json.login || null;

                            // Capture other details
                            const details = {};
                            if (json.organizationName) {
                                details.organization_name = json.organizationName;
                            }
                            if (json.role) {
                                details.role = json.role;
                            }

                            // Return success result
                            resolve({
                                success: true,
                                login: login,
                                details: details
                            });
                        } catch (parseError) {
                            reject({
                                success: false,
                                message: "Error parsing response: " + parseError.message
                            });
                        }
                    } else {
                        resolve({
                            success: false,
                            message: "Invalid API Token: " + bodyString
                        });
                    }
                });
            });

            req.on('error', function (err) {
                console.log("Error validating API token via UserMgmt service: " + err.message);
                reject({
                    success: false,
                    message: "Service error during validation: " + err.message
                });
            });

            req.end();

        } catch (error) {
            console.log("Error in validateSaltToken: " + error.message);
            reject({
                success: false,
                message: "Unexpected error: " + error.message
            });
        }
    });
}

module.exports = { trigger };
