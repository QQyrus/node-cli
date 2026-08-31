'use strict';

const gateway = require('./mobilityGateway.cjs');

const trigger = async function(apiKey, teamName, projectName, varName, varType, varValue, envName, fromFile) {
    try {
        const inputData = resolveInputData(apiKey, teamName, projectName, varName, varType, varValue, envName, fromFile);

        console.log("Updating global variable...");

        const gatewayUrl = gateway.deriveGatewayUrlFromApiKey(inputData.apiKey);
        await gateway.validateApiKey(gatewayUrl, inputData.apiKey);
        const { teamId, projectId } = await gateway.resolveProjectContext(
            gatewayUrl, inputData.apiKey, inputData.teamName, inputData.projectName);

        const value = inputData.varType.toLowerCase() === 'password'
            ? Buffer.from(inputData.varValue, 'base64').toString('utf8')
            : inputData.varValue;

        const environmentId = inputData.envName === ''
            ? null
            : await resolveEnvironmentId(gatewayUrl, inputData.apiKey, teamId, projectId, inputData.envName);

        // The service replaces the whole variable set, so read it, patch the one
        // entry and write it all back.
        const variables = await getVariables(gatewayUrl, inputData.apiKey, teamId, projectId, environmentId);
        const updated = applyVariableUpdate(variables, inputData.varName, value, environmentId);

        const response = await gateway.postJson(gatewayUrl, inputData.apiKey, teamId,
            `${gateway.MOBILITY_CONTEXT}/api/variables?projectId=${projectId}`, updated);

        if (response.statusCode !== 200) {
            console.log('Failed to update variable:', gateway.extractErrorMessage(response.body));
            process.exitCode = 1;
            return;
        }

        console.log("Update to variable -", inputData.varName, "- is successfull!");
        process.exitCode = 0;
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', `ERROR : ${error.message}`);
        process.exitCode = 1;
    }
}

async function resolveEnvironmentId(gatewayUrl, apiKey, teamId, projectId, envName) {
    const environments = await gateway.getEnvironments(gatewayUrl, apiKey, teamId, projectId);
    const environment = environments.find((e) => gateway.matchesName(e.environmentName, envName));
    if (!environment) throw new Error('Invalid environmentName, please provide valid environmentName!');
    return environment.environmentId;
}

async function getVariables(gatewayUrl, apiKey, teamId, projectId, environmentId) {
    const path = `${gateway.MOBILITY_CONTEXT}/api/variables?projectId=${projectId}` +
        `&environmentId=${environmentId != null ? environmentId : ''}`;
    return gateway.getJson(gatewayUrl, apiKey, teamId, path, 'variables');
}

/**
 * Environment-scoped updates also stamp every entry with the environment,
 * matching what the service expects on write.
 */
function applyVariableUpdate(variables, varName, value, environmentId) {
    let found = false;

    const updated = variables.map((variable) => {
        const entry = { ...variable };
        if (environmentId != null) entry.environment = { environmentId };
        if (gateway.matchesName(entry.name, varName)) {
            entry.value = value;
            found = true;
        }
        return entry;
    });

    if (!found) throw new Error(`Unable to find variable "${varName}" in the given project/environment.`);
    return updated;
}

function resolveInputData(apiKey, teamName, projectName, varName, varType, varValue, envName, fromFile) {
    const config = fromFile != null ? gateway.readConfigFile(fromFile) : null;

    const inputData = {
        apiKey: gateway.resolveOption(apiKey, config?.configuration?.apiKey),
        teamName: gateway.resolveOption(teamName, config?.projectInfo?.teamName),
        projectName: gateway.resolveOption(projectName, config?.projectInfo?.projectName),
        varName: gateway.resolveOption(varName, config?.variableInfo?.variableName),
        varType: gateway.resolveOption(varType, config?.variableInfo?.variableType),
        varValue: gateway.resolveOption(varValue, config?.variableInfo?.variableValue),
        envName: gateway.resolveOption(envName, config?.variableInfo?.envName, '')
    };

    if (invalidValue(inputData.apiKey)) {
        throw new Error('Invalid apiKey. Provide it with --apiKey or in your configuration file.');
    }
    const missing = ['teamName', 'projectName', 'varName', 'varType', 'varValue']
        .filter((field) => invalidValue(inputData[field]));
    if (missing.length > 0) {
        throw new Error(`Invalid variable info. Check: ${missing.join(', ')}.`);
    }
    if (inputData.envName == null) inputData.envName = '';
    return inputData;
}

function invalidValue(data) {
    return data == null || data.toString() == '';
}

module.exports = {
    trigger
}
