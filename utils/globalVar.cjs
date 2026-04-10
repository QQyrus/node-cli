var https = require('https');
var http = require('http');
var url = require('url');
var webUtil = require('./web.cjs');

const webContext = '/web-no-auth/v1';

const trigger = function (apiKey, teamName,
    projectName, varEnvName, varName, varType,
    varValue) {

    let endpoint = '';
    const env = webUtil.getEnvName(apiKey);
    if (!env) {
        console.log('\x1b[31m%s\x1b[0m', "Invalid API Key format.");
        process.exit(1);
    }

    if (env == 'staging') {
        endpoint = 'https://stg-gateway.qyrus.com:8243';
    }
    else if (env == 'qyrus') {
        endpoint = 'https://gateway.qyrus.com';
    }
    else {
        endpoint = 'https://' + env + '-gateway.qyrus.com';
    }

    console.log('\x1b[36m%s\x1b[0m', "Validating credentials...");

    webUtil.validateSaltToken(apiKey, endpoint).then(function (result) {
        if (result.success) {
            console.log('\x1b[32m%s\x1b[0m', "Credentials Validated Successfully");
            processUpdate();
        } else {
            console.log('\x1b[31m%s\x1b[0m', "Error: " + result.message);
            process.exit(1);
        }
    }).catch(function (error) {
        console.log('\x1b[31m%s\x1b[0m', "Validation Error: " + error.message);
        process.exit(1);
    });

    function processUpdate() {
        var parsedUrl = url.parse(endpoint);
        var hostName = parsedUrl.hostname;
        var port = parsedUrl.port;
        var protocol = parsedUrl.protocol === 'https:' ? https : http;

        console.log('\x1b[36m%s\x1b[0m', "Fetching Team details...");

        webUtil.getTeamUuid(endpoint, apiKey).then(function (teamsArray) {
            let teamId = null;
            for (let i = 0; i < teamsArray.length; i++) {
                if (teamsArray[i].teamName && teamsArray[i].teamName.toLowerCase() === teamName.toLowerCase()) {
                    teamId = teamsArray[i].uuid.trim();
                    break;
                }
            }

            if (!teamId) {
                console.log('\x1b[31m%s\x1b[0m', "Team not found: " + teamName);
                process.exit(1);
            }

            console.log('\x1b[36m%s\x1b[0m', "Fetching Project details...");

            webUtil.getProjectUuid(endpoint, apiKey, teamId, teamName, projectName).then(function (projectId) {


                function updateVariable(envIdParam, projectIdParam) {
                    return new Promise((resolve, reject) => {
                        console.log('\x1b[36m%s\x1b[0m', "Fetching variables...");
                        let pathStr = webContext + '/api/global-variables?projectUUID=' + (projectIdParam || '') + '&environmentUUID=' + (envIdParam || '');

                        var optionsGet = {
                            host: hostName,
                            port: port,
                            path: pathStr,
                            method: 'GET',
                            headers: {
                                'x-api-key': apiKey,
                                'Team-Id': teamId,
                                'scope': 'NODE_CLI'
                            }
                        };

                        var reqGet = protocol.request(optionsGet, function (res) {
                            let body = '';
                            res.on('data', chunk => body += chunk.toString());
                            res.on('end', () => {
                                if (res.statusCode !== 200) {
                                    reject(new Error('Failed to fetch variables. Status: ' + res.statusCode + ' Body: ' + body));
                                    return;
                                }
                                try {
                                    let varObj = JSON.parse(body);
                                    let targetVar = null;
                                    for (let i = 0; i < varObj.length; i++) {
                                        let vName = varObj[i].varName || varObj[i].variableName;
                                        if (vName && vName.toLowerCase() === varName.toLowerCase()) {
                                            targetVar = varObj[i];
                                            break;
                                        }
                                    }

                                    if (!targetVar) {
                                        reject(new Error("Variable not found: " + varName));
                                        return;
                                    }

                                    let varUUID = targetVar.varId || targetVar.uuid;
                                    let envArrObj = [{
                                        "uuid": varUUID,
                                        "variableName": varName,
                                        "variableType": varType,
                                        "variableValue": varValue,
                                        "variableSequence": 0,
                                        "isEdit": true
                                    }];

                                    console.log('\x1b[36m%s\x1b[0m', "Updating variable...");
                                    var optionsPut = {
                                        host: hostName,
                                        port: port,
                                        path: pathStr,
                                        method: 'PUT',
                                        headers: {
                                            'x-api-key': apiKey,
                                            'Content-Type': 'application/json',
                                            'Team-Id': teamId,
                                            'scope': 'NODE_CLI'
                                        }
                                    };

                                    var reqPut = protocol.request(optionsPut, function (putRes) {
                                        let putBody = '';
                                        putRes.on('data', chunk => putBody += chunk.toString());
                                        putRes.on('end', () => {
                                            if (putRes.statusCode != 200 && putRes.statusCode != 202) {
                                                reject(new Error('Failed to update variable. Status: ' + putRes.statusCode + '\n' + putBody));
                                                return;
                                            }
                                            resolve();
                                        });
                                    });

                                    reqPut.on('error', reject);
                                    reqPut.write(JSON.stringify(envArrObj));
                                    reqPut.end();

                                } catch (e) {
                                    reject(new Error("Error parsing variables: " + e.message));
                                }
                            });
                        });
                        reqGet.on('error', reject);
                        reqGet.end();
                    });
                }

                //check if its global or custom environment variable
                if (varEnvName.toLowerCase() === "global") {
                    updateVariable("", projectId).then(() => {
                        console.log('\x1b[32m%s\x1b[0m', "Successfully updated variable '" + varName + "' in environment '" + varEnvName + "'");
                    }).catch(err => {
                        console.log('\x1b[31m%s\x1b[0m', "ERROR : " + err.message);
                        process.exitCode = 1;
                    });
                } else {
                    webUtil.getEnvironmentUuid(endpoint, apiKey, projectId, varEnvName, teamId).then(function (envId) {
                        updateVariable(envId, "").then(() => {
                            console.log('\x1b[32m%s\x1b[0m', "Successfully updated variable '" + varName + "' in environment '" + varEnvName + "'");
                        }).catch(err => {
                            console.log('\x1b[31m%s\x1b[0m', "ERROR : " + err.message);
                            process.exitCode = 1;
                        });
                    }).catch(function (error) {
                        console.log('\x1b[31m%s\x1b[0m', "Environment Error: " + error.message);
                        process.exitCode = 1;
                    });
                }

            }).catch(function (error) {
                console.log('\x1b[31m%s\x1b[0m', "Project Error: " + error.message);
                process.exit(1);
            });
        }).catch(function (error) {
            console.log('\x1b[31m%s\x1b[0m', "Team Error: " + error.message);
            process.exit(1);
        });
    }
}

module.exports = {
    trigger
}