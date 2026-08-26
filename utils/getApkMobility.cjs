'use strict';

const gateway = require('./mobilityGateway.cjs');

const trigger = async function(apiKey, qyrus_team_name, qyrus_project_name, configurationFilePath) {
    try {
        console.log("Fetching the app names in progress...");

        const inputData = resolveInputData(apiKey, qyrus_team_name, qyrus_project_name, configurationFilePath);
        const gatewayUrl = gateway.deriveGatewayUrlFromApiKey(inputData.apiKey);

        await gateway.validateApiKey(gatewayUrl, inputData.apiKey);
        const { teamId, projectId } = await gateway.resolveProjectContext(
            gatewayUrl, inputData.apiKey, inputData.teamName, inputData.projectName);

        const apps = await gateway.listApps(gatewayUrl, inputData.apiKey, teamId, projectId);
        console.log(JSON.stringify(apps.map((app) => ({ apkName: app.apkName }))));
        process.exitCode = 0;
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', `Failed to fetch app details! ${error.message}`);
        process.exitCode = 1;
    }
}

function resolveInputData(apiKey, teamName, projectName, configurationFilePath) {
    const config = configurationFilePath != null ? gateway.readConfigFile(configurationFilePath) : null;

    const inputData = {
        apiKey: gateway.resolveOption(apiKey, config?.configuration?.apiKey),
        teamName: gateway.resolveOption(teamName, config?.projectInfo?.teamName),
        projectName: gateway.resolveOption(projectName, config?.projectInfo?.projectName)
    };

    if (invalidValue(inputData.apiKey) || invalidValue(inputData.teamName) || invalidValue(inputData.projectName)) {
        throw new Error('Invalid input data. Check your apiKey, teamName and projectName.');
    }
    return inputData;
}

function invalidValue(data) {
    return data == null || data.toString() == '';
}

module.exports = {
    trigger
}
