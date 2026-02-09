var url = require('url');
var https = require('https');
var http = require('http');
var delay = require('q');
const gatewayAuth = 'Bearer 90540897-748a-3ef2-b3a3-c6f8f42022da';

let count1 = 0;
let oldSet = new Set();
let newSet = new Set();
let array3 =[];
let baseContext = '/cli-adapter-web-repository/v1';

const trigger = function(endpoint, apiKey, teamName,
    projectName, testSuiteName,  operatingSystem, 
    browserName, onErrorContinue,parameterFileSource, emailId, envName) {
    
    console.log('\x1b[32m%s\x1b[0m',"Getting your environment ready, your test will start running soon.");
//  validating the api key
//  call the validate salt token function
    
    // Validate the API key using validateSaltToken
    validateSaltToken(apiKey, endpoint).then(function(result) {
        if (result.success) {
            console.log('\x1b[32m%s\x1b[0m', "Credentials Validated Successfully");
            continueExecution();
        } else {
            console.log('\x1b[31m%s\x1b[0m', "Error: " + result.message);
            process.exit(1);
        }
    }).catch(function(error) {
        console.log('\x1b[31m%s\x1b[0m', "Validation Error: " + error.message);
        process.exit(1);
    });
    
    function continueExecution() {
        var hostName = url.parse(endpoint).hostname;
        var port = url.parse(endpoint).port;
        
        // Get user login from validated token
        validateSaltToken(apiKey, endpoint).then(function(validationResult) {
            const userName = validationResult.login;
            
            console.log('\x1b[36m%s\x1b[0m', "Starting test execution workflow...");
            console.log('\x1b[36m%s\x1b[0m', "User: " + userName);
            
            // Step 1: Get all teams and find the team ID FIRST
            getTeamUuid(endpoint, apiKey).then(function(teamsArray) {
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
                
                // console.log('\x1b[36m%s\x1b[0m', "Team ID: " + teamId);
                
                // Step 2: Get Organization Name (now with Team-Id header)
                return getOrganizationInfo(endpoint, apiKey, teamName, teamId).then(function(organizationName) {
                    // console.log('\x1b[36m%s\x1b[0m', "Organization: " + JSON.stringify(organizationName));
                    
                    // Step 3: Get Project UUID (with Team-Id header)
                    return getProjectUuid(endpoint, apiKey, teamId, teamName, projectName).then(function(projectId) {
                        // console.log('\x1b[36m%s\x1b[0m', "Project ID: " + projectId);
                        
                        // Step 4: Get Test Suite UUID (with Team-Id header)
                        return getTestSuiteUuid(endpoint, apiKey, projectId, testSuiteName, teamId).then(function(suiteId) {
                            // console.log('\x1b[36m%s\x1b[0m', "Test Suite ID: " + suiteId);
                            
                            // Step 5: Get Environment UUID (with Team-Id header)
                            return getEnvironmentUuid(endpoint, apiKey, projectId, envName || "Global", teamId).then(function(envId) {
                                // console.log('\x1b[36m%s\x1b[0m', "Environment ID: " + envId);
                                
                                // Step 6: Execute Test (with Team-Id header)
                                return executeTestForWebRepoAutomation(
                                    endpoint,
                                    organizationName,
                                    apiKey,
                                    suiteId,
                                    projectId,
                                    browserName,
                                    operatingSystem,
                                    projectName,
                                    parameterFileSource,
                                    onErrorContinue,
                                    envId,
                                    teamId,
                                    userName
                                ).then(function(result) {
                                    const executionRunId = result.runId;
                                    const token = result.token;
                                    
                                    console.log('\x1b[32m%s\x1b[0m', "Test execution initiated successfully!");
                                    console.log('\x1b[36m%s\x1b[0m', "Run ID: " + executionRunId);
                                    
                                    // Build the response object for status checking
                                    const jsonObject = { 
                                        "runId": executionRunId, 
                                        "token": token 
                                    };
                                    const finalbody = JSON.stringify(jsonObject);
                                    
                                    // Continue with existing status checking logic
                                    proceedWithStatusCheck(finalbody, teamId);
                                });
                            });
                        });
                    });
                });
            }).catch(function(error) {
                console.log('\x1b[31m%s\x1b[0m', "Error in execution workflow: " + error.message);
                console.error(error.stack);
                process.exit(1);
            });
        }).catch(function(error) {
            console.log('\x1b[31m%s\x1b[0m', "Error getting user login: " + error.message);
            process.exit(1);
        });
        
        function proceedWithStatusCheck(finalbody, teamId) {
        var status = "RUN INITIATED" ;
    var statusResponse;

    // construct URL details to check execution status 
    var execStatus = {
        host: hostName,
        port: port,
        // path: baseContext+'/checkExecutionStatus',
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        },
        rejectUnauthorized: false
    };

    // construct URL details to check final exec result 
    var finalResult = {
        host: hostName,
        port: port,
        path: baseContext+'/checkExecutionResult?emailId='+emailId,
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        },
        rejectUnauthorized: false
    };

    //get script result status 
    var scriptResultStatus = {
        host: hostName,  
        port: port,
        path: baseContext+'/checkScriptExecutionStatus',
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        },
        rejectUnauthorized: false
    };

    console.log('Triggered the TestSuite ', testSuiteName,' Successfully!!');
    console.log('Execution of TestSuite ', testSuiteName,' is in Progress...');
    console.log('\x1b[36m%s\x1b[0m', 'Checking execution status...');
    checkExecStatus(execStatus,finalbody,testSuiteName,
        finalResult,status,statusResponse,
        scriptResultStatus,emailId, teamId);
        }
    }
} 

function checkExecStatus (execStatus,triggerResponse,testSuite,
    finalResult,status,statusResponse,
    scriptResultStatus,emailId, teamId) {
    //http request to check the status of test
    // console.log('\x1b[36m%s\x1b[0m', 'Checking execution status of TestSuite ' + testSuite + ' ...');
    
    // Parse the trigger response to get runId and token
    let parsedResponse;
    try {
        parsedResponse = JSON.parse(triggerResponse);
    } catch (parseError) {
        console.log('\x1b[31m%s\x1b[0m', "Error parsing trigger response: " + parseError.message);
        return;
    }
    
    let runId = parsedResponse.runId;
    const token = parsedResponse.token;
    
    // Clean up runId if it contains colons (from Java code)
    if (runId && runId.includes(':')) {
        runId = runId.split(':')[1].replace('}', '');
        runId = runId.substring(1, runId.length - 1);
    }
    
    // Update execStatus with proper query parameter and headers
    execStatus.path = '/webautomation-repo/v1/api/test-report-details?runId=' + runId;
    execStatus.headers = {
        'x-api-key': token,
        'authorization': gatewayAuth,
        'Content-Type': 'application/json',
        'Team-Id': teamId
    };
    
    var reqPost = https.request(execStatus, function(res) {
        /* If the response from the request is not 200 then fail the pipeline */
       
        if(res.statusCode!=200){
            console.log('\x1b[31m%s\x1b[0m', "Failed to check execution status. Status code: " + res.statusCode);
            return;
        }
        let body = '';
        res.on('data', chunk => {
            body += chunk.toString(); // convert Buffer to string
        });

        // console.log("Response Body: " + body);
        
        res.on('end', () => {
            try {
                const responseJson = JSON.parse(body);
                // console.log("Response Body: " + responseJson);
                const executionStatus = responseJson.executionStatus || body.trim();
                statusResponse = checkRunStatus(executionStatus);

                if (statusResponse == 'RUNNING' || statusResponse == 'ALLOCATING BROWSER' || statusResponse == 'WAITING FOR BROWSER') {
                    checkScriptStatus(scriptResultStatus, runId, token, teamId);
                }
                
                if(status !== statusResponse){
                    status = statusResponse;
                    console.log('TestSuite Run Status: '+ status);
                }
                
                if(executionStatus === "COMPLETED" || statusResponse === "COMPLETED"){
                    checkScriptStatus(scriptResultStatus, runId, token, teamId);
                    setTimeout(() => {
                        checkFinalStatus(finalResult, triggerResponse, testSuite, emailId, runId, token, teamId);
                    }, 5000);
                    return;
                }
                else {
                    setTimeout(() => {  
                        checkExecStatus(execStatus, triggerResponse, testSuite, finalResult, status, statusResponse, scriptResultStatus, emailId, teamId); 
                    }, 30000); // Changed to 30 seconds as per Java code
                }
            } catch (parseError) {
                console.log('\x1b[31m%s\x1b[0m', "Error parsing execution status response: " + parseError.message);
                setTimeout(() => {  
                    checkExecStatus(execStatus, triggerResponse, testSuite, finalResult, status, statusResponse, scriptResultStatus, emailId, teamId); 
                }, 30000);
            }
        }); 
    });
    reqPost.on('error', function(err) {
        console.log('\x1b[31m%s\x1b[0m', "ERROR in checkExecStatus: "+err.message);
        console.error(err.stack);
    });
    
    reqPost.end();
}

function checkScriptStatus(scriptResultStatus, runId, token, teamId) {
    // Update scriptResultStatus with proper query parameter and headers
    scriptResultStatus.path = '/webautomation-repo/v1/api/test-report-details?runId=' + runId;
    scriptResultStatus.headers = {
        'x-api-key': token,
        'authorization': gatewayAuth,
        'Content-Type': 'application/json',
        'Team-Id': teamId
    };
    
    var reqPost = https.request(scriptResultStatus, function (res) {
        /* If the response from the request is not 200 then fail the pipeline */
        if (res.statusCode != 200) {
            console.log('\x1b[31m%s\x1b[0m', "Failed to check script status. Status code: " + res.statusCode);
            return;
        }
        let body = '';
        res.on('data', chunk => {
            body += chunk.toString(); // convert Buffer to string
        });
        res.on('end', chunk => {
            if((body === null) || (typeof body === 'undefined')||(body ==="")) {
                return;
            }
            else{
                try {
                    var parsedJson = JSON.parse(body);
                    // The response structure might be different, handle accordingly
                    if (Array.isArray(parsedJson)) {
                        getUniqueScripts(parsedJson);
                    }
                } catch (parseError) {
                    console.log('\x1b[31m%s\x1b[0m', "Error parsing script status: " + parseError.message);
                }
            }
        });
    });
    reqPost.on('error', function(err) {
        console.log('\x1b[31m%s\x1b[0m', "ERROR in checkScriptStatus: " + err.message);
    });
    reqPost.end();
}

function getUniqueScripts(parsedJson) {
    for (let i = 0; i < parsedJson.length; i++) {
        newSet.add(parsedJson[i].scriptName);
        
    }
    if(count1 == 0) {
        oldSet = new Set(function*() { yield* Array.from(newSet.values()); yield* Array.from(oldSet.values()); }());
        printLogs(Array.from(newSet.values()), parsedJson);
        count1++;
    }
    else {
        array3 = Array.from(newSet.values()).filter(function (obj) { return Array.from(oldSet.values()).indexOf(obj) == -1; });
        printLogs(array3, parsedJson)
        oldSet = new Set(function*() { yield* Array.from(newSet.values()); yield* Array.from(oldSet.values()); }());
    }    
}

function printLogs(array3, parsedJson){
    for (var i = 0; i < array3.length; i++) {
        for (var j = 0; j < parsedJson.length; j++) {
            if (array3[i] === parsedJson[j].scriptName) {
                console.log(parsedJson[j].scriptName + " : " + parsedJson[j].scriptResult);
            }
        }
    }
}

function checkRunStatus (status){
    if(status === "P3"){
        return "RUNNING" ;
    }else if(status === "P1"){
        return "ALLOCATING BROWSER" ;
    }else if(status === "P2"){
        return "WAITING FOR BROWSER" ;
    }else if(status === "EXECUTING"){
        return "RUN INITIATED" ;
    }else if(status === "COMPLETED"){
        return "COMPLETED" ;
    }else if(status === "Q2"){
        return "WAITING FOR BROWSER" ;
    }else if(status === "GENERATING_REPORT"){
        return "GENERATING REPORT" ;
    }            
}

function checkFinalStatus (finalResult,triggerResponse,testSuite,emailId, runId, token, teamId) {
    console.log('\x1b[36m%s\x1b[0m', 'Grabbing final result of TestSuite ' + testSuite + ' ...');
    
    // Clean up runId if it contains colons
    if (runId && runId.includes(':')) {
        runId = runId.split(':')[1].replace('}', '');
        runId = runId.substring(1, runId.length - 1);
    }
    
    // Update finalResult with proper query parameter and headers
    finalResult.path = '/webautomation-repo/v1/api/test-report-details?runId=' + runId;
    finalResult.headers = {
        'x-api-key': token,
        'authorization': gatewayAuth,
        'Content-Type': 'application/json',
        'Team-Id': teamId
    };
    
    var reqPost = https.request(finalResult, function(res) {
        /* If the response from the request is not 200 then fail the pipeline */
        if(res.statusCode!=200){
            console.log('\x1b[31m%s\x1b[0m', 'Failed to get final result. Status code: ' + res.statusCode);
            process.exit(1);
            return;
        }

        let body = '';
        res.on('data', chunk => {
            body += chunk.toString(); // convert Buffer to string
        });
        res.on('end', () => {
            try {
                var executionResult = JSON.parse(body);
                
                // Build the final result object as per Java code
                const internalMappings = {
                    orgId: executionResult.organization || '',
                    runId: executionResult.uuid || runId,
                    testName: executionResult.name || testSuite
                };
                
                const finalStatus = executionResult.status || 'Unknown';
                
                // Construct the report path
                const path = internalMappings.orgId + "/" + internalMappings.runId + "/" + internalMappings.testName + ".zip";
                
                // Get the report URL
                getReportUrl(finalResult.host, finalResult.port, path, token, finalStatus, testSuite, internalMappings, teamId);
                
            } catch (parseError) {
                console.log('\x1b[31m%s\x1b[0m', "Error parsing final result: " + parseError.message);
                console.log("Response body: " + body);
                process.exit(1);
            }
        }); 
    });
    reqPost.on('error', function(err) {
        console.log('\x1b[31m%s\x1b[0m', "ERROR in checkFinalStatus: " + err.message);
        console.error(err.stack);
        process.exit(1);
    });
    reqPost.end();
}

function getReportUrl(host, port, path, token, finalStatus, testSuite, internalMappings, teamId) {
    const protocol = https;
    
    const options = {
        host: host,
        port: port,
        path: '/webautomation-repo/v1/api/get-reports-url?path=' + encodeURIComponent(path),
        method: 'GET',
        headers: {
            'x-api-key': token,
            'authorization': gatewayAuth,
            'Content-Type': 'application/json',
            'Team-Id': teamId
        },
        rejectUnauthorized: false
    };
    
        const req = protocol.request(options, function(res) {
        let body = '';
        
        res.on('data', chunk => {
            body += chunk.toString();
        });
        
        res.on('end', () => {
            try {
                let cdnReportUrl = body;
                // If response is JSON, extract the URL
                try {
                    const jsonResponse = JSON.parse(body);
                    // cdnReportUrl = jsonResponse.url || jsonResponse.reportUrl || body;

                    cdnReportUrl = jsonResponse.cdnReportUrl || body;
                } catch (e) {
                    // Body is already the URL string
                }
                
                console.log('\x1b[36m%s\x1b[0m', 'Execution of TestSuite ' + testSuite + ' is now Complete!');
                
                if (finalStatus === 'Pass' || finalStatus === 'PASS') {
                    console.log('\x1b[32m%s\x1b[0m', "Test Passed! Click on the below link to download the run report");
                    // console.log(`<a href="${cdnReportUrl}" target="_blank">Download Report</a>`)
                    console.log('\x1b[36m%s\x1b[0m', cdnReportUrl);
                    process.exitCode = 0;
                } else {
                    console.log('\x1b[31m%s\x1b[0m', "Test Failed! Click on the below link to download the run report");
                    console.log('\x1b[36m%s\x1b[0m', cdnReportUrl);
                    
                    // // Also provide XML download URL
                    // const webCloudfrontUrl = 'https://d38ik34kej2vsv.cloudfront.net/'; // Update if different
                    // const xmlUrl = webCloudfrontUrl + internalMappings.orgId + "/" + internalMappings.runId + "/Results/TEST-" + internalMappings.runId + ".xml";
                    // console.log('\x1b[36m%s\x1b[0m', "XML Report: " + xmlUrl);
                    
                    process.exitCode = 1;
                }
            } catch (parseError) {
                console.log('\x1b[31m%s\x1b[0m', "Error getting report URL: " + parseError.message);
                process.exit(1);
            }
        });
    });
    
    req.on('error', function(err) {
        console.log('\x1b[31m%s\x1b[0m', "ERROR getting report URL: " + err.message);
        process.exit(1);
    });
    
    req.end();
}

const validateSaltToken = function(token, gatewayUrl) {
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
                path: `/usermgmt/v2/api/validateAPIToken?apiToken=${rawToken}`,
                method: 'GET',
                headers: {
                    'accept': 'application/json',
                    'authorization': gatewayAuth
                },
                rejectUnauthorized: false
            };

            // Make the HTTP request
            const req = protocol.request(options, function(res) {
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

            req.on('error', function(err) {
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

// ==================== API Helper Functions ====================

/**
 * Get organization information by team name
 */
const getOrganizationInfo = function(gatewayUrl, customAuth, teamName, teamId) {
    return new Promise((resolve, reject) => {
        try {
            const parsedUrl = url.parse(gatewayUrl);
            const hostName = parsedUrl.hostname;
            const port = parsedUrl.port;
            const protocol = parsedUrl.protocol === 'https:' ? https : http;
            
            const options = {
                host: hostName,
                port: port,
                path: `/webautomation-repo/v1/api/getOrganizationByTeam?teamName=${encodeURIComponent(teamName)}`,
                method: 'GET',
                headers: {
                    'x-api-key': customAuth,
                    'authorization': gatewayAuth,
                    'Team-Id': teamId
                },
                rejectUnauthorized: false
            };
            
            const req = protocol.request(options, function(res) {
                let bodyString = '';
                
                res.on('data', chunk => {
                    bodyString += chunk.toString();
                });
                
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        try {
                            const organizationList = JSON.parse(bodyString);
                            // console.log('\x1b[36m%s\x1b[0m', "Organization list retrieved successfully");
                            resolve(organizationList);
                        } catch (parseError) {
                            console.log('\x1b[31m%s\x1b[0m', "Error parsing organization response: " + parseError.message);
                            reject(new Error("Error parsing organization response: " + parseError.message));
                        }
                    } else {
                        console.log('\x1b[31m%s\x1b[0m', "Failed to get organization info. Status code: " + res.statusCode);
                        reject(new Error("Request failed with status code: " + res.statusCode));
                    }
                });
            });
            
            req.on('error', function(err) {
                console.log('\x1b[31m%s\x1b[0m', "Error getting organization info: " + err.message);
                reject(err);
            });
            
            req.end();
        } catch (error) {
            console.log('\x1b[31m%s\x1b[0m', "Error in getOrganizationInfo: " + error.message);
            reject(error);
        }
    });
};

/**
 * Get team UUID by team name
 */
const getTeamUuid = function(gatewayUrl, customAuth) {
    return new Promise((resolve, reject) => {
        getTeamsInformation(gatewayUrl, customAuth).then(function(teamInfoJson) {
            try {
                const teamsInfoArray = JSON.parse(teamInfoJson);
                // console.log('\x1b[36m%s\x1b[0m', "Retrieved " + teamsInfoArray.length + " teams");
                resolve(teamsInfoArray);
            } catch (parseError) {
                console.log('\x1b[31m%s\x1b[0m', "Error parsing teams JSON: " + parseError.message);
                reject(parseError);
            }
        }).catch(reject);
    });
};

/**
 * Get teams information
 */
const getTeamsInformation = function(gatewayUrl, customAuth) {
    return new Promise((resolve, reject) => {
        try {
            const parsedUrl = url.parse(gatewayUrl);
            const hostName = parsedUrl.hostname;
            const port = parsedUrl.port;
            const protocol = parsedUrl.protocol === 'https:' ? https : http;
            
            const options = {
                host: hostName,
                port: port,
                path: '/usermgmt/v2/api/teams-by-user-and-role',
                method: 'GET',
                headers: {
                    'x-api-key': customAuth,
                    'authorization': gatewayAuth
                },
                rejectUnauthorized: false
            };
            
            const req = protocol.request(options, function(res) {
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
            
            req.on('error', function(err) {
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

/**
 * Get project UUID by team UUID and project name
 */
const getProjectUuid = function(gatewayUrl, customAuth, teamId, teamName, projectName) {
    return new Promise((resolve, reject) => {
        // Now get projects with teamId
        getProjectsInformation(gatewayUrl, customAuth, teamId).then(function(projectsInfoJson) {
            try {
                const responseJson = JSON.parse(projectsInfoJson);
                const projectsArray = responseJson.content || [];
                
                // Find project ID by project name
                let projectId = null;
                for (let i = 0; i < projectsArray.length; i++) {
                    if (projectsArray[i].projectName && 
                        projectsArray[i].projectName.toLowerCase() === projectName.toLowerCase()) {
                        projectId = projectsArray[i].uuid.trim();
                        break;
                    }
                }
                
                if (!projectId) {
                    console.log('\x1b[31m%s\x1b[0m', "Project not found: " + projectName);
                    reject(new Error("Project not found: " + projectName));
                    return;
                }
                
                resolve(projectId);
            } catch (parseError) {
                console.log("response body")
                console.log('\x1b[31m%s\x1b[0m', "Error parsing projects JSON: " + parseError.message);
                reject(parseError);
            }
        }).catch(reject);
    });
};

/**
 * Get projects information
 */
const getProjectsInformation = function(gatewayUrl, customAuth, teamId) {
    return new Promise((resolve, reject) => {
        try {
            const parsedUrl = url.parse(gatewayUrl);
            const hostName = parsedUrl.hostname;
            const port = parsedUrl.port;
            const protocol = parsedUrl.protocol === 'https:' ? https : http;
            
            // Using hardcoded values as per Java code
            const serviceStoreId = teamId;
            
            const options = {
                host: hostName,
                port: port,
                path: `/webautomation-repo/v1/api/projects-by-team-and-servicestore?teamId=${teamId}&serviceStoreId=${serviceStoreId}`,
                method: 'GET',
                headers: {
                    'x-api-key': customAuth.trim(),
                    'authorization': gatewayAuth.trim(),
                    'Team-Id': teamId
                },
                rejectUnauthorized: false
            };
            
            const req = protocol.request(options, function(res) {
                let bodyString = '';
                
                res.on('data', chunk => {
                    bodyString += chunk.toString();
                });
                
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        resolve(bodyString);
                    } else {
                        console.log('\x1b[31m%s\x1b[0m', "Failed to get projects information. Status code: " + res.statusCode);
                        console.log('\x1b[31m%s\x1b[0m', "Response Body: " + bodyString);
                        reject(new Error("Request failed with status code: " + res.statusCode));
                    }
                });
            });
            
            req.on('error', function(err) {
                console.log('\x1b[31m%s\x1b[0m', "Error getting projects information: " + err.message);
                reject(err);
            });
            
            req.end();
        } catch (error) {
            console.log('\x1b[31m%s\x1b[0m', "Error in getProjectsInformation: " + error.message);
            reject(error);
        }
    });
};

/**
 * Get test suite UUID by project UUID and test suite name
 */
const getTestSuiteUuid = function(gatewayUrl, customAuth, projectUuid, testSuiteName, teamId) {
    return new Promise((resolve, reject) => {
        getTestSuitesForTestAutomation(gatewayUrl, customAuth, projectUuid, teamId).then(function(testSuitesInfoJson) {
            try {
                const responseJson = JSON.parse(testSuitesInfoJson);
                const testSuitesArray = responseJson.content || [];
                
                // Find test suite ID by test suite name
                let suiteId = null;
                for (let i = 0; i < testSuitesArray.length; i++) {
                    if (testSuitesArray[i].testSuiteName && 
                        testSuitesArray[i].testSuiteName.toLowerCase() === testSuiteName.toLowerCase()) {
                        suiteId = testSuitesArray[i].uuid.trim();
                        break;
                    }
                }
                
                if (!suiteId) {
                    console.log('\x1b[31m%s\x1b[0m', "Test suite not found: " + testSuiteName);
                    reject(new Error("Test suite not found: " + testSuiteName));
                    return;
                }
                
                resolve(suiteId);
            } catch (parseError) {
                console.log('\x1b[31m%s\x1b[0m', "Error parsing test suites JSON: " + parseError.message);
                reject(parseError);
            }
        }).catch(reject);
    });
};

/**
 * Get test suites for test automation
 */
const getTestSuitesForTestAutomation = function(gatewayUrl, customAuth, projectUUID, teamId) {
    return new Promise((resolve, reject) => {
        try {
            const parsedUrl = url.parse(gatewayUrl);
            const hostName = parsedUrl.hostname;
            const port = parsedUrl.port;
            const protocol = parsedUrl.protocol === 'https:' ? https : http;
            
            // console.log("Organisation id" + organizationId);
            
            const options = {
                host: hostName,
                port: port,
                path: `/webautomation-repo/v1/api/test-suites-for-test-lab?projectUUID=${projectUUID}`,
                method: 'GET',
                headers: {
                    'x-api-key': customAuth,
                    'authorization': gatewayAuth,
                    // 'organization_Id': organizationId,
                    'Team-Id': teamId
                },
                rejectUnauthorized: false
            };
            
            const req = protocol.request(options, function(res) {
                let bodyString = '';
                
                res.on('data', chunk => {
                    bodyString += chunk.toString();
                });
                
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        resolve(bodyString);
                    } else {
                        console.log('\x1b[31m%s\x1b[0m', "Failed to get test suites. Status code: " + res.statusCode);
                        console.log
                        reject(new Error("Request failed with status code: " + res.statusCode));
                    }
                });
            });
            
            req.on('error', function(err) {
                console.log('\x1b[31m%s\x1b[0m', "Error getting test suites: " + err.message);
                reject(err);
            });
            
            req.end();
        } catch (error) {
            console.log('\x1b[31m%s\x1b[0m', "Error in getTestSuitesForTestAutomation: " + error.message);
            reject(error);
        }
    });
};

/**
 * Get environment UUID by project UUID and environment name
 */
const getEnvironmentUuid = function(gatewayUrl, customAuth, projectUUID, variableName, teamId) {
    return new Promise((resolve, reject) => {
        getEnvironmentVariablesForTestAutomation(gatewayUrl, customAuth, projectUUID, teamId).then(function(variablesInfoJson) {
            try {
                if (!variablesInfoJson || variablesInfoJson.trim() === '') {
                    // If no environments, return Global
                    resolve('Global');
                    return;
                }
                
                const variableArray = JSON.parse(variablesInfoJson);
                
                // Find environment ID by environment name
                let envId = 'Global';
                for (let i = 0; i < variableArray.length; i++) {
                    if (variableArray[i].environmentName && 
                        variableArray[i].environmentName.toLowerCase() === variableName.toLowerCase()) {
                        envId = variableArray[i].uuid.trim();
                        break;
                    }
                }
                
                resolve(envId);
            } catch (parseError) {
                console.log('\x1b[33m%s\x1b[0m', "Warning: Error parsing environment variables, using Global: " + parseError.message);
                resolve('Global');
            }
        }).catch(function(error) {
            console.log('\x1b[33m%s\x1b[0m', "Warning: Error getting environment variables, using Global: " + error.message);
            resolve('Global');
        });
    });
};

/**
 * Get environment variables for test automation
 */
const getEnvironmentVariablesForTestAutomation = function(gatewayUrl, customAuth, projectUuid, teamId) {
    return new Promise((resolve, reject) => {
        try {
            const parsedUrl = url.parse(gatewayUrl);
            const hostName = parsedUrl.hostname;
            const port = parsedUrl.port;
            const protocol = parsedUrl.protocol === 'https:' ? https : http;
            
            const options = {
                host: hostName,
                port: port,
                path: `/webautomation-repo/v1/api/variables-environment?projectUUID=${projectUuid}`,
                method: 'GET',
                headers: {
                    'x-api-key': customAuth,
                    'authorization': gatewayAuth,
                    'Team-Id': teamId
                },
                rejectUnauthorized: false
            };
            
            const req = protocol.request(options, function(res) {
                let bodyString = '';
                
                res.on('data', chunk => {
                    bodyString += chunk.toString();
                });
                
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        resolve(bodyString);
                    } else {
                        console.log('\x1b[31m%s\x1b[0m', "Failed to get environment variables. Status code: " + res.statusCode);
                        reject(new Error("Request failed with status code: " + res.statusCode));
                    }
                });
            });
            
            req.on('error', function(err) {
                console.log('\x1b[31m%s\x1b[0m', "Error getting environment variables: " + err.message);
                reject(err);
            });
            
            req.end();
        } catch (error) {
            console.log('\x1b[31m%s\x1b[0m', "Error in getEnvironmentVariablesForTestAutomation: " + error.message);
            reject(error);
        }
    });
};

/**
 * Get active browser subscriptions
 */
const getActiveBrowserSubscriptions = function(gatewayUrl, authToken, teamId, login) {
    return new Promise((resolve, reject) => {
        try {
            const parsedUrl = url.parse(gatewayUrl);
            const hostName = parsedUrl.hostname;
            const port = parsedUrl.port;
            const protocol = parsedUrl.protocol === 'https:' ? https : http;
            
            const options = {
                host: hostName,
                port: port,
                path: `/subscription-service/v1/api/get-active-browser-subscriptions/${teamId}?login=${login}`,
                method: 'GET',
                headers: {
                    'x-api-key': authToken,
                    'authorization': 'Bearer ' + gatewayAuth.replace('Bearer ', ''),
                    'Team-Id': teamId,
                    'login': login
                },
                rejectUnauthorized: false
            };
            
            const req = protocol.request(options, function(res) {
                let bodyString = '';
                
                res.on('data', chunk => {
                    bodyString += chunk.toString();
                });
                
                res.on('end', () => {

                    if (res.statusCode === 200) {
                        resolve(bodyString);
                    } else {
                        console.log('\x1b[31m%s\x1b[0m', "Failed to get browser subscriptions. Status code: " + res.statusCode);
                        reject(new Error("Request failed with status code: " + res.statusCode));
                    }
                });
            });
            
            req.on('error', function(err) {
                console.log('\x1b[31m%s\x1b[0m', "Error getting browser subscriptions: " + err.message);
                reject(err);
            });
            
            req.end();
        } catch (error) {
            console.log('\x1b[31m%s\x1b[0m', "Error in getActiveBrowserSubscriptions: " + error.message);
            reject(error);
        }
    });
};

/**
 * Get multi-run value from browser config
 */
const getMultiRunValue = function(jsonResponse, selectedBrowser) {
    try {
        const json = JSON.parse(jsonResponse);
        const dedicated = json.dedicated || [];
        const shared = json.shared || [];
        
        let match = null;
        let runType = null;
        
        // Helper function to check browser match
        const checkBrowserMatch = function(obj, userBrowser) {
            const browserName = obj.browserName || '';
            const browserVersion = (obj.browserVersion || '').toLowerCase();
            const userBrowserLower = userBrowser.toLowerCase();
            
            // Normal match
            let matchFound = browserName.toLowerCase() === userBrowserLower;
            
            // Handle MicrosoftEdge(ie) or MicrosoftEdge (ie)
            if (!matchFound && userBrowserLower.includes('edge') && userBrowserLower.includes('ie')) {
                matchFound = browserName.toLowerCase() === 'microsoftedge' && 
                             browserVersion.includes('ie mode');
            }
            
            return matchFound;
        };
        
        // Prefer DEDICATED
        for (let i = 0; i < dedicated.length; i++) {
            if (checkBrowserMatch(dedicated[i], selectedBrowser)) {
                match = dedicated[i];
                runType = 'DEDICATED';
                break;
            }
        }
        
        // Then fallback to SHARED
        if (!match) {
            for (let i = 0; i < shared.length; i++) {
                if (checkBrowserMatch(shared[i], selectedBrowser)) {
                    match = shared[i];
                    runType = 'SHARED';
                    break;
                }
            }
        }
        
        if (!match) {
            console.log('\x1b[31m%s\x1b[0m', "No matching browser configuration found for " + selectedBrowser);
            return null;
        }
        
        const run = {
            operatingSystem: match.operatingSystem || '',
            operatingSystemVersion: match.operatingSystemVersion || '',
            browser: match.browserName || '',
            version: match.browserVersion || '',
            publicCloudRunType: runType
        };
        
        if (runType === 'DEDICATED') {
            run.snapShotName = match.snapShotName || '';
            run.nodeUuid = match.nodeUuid || '';
            run.uuid = match.uuid || '';
            run.visualRegressionEnabled = false;
        } else {
            run.uuid = match.uuid || '';
        }
        
        return '**[' + JSON.stringify(run) + ']**';
    } catch (error) {
        console.log('\x1b[31m%s\x1b[0m', "Error in getMultiRunValue: " + error.message);
        return null;
    }
};

/**
 * Execute test for web repo automation
 */
const executeTestForWebRepoAutomation = function(
    gatewayUrl,
    organizationName,
    userAuthToken,
    testSuiteId,
    projectId,
    browserType,
    osType,
    projectName,
    parameterFileSource,
    onErrorContinue,
    variableName,
    teamId,
    login
) {
    return new Promise((resolve, reject) => {
        // Get browser config first
        getActiveBrowserSubscriptions(gatewayUrl, userAuthToken, teamId, login).then(function(browserConfig) {
            if (!browserConfig) {
                console.log('\x1b[31m%s\x1b[0m', "Failed to get browser configuration");
                reject(new Error("Failed to get browser configuration"));
                return;
            }
            
            const multirun = getMultiRunValue(browserConfig, browserType);
            if (!multirun) {
                console.log('\x1b[31m%s\x1b[0m', "Failed to get multirun value");
                reject(new Error("Failed to get multirun value"));
                return;
            }
            
            // Build test map
            const testMap = {
                testSuite: { uuid: testSuiteId },
                testScript: null,
                pluginName: 'AZURE',
                isJenkins: false,
                isExtraValue: false,
                moduleRun: false,
                isDryRun: false,
                project: { uuid: projectId },
                databaseConfiguration: null,
                testLabRun: true,
                onErrorContinue: onErrorContinue || false,
                isHealer: false,
                isPublicCloudRun: true,
                sprint: null
            };
            
            // Parameter file source
            if (!parameterFileSource || parameterFileSource === '' || parameterFileSource === 'NONE') {
                testMap.parameterFileSource = 'EXCEL';
            } else {
                testMap.parameterFileSource = parameterFileSource;
            }
            
            // Variable environment ID
            if (variableName && variableName.toLowerCase() === 'global') {
                testMap.variableEnvironmentId = null;
            } else {
                testMap.variableEnvironmentId = variableName;
            }
            
            // Screen dimension
            if (organizationName && organizationName.includes && organizationName.includes('Bunzl')) {
                console.log('\x1b[36m%s\x1b[0m', "Setting screen dimension 1600x1200 for Bunzl Organization");
                testMap.screenDimension = '1600x1200';
            } else {
                testMap.screenDimension = '1024x768';
            }
            
            // Add multiRuns
            testMap.multiRuns = multirun;
            
            // Convert to JSON and clean up
            let jsonString = JSON.stringify(testMap);
            jsonString = jsonString.replace(/\"\*\*/g, '');
            jsonString = jsonString.replace(/\*\*\"/g, '');
            jsonString = jsonString.replace(/\[/g, '["');
            jsonString = jsonString.replace(/\]/g, '"]');
            
            // Make the execute test request
            try {
                const parsedUrl = url.parse(gatewayUrl);
                const hostName = parsedUrl.hostname;
                const port = parsedUrl.port;
                const protocol = parsedUrl.protocol === 'https:' ? https : http;
                
                const options = {
                    host: hostName,
                    port: port,
                    path: '/webautomation-repo/v1/api/execute-test',
                    method: 'POST',
                    headers: {
                        'x-api-key': userAuthToken,
                        'authorization': gatewayAuth,
                        'Content-Type': 'application/json',
                        'Team-Id': teamId
                    },
                    rejectUnauthorized: false
                };
                
                const req = protocol.request(options, function(res) {
                    let bodyString = '';
                    
                    res.on('data', chunk => {
                        bodyString += chunk.toString();
                    });
                    
                    res.on('end', () => {
                        
                        if (res.statusCode === 200 || res.statusCode === 202) {
                            try {
                                const responseJson = JSON.parse(bodyString);
                                const runId = responseJson.runId;
                                
                                if (!runId) {
                                    console.log('\x1b[31m%s\x1b[0m', "Failed to execute test! RunId not found in response");
                                    reject(new Error("Failed to execute test! RunId not found"));
                                    return;
                                }
                                
                                resolve({
                                    runId: runId.toString(),
                                    token: userAuthToken
                                });
                            } catch (parseError) {
                                console.log('\x1b[31m%s\x1b[0m', "Error parsing execute test response: " + parseError.message);
                                reject(parseError);
                            }
                        } else {
                            console.log('\x1b[31m%s\x1b[0m', "Failed to execute test. Status code: " + res.statusCode);
                            reject(new Error("Request failed with status code: " + res.statusCode));
                        }
                    });
                });
                
                req.on('error', function(err) {
                    console.log('\x1b[31m%s\x1b[0m', "Error executing test: " + err.message);
                    reject(err);
                });
                
                req.write(jsonString);
                req.end();
            } catch (error) {
                console.log('\x1b[31m%s\x1b[0m', "Error in executeTestForWebRepoAutomation request: " + error.message);
                reject(error);
            }
        }).catch(reject);
    });
};


module.exports = {
    trigger,
    validateSaltToken
}