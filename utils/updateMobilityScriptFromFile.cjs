'use strict';

const fs = require('fs');
const FormData = require('form-data');
const gateway = require('./mobilityGateway.cjs');

const trigger = async function (apiKey, teamName, projectName, suiteName, scriptName, scriptFilePath, configurationFilePath) {
    try {
        const inputData = resolveInputData(
            apiKey, teamName, projectName, suiteName, scriptName, scriptFilePath, configurationFilePath);

        if (!fs.existsSync(inputData.scriptFilePath)) {
            console.log('File to update script not found!');
            process.exitCode = 1;
            return;
        }

        console.log("Updating script...");

        const gatewayUrl = gateway.deriveGatewayUrlFromApiKey(inputData.apiKey);
        await gateway.validateApiKey(gatewayUrl, inputData.apiKey);
        const { teamId, projectId } = await gateway.resolveProjectContext(
            gatewayUrl, inputData.apiKey, inputData.teamName, inputData.projectName);
        const suiteId = await gateway.getSuiteUuid(
            gatewayUrl, inputData.apiKey, teamId, projectId, inputData.suiteName);
        const scriptId = await resolveScriptId(
            gatewayUrl, inputData.apiKey, teamId, suiteId, inputData.scriptName);

        const formData = new FormData();
        formData.append('file', fs.createReadStream(inputData.scriptFilePath), {
            contentType: 'application/octet-stream'
        });
        formData.append('scriptUUID', scriptId);

        const response = await gateway.multipartRequest(
            gatewayUrl, inputData.apiKey, teamId,
            `${gateway.MOBILITY_CONTEXT}/api/update-script-from-file`,
            formData);

        if (response.statusCode < 200 || response.statusCode > 299) {
            throw new Error(gateway.extractErrorMessage(response.body));
        }

        console.log('\x1b[32m%s\x1b[0m', 'Script updated successfully!');
        process.exitCode = 0;
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', `Failed to update script! ${error.message}`);
        process.exitCode = 1;
    }
}

async function resolveScriptId(gatewayUrl, apiKey, teamId, suiteId, scriptName) {
    const scripts = await gateway.getActiveScripts(gatewayUrl, apiKey, teamId, suiteId);
    const script = scripts.find((s) => gateway.matchesName(s.testScriptName, scriptName));
    if (!script) throw new Error('Invalid scriptName, please provide valid scriptName!');
    if (script.isLocked) throw new Error(`${scriptName} is locked`);
    return script.uuid.trim();
}

function resolveInputData(apiKey, teamName, projectName, suiteName, scriptName, scriptFilePath, configurationFilePath) {
    const config = configurationFilePath != null ? gateway.readConfigFile(configurationFilePath) : null;

    const inputData = {
        apiKey: gateway.resolveOption(apiKey, config?.configuration?.apiKey),
        teamName: gateway.resolveOption(teamName, config?.scriptInfo?.teamName),
        projectName: gateway.resolveOption(projectName, config?.scriptInfo?.projectName),
        suiteName: gateway.resolveOption(suiteName, config?.scriptInfo?.suiteName),
        scriptName: gateway.resolveOption(scriptName, config?.scriptInfo?.scriptName),
        scriptFilePath: gateway.resolveOption(scriptFilePath, config?.scriptInfo?.scriptFilePath)
    };

    if (invalidValue(inputData.apiKey)) {
        throw new Error('Invalid apiKey. Provide it with --apiKey or in your configuration file.');
    }
    const missing = ['teamName', 'projectName', 'suiteName', 'scriptName', 'scriptFilePath']
        .filter((field) => invalidValue(inputData[field]));
    if (missing.length > 0) {
        throw new Error(`Invalid script info. Check: ${missing.join(', ')}.`);
    }
    return inputData;
}

function invalidValue(data) {
    return data == null || data.toString() == '';
}

module.exports = {
    trigger
}
