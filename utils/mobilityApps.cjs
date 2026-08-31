'use strict';

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const gateway = require('./mobilityGateway.cjs');

/* -------------------------------------------------- */
/* ---------------- APP UPLOAD ---------------------- */
/* -------------------------------------------------- */

const uploadApp = async function(apiKey, qyrus_team_name, qyrus_project_name, appPath, enableDebug, configurationFilePath) {
    try {
        const inputData = resolveInputData({
            apiKey,
            teamName: qyrus_team_name,
            projectName: qyrus_project_name,
            appPath
        }, configurationFilePath, 'appInfo', ['appPath']);

        if (!fs.existsSync(inputData.appPath)) {
            console.log('App not found in artifacts!');
            process.exitCode = 1;
            return;
        }

        console.log("Uploading app...");

        const gatewayUrl = gateway.deriveGatewayUrlFromApiKey(inputData.apiKey);
        gateway.setDebug(enableDebug);
        await gateway.validateApiKey(gatewayUrl, inputData.apiKey);
        const { teamId, projectId } = await gateway.resolveProjectContext(
            gatewayUrl, inputData.apiKey, inputData.teamName, inputData.projectName.trim());

        const existingApps = await gateway.listApps(gatewayUrl, inputData.apiKey, teamId, projectId);
        const uploadName = resolveUploadName(existingApps, path.parse(inputData.appPath).base);

        const formData = new FormData();
        formData.append('file', fs.createReadStream(inputData.appPath), {
            filename: uploadName,
            knownLength: fs.statSync(inputData.appPath).size
        });

        const response = await gateway.multipartRequest(
            gatewayUrl, inputData.apiKey, teamId,
            `${gateway.MOBILITY_CONTEXT}/api/UploadApk?projectId=${projectId}`,
            formData);

        if (response.statusCode < 200 || response.statusCode >= 300) {
            console.log('Failed to upload app! Try again.');
            console.log(gateway.describeFailure('POST',
                `${gateway.MOBILITY_CONTEXT}/api/UploadApk?projectId=${projectId}`, response));
            process.exitCode = 1;
            return;
        }

        console.log("App - " + uploadName + " uploaded to Qyrus successfully!");
        process.exitCode = 0;
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', `Failed to upload app! ${error.message}`);
        process.exitCode = 1;
    }
}

/**
 * Qyrus keeps app names unique per project, so a colliding upload is
 * timestamped rather than rejected.
 */
function resolveUploadName(existingApps, appName) {
    const collides = existingApps.some((app) => gateway.matchesName(app.apkName, appName));
    if (!collides) return appName;

    const parsed = path.parse(appName);
    const timeStamp = buildTimeStamp();
    return `${parsed.name}_${timeStamp}${parsed.ext}`;
}

function buildTimeStamp() {
    const now = new Date();
    const pad = (value) => value.toString().padStart(2, '0');
    return [
        pad(now.getDate()),
        pad(now.getMonth() + 1),
        now.getFullYear(),
        pad(now.getHours()),
        pad(now.getMinutes()),
        pad(now.getSeconds())
    ].join('_');
}

/* -------------------------------------------------- */
/* ---------------- APP DELETE ---------------------- */
/* -------------------------------------------------- */

const deleteApp = async function(apiKey, qyrus_team_name, qyrus_project_name, appName, configurationFilePath) {
    try {
        const inputData = resolveInputData({
            apiKey,
            teamName: qyrus_team_name,
            projectName: qyrus_project_name,
            appName
        }, configurationFilePath, 'appInfo', ['appName']);

        console.log("App - " + inputData.appName + " removal in progress...");

        const gatewayUrl = gateway.deriveGatewayUrlFromApiKey(inputData.apiKey);
        await gateway.validateApiKey(gatewayUrl, inputData.apiKey);
        const { teamId, projectId } = await gateway.resolveProjectContext(
            gatewayUrl, inputData.apiKey, inputData.teamName, inputData.projectName);

        const apps = await gateway.listApps(gatewayUrl, inputData.apiKey, teamId, projectId);
        const app = apps.find((entry) => gateway.matchesName(entry.apkName, inputData.appName));
        if (!app) {
            throw new Error('Unable to find app with the given name! Please verify given app exists on Qyrus.');
        }

        const response = await gateway.httpRequest(gatewayUrl, {
            path: `${gateway.MOBILITY_CONTEXT}/api/upload-apk?id=${app.uuid}`,
            method: 'DELETE',
            headers: gateway.apiHeaders(inputData.apiKey, teamId)
        });

        if (response.statusCode !== 200) {
            console.log('Failed to delete app! Try again.');
            console.log(gateway.extractErrorMessage(response.body));
            process.exitCode = 1;
            return;
        }

        console.log("App - " + inputData.appName + " Deleted Sucessfully!");
        process.exitCode = 0;
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', `Failed to delete app! ${error.message}`);
        process.exitCode = 1;
    }
}

/* -------------------------------------------------- */
/* ---------------- APP COUNT ----------------------- */
/* -------------------------------------------------- */

const getApkCount = async function(apiKey, qyrus_team_name, qyrus_project_name, configurationFilePath) {
    try {
        console.log("Fetching the app count in progress...");

        const inputData = resolveInputData({
            apiKey,
            teamName: qyrus_team_name,
            projectName: qyrus_project_name
        }, configurationFilePath, 'projectInfo', []);

        const gatewayUrl = gateway.deriveGatewayUrlFromApiKey(inputData.apiKey);
        await gateway.validateApiKey(gatewayUrl, inputData.apiKey);
        const { teamId, projectId } = await gateway.resolveProjectContext(
            gatewayUrl, inputData.apiKey, inputData.teamName, inputData.projectName);

        const apps = await gateway.listApps(gatewayUrl, inputData.apiKey, teamId, projectId);
        const appsUploadedCount = apps.length;

        // "appsRemaningCount" is the name the adapter emitted; kept for output compatibility.
        console.log(JSON.stringify({
            appsUploadedCount,
            appsRemaningCount: gateway.APP_UPLOAD_LIMIT - appsUploadedCount
        }));
        process.exitCode = 0;
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', `Failed to fetch app count! ${error.message}`);
        process.exitCode = 1;
    }
}

/* -------------------------------------------------- */
/* ---------------- INPUT RESOLUTION ---------------- */
/* -------------------------------------------------- */

function resolveInputData(flags, configurationFilePath, fileSection, extraRequired) {
    const config = configurationFilePath != null ? gateway.readConfigFile(configurationFilePath) : null;
    const section = config?.[fileSection];

    const inputData = {
        apiKey: gateway.resolveOption(flags.apiKey, config?.configuration?.apiKey),
        teamName: gateway.resolveOption(flags.teamName, section?.teamName),
        projectName: gateway.resolveOption(flags.projectName, section?.projectName)
    };
    for (const field of extraRequired) {
        inputData[field] = gateway.resolveOption(flags[field], section?.[field]);
    }

    if (invalidValue(inputData.apiKey)) {
        throw new Error('Invalid apiKey. Provide it with --apiKey or in your configuration file.');
    }
    const missing = ['teamName', 'projectName', ...extraRequired].filter((field) => invalidValue(inputData[field]));
    if (missing.length > 0) {
        throw new Error(`Invalid app info. Check: ${missing.join(', ')}.`);
    }
    return inputData;
}

function invalidValue(data) {
    return data == null || data.toString() == '';
}

module.exports = {
    uploadApp,
    deleteApp,
    getApkCount
}
