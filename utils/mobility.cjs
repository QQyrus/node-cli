'use strict';

const gateway = require('./mobilityGateway.cjs');

/* -------------------------------------------------- */
/* ---------------- CONSTANTS ----------------------- */
/* -------------------------------------------------- */

const STATUS_LABELS = {
    EXECUTING: 'Test Queued',
    P1: 'Allocating Device',
    P2: 'Waiting for Device',
    P3: 'Running',
    UPLOADING_RESULTS: 'Uploading Results'
};

/* -------------------------------------------------- */
/* ---------------- CORE TRIGGER -------------------- */
/* -------------------------------------------------- */

const trigger = async function(apiKey, qyrus_team_name, qyrus_project_name, qyrus_suite_name,
    appName, app_activity, device_pool_name, enable_debug, bundle_id, emailId, appPackage,
    envName, firstAvailable, fromFile)
{
    try {
        if (firstAvailable != null && invalidValueForFirstAvailableDevice(firstAvailable)) {
            console.error('ERROR : Invalid value for first available device:', firstAvailable);
            process.exit(1);
        }

        const testObject = resolveTestObject({
            apiKey,
            teamName: qyrus_team_name,
            projectName: qyrus_project_name,
            testSuiteName: qyrus_suite_name,
            appFileName: appName,
            appActivity: app_activity,
            appPackage,
            bundleId: bundle_id,
            devicePoolName: device_pool_name,
            envName,
            firstAvailable,
            enableDebug: enable_debug
        }, fromFile);

        const gatewayUrl = gateway.deriveGatewayUrlFromApiKey(testObject.apiKey);
        gateway.setDebug(testObject.enableDebug);
        printDebugInformation(testObject, gatewayUrl);

        console.log('\x1b[32m%s\x1b[0m', "Getting your environment ready, your test will start running soon.");

        const { login } = await gateway.validateApiKey(gatewayUrl, testObject.apiKey);

        const teamId = await gateway.getTeamUuid(gatewayUrl, testObject.apiKey, testObject.teamName);
        const projectId = await gateway.getProjectUuid(gatewayUrl, testObject.apiKey, teamId, testObject.projectName);
        const suiteId = await gateway.getSuiteUuid(gatewayUrl, testObject.apiKey, teamId, projectId, testObject.testSuiteName);
        const environmentId = await gateway.getEnvironmentId(
            gatewayUrl, testObject.apiKey, teamId, projectId, testObject.envName);

        const devicePoolId = testObject.devicePoolName !== ''
            ? await gateway.getDevicePoolUuid(gatewayUrl, testObject.apiKey, teamId, projectId, testObject.devicePoolName)
            : null;

        const deviceConfiguration = await resolveDevices(
            gatewayUrl, testObject.apiKey, teamId, devicePoolId, deviceTypeFor(testObject.appActivity));

        const appDetails = requiresAppLookup(testObject)
            ? await resolveAppDetails(gatewayUrl, testObject.apiKey, teamId, projectId, testObject.appFileName)
            : null;

        const payload = buildExecutePayload(testObject, {
            login, projectId, suiteId, environmentId, deviceConfiguration, appDetails
        });

        const runId = await executeTest(gatewayUrl, testObject.apiKey, teamId, payload);
        console.log('\x1b[32m%s\x1b[0m', 'Triggered the test suite', testObject.testSuiteName, 'Successfully!');

        const finalStatus = await pollExecutionStatus(gatewayUrl, testObject.apiKey, teamId, runId);
        await reportResult(gatewayUrl, testObject.apiKey, teamId, finalStatus, testObject.testSuiteName);
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', `ERROR : ${error.message}`);
        process.exit(1);
    }
}

/* -------------------------------------------------- */
/* ---------------- DEVICE RESOLUTION --------------- */
/* -------------------------------------------------- */

/**
 * An app activity is Android-only, so its absence means the run targets iOS.
 */
function deviceTypeFor(appActivity) {
    return appActivity == null || appActivity === '' ? 'IOS' : 'ANDROID';
}

async function resolveDevices(gatewayUrl, apiKey, teamId, devicePoolId, deviceType) {
    const path = devicePoolId != null
        ? `${gateway.MOBILITY_CONTEXT}/api/devices-in-pool/${devicePoolId}`
        : `${gateway.MOBILITY_CONTEXT}/api/get-all-available-devices-for-project?deviceType=${deviceType}&teamId=${teamId}`;

    const devices = await gateway.getJson(gatewayUrl, apiKey, teamId, path, 'devices');

    // Shared devices cannot be claimed by a first-available run.
    const usable = devicePoolId != null ? devices : devices.filter((d) => d.isSharedDevice !== true);

    // The service expects each device as a JSON string, not an object.
    const deviceConfiguration = usable.map((device) => JSON.stringify({
        deviceId: device.sauceId,
        deviceDataCenter: device.deviceDataCenter,
        deviceVersion: device.version,
        deviceName: device.deviceName
    }));

    if (deviceConfiguration.length === 0) throw new Error('Unable to find devices to run execution!');
    return deviceConfiguration;
}

/* -------------------------------------------------- */
/* ---------------- APP RESOLUTION ------------------ */
/* -------------------------------------------------- */

/**
 * An app name means the app was uploaded to Qyrus and needs its record
 * (appLocation, resolved appPackage) looked up. Runs against a pre-installed
 * app skip this and identify the app by appPackage or bundleId instead.
 */
function requiresAppLookup(testObject) {
    return testObject.appFileName !== '';
}

async function resolveAppDetails(gatewayUrl, apiKey, teamId, projectId, appFileName) {
    const apps = await gateway.listApps(gatewayUrl, apiKey, teamId, projectId);
    const app = apps.find((entry) => gateway.matchesName(entry.apkName, appFileName));
    if (!app) {
        throw new Error('Unable to find app with the given name! Please verify given app exists on Qyrus.');
    }
    return {
        appUuid: app.uuid,
        appPackage: app.apkPackage != null ? app.apkPackage : '',
        appLocation: app.apkLocation,
        appName: app.apkName
    };
}

/* -------------------------------------------------- */
/* ---------------- EXECUTION ----------------------- */
/* -------------------------------------------------- */

function buildExecutePayload(testObject, context) {
    const { login, projectId, suiteId, environmentId, deviceConfiguration, appDetails } = context;

    const payload = {
        testScriptID: '',
        userEmail: login,
        testSuiteId: suiteId,
        isEmail: false,
        projectId: projectId,
        appActivity: testObject.appActivity,
        appPackage: testObject.appPackage,
        appLocation: null,
        deviceConfiguration: deviceConfiguration,
        configuration: null,
        isExtraValue: false,
        isDryRun: false,
        isHealer: false,
        resetApp: true,
        installFlag: false,
        bundleId: testObject.bundleId !== '' ? testObject.bundleId : null,
        useFirstAvailableDevice: testObject.useFirstAvailableDevice,
        globalVariableEnvironmentId: environmentId,
        pluginName: 'AZURE'
    };

    if (appDetails != null) {
        payload.appPackage = appDetails.appPackage;
        payload.appLocation = appDetails.appLocation;
        payload.installFlag = true;
        payload.bundleId = testObject.bundleId;
    }

    return payload;
}

async function executeTest(gatewayUrl, apiKey, teamId, payload) {
    const path = `${gateway.MOBILITY_CONTEXT}/api/execute-test`;
    const response = await gateway.postJson(gatewayUrl, apiKey, teamId, path, payload);

    if (![200, 202].includes(response.statusCode)) {
        throw new Error(`Execution trigger failed — ${gateway.describeFailure('POST', path, response, JSON.stringify(payload))}`);
    }

    const data = JSON.parse(response.body);
    if (!data.uuid) throw new Error('Run ID absent in execution response.');
    return data.uuid.toString();
}

/* -------------------------------------------------- */
/* ---------------- POLLING ------------------------- */
/* -------------------------------------------------- */

async function pollExecutionStatus(gatewayUrl, apiKey, teamId, runId) {
    while (true) {
        const data = await gateway.getJson(gatewayUrl, apiKey, teamId,
            `${gateway.MOBILITY_CONTEXT}/api/test-status?runId=${runId}`, 'execution status');

        if (data.executionStatus === 'COMPLETED') return data;

        const label = STATUS_LABELS[data.executionStatus];
        if (label) console.log('Current execution status:', label);

        await new Promise((resolve) => setTimeout(resolve, gateway.POLL_INTERVAL));
    }
}

/* -------------------------------------------------- */
/* ---------------- REPORT -------------------------- */
/* -------------------------------------------------- */

async function reportResult(gatewayUrl, apiKey, teamId, statusData, suiteName) {
    if (statusData.status != null && statusData.status.toUpperCase() === 'ERROR IN RUN') {
        console.log('\x1b[31m%s\x1b[0m', 'Unable to execute test suite', suiteName);
        console.log('\x1b[31m%s\x1b[0m', "Cause of error:", statusData.errorMessage);
        process.exit(1);
    }

    const reportUrl = await buildReportUrl(gatewayUrl, apiKey, teamId, statusData);

    if (statusData.status === 'Pass') {
        console.log('\x1b[32m%s\x1b[0m', 'Execution of test suite', suiteName, 'is now complete!');
        console.log('\x1b[32m%s\x1b[0m', "Test Passed! Click on the below link to download the run report");
        console.log('\x1b[34m%s\x1b[0m', reportUrl);
        process.exit(0);
    }

    console.log('\x1b[31m%s\x1b[0m', 'Execution of test suite', suiteName, 'is now complete!');
    console.log('\x1b[31m%s\x1b[0m', "Test Failed! Click on the below link to download the run report");
    console.log(reportUrl);
    process.exit(1);
}

/**
 * Reports live behind a signed CloudFront URL; the service supplies both the
 * domain and the signature query string.
 */
async function buildReportUrl(gatewayUrl, apiKey, teamId, statusData) {
    const organizationId = statusData.organization;
    const runId = statusData.uuid;

    const path = `${gateway.MOBILITY_CONTEXT}/api/get-cdn-access-for-reports` +
        `?organizationId=${organizationId}&runId=${runId}`;
    const access = await gateway.getJson(gatewayUrl, apiKey, teamId, path, 'report access');

    return `https://${access.cloudFrontDomain}/${organizationId}/${runId}/${statusData.name}.zip${access.signature}`;
}

/* -------------------------------------------------- */
/* ---------------- INPUT RESOLUTION ---------------- */
/* -------------------------------------------------- */

function resolveTestObject(flags, fromFile) {
    const config = fromFile != null ? gateway.readConfigFile(fromFile) : null;

    const testObject = {
        apiKey: gateway.resolveOption(flags.apiKey, config?.configuration?.apiKey),
        teamName: gateway.resolveOption(flags.teamName, config?.suiteInfo?.teamName),
        projectName: gateway.resolveOption(flags.projectName, config?.suiteInfo?.projectName),
        testSuiteName: gateway.resolveOption(flags.testSuiteName, config?.suiteInfo?.suiteName),
        devicePoolName: gateway.resolveOption(flags.devicePoolName, config?.executionInfo?.devicePoolName, ''),
        appFileName: gateway.resolveOption(flags.appFileName, config?.appInfo?.appName, ''),
        appActivity: gateway.resolveOption(flags.appActivity, config?.appInfo?.appActivity, ''),
        appPackage: gateway.resolveOption(flags.appPackage, config?.appInfo?.appPackage, ''),
        bundleId: gateway.resolveOption(flags.bundleId, config?.appInfo?.bundleId, ''),
        envName: gateway.resolveOption(flags.envName, config?.executionInfo?.envName, ''),
        enableDebug: gateway.resolveOption(flags.enableDebug, config?.executionInfo?.enableDebug)
    };

    testObject.useFirstAvailableDevice = resolveFirstAvailableDevice(flags.firstAvailable, config);

    if (invalidValue(testObject.apiKey)) {
        throw new Error('Invalid apiKey. Provide it with --apiKey or in your configuration file.');
    }
    const missing = ['teamName', 'projectName', 'testSuiteName'].filter((field) => invalidValue(testObject[field]));
    if (missing.length > 0) {
        throw new Error(`Invalid suite info. Check: ${missing.join(', ')}.`);
    }

    validateDevicePoolValue(testObject.useFirstAvailableDevice, testObject.devicePoolName);
    return testObject;
}

function resolveFirstAvailableDevice(firstAvailable, config) {
    if (firstAvailable != null) return firstAvailable.toString().toLowerCase() === 'yes';

    const fromConfig = config?.executionInfo?.firstAvailableDevice;
    if (fromConfig == null) return false;

    validateFirstAvailableDeviceValue(fromConfig);
    return fromConfig.toString().toLowerCase() === 'yes';
}

function validateFirstAvailableDeviceValue(firstAvailable) {
    if (firstAvailable == null || invalidValueForFirstAvailableDevice(firstAvailable)) {
        console.error('ERROR : Invalid value for first available device:', firstAvailable);
        process.exit(1);
    }
}

function invalidValueForFirstAvailableDevice(firstAvailable) {
    const value = firstAvailable?.toString()?.toLowerCase();
    return value != 'yes' && value != 'no';
}

function validateDevicePoolValue(useFirstAvailableDevice, devicePoolName) {
    if (!useFirstAvailableDevice && (devicePoolName == null || devicePoolName == '')) {
        console.error('ERROR : Device pool name is missing');
        process.exit(1);
    }
}

function invalidValue(data) {
    return data == null || data.toString() == '';
}

function printDebugInformation(testObject, gatewayUrl) {
    if (testObject.enableDebug != 'yes') return;

    const parsed = new URL(gatewayUrl);
    console.log('******* QYRUS Cloud - INPUT PARAMETERS *******');
    console.log('App Name :', testObject.appFileName);
    console.log('Team Name :', testObject.teamName);
    console.log('Project Name :', testObject.projectName);
    console.log('Suite Name :', testObject.testSuiteName);
    console.log('App Activity :', testObject.appActivity);
    console.log('App Package :', testObject.appPackage);
    console.log('Bundle ID :', testObject.bundleId);
    console.log('Device Pool Name :', testObject.devicePoolName);
    console.log('Environment Name :', testObject.envName);
    console.log('Host Name :', parsed.hostname);
    console.log('Port :', parsed.port);
    console.log('First available device: ', testObject.useFirstAvailableDevice ? "yes" : "no");
}

module.exports = {
    trigger
}
