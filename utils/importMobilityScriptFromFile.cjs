const fs = require('fs');
const http = require('http');
const https = require('https');
const FormData = require('form-data');

const contextPath = '/cli-adapter-mobility/v1';

const trigger = function (URL, username, password, teamName, projectName, suiteName, scriptFilePath, configurationFilePath) {
    let inputData = {
        URL: URL,
        username: username,
        password: password,
        teamName: teamName,
        projectName: projectName,
        suiteName: suiteName,
        scriptFilePath: scriptFilePath
    }
    if(configurationFilePath != null)
        inputData = readInputDataFromFile(inputData, configurationFilePath);
    if (fs.existsSync(inputData.scriptFilePath)) {
        callAPIToImportScriptFromFile(inputData);
    }
    else {
        console.log('File to import script not found!');
        process.exitCode = 1;
        return;
    }
}

function readInputDataFromFile(inputData, configurationFilePath) {
    let configurationFileData;
    let fileData = fs.readFileSync(configurationFilePath, (err, file) => {
        if (err) {
            console.error("There was an error while trying to read your file.  Check your file and filepath.");
            process.exit(1);
        }
        return file;
    })
    try {
        configurationFileData = JSON.parse(fileData);
    }
    catch (error) {
        console.error("Could not parse your JSON file.  Check your configuration.");
        process.exit(1);
    }
    inputData = setInputDataFromConfigurationFile(inputData, configurationFileData);
    validateConfigurationInfo(inputData);
    validateScriptInfo(inputData);
    return inputData;
}

function setInputDataFromConfigurationFile(inputData, configurationFileData) {
    if (inputData.URL == null)
        inputData.URL = configurationFileData.configuration.endpoint;
    if (inputData.username == null)
        inputData.username = configurationFileData.configuration.username;
    if (inputData.password == null)
        inputData.password = configurationFileData.configuration.passcode;
    if (inputData.teamName == null)
        inputData.teamName = configurationFileData.scriptInfo.teamName;
    if (inputData.projectName == null)
        inputData.projectName = configurationFileData.scriptInfo.projectName;
    if (inputData.suiteName == null)
        inputData.suiteName = configurationFileData.scriptInfo.suiteName;
    if (inputData.scriptFilePath == null)
        inputData.scriptFilePath = configurationFileData.scriptInfo.scriptFilePath;
    return inputData;
}

function validateConfigurationInfo(inputData) {
    const invalidConfigurationInfo = invalidValue(inputData.URL) || invalidValue(inputData.username) || invalidValue(inputData.password);
    if (invalidConfigurationInfo) {
        console.error('ERROR : Invalid login info.  Check your username, password and login URL.');
        process.exit(1);
    }
}

function invalidValue(data) {
    return data == null || data.toString() == '';
}

function validateScriptInfo(inputData) {
    const invalidScriptInfo = invalidValue(inputData.teamName) || invalidValue(inputData.projectName) || invalidValue(inputData.suiteName) || invalidValue(inputData.scriptFilePath);
    if (invalidScriptInfo) {
        console.error('ERROR : Invalid script info for importing script from file');
        process.exit(1);
    }
}

function callAPIToImportScriptFromFile(inputData) {
    console.log("Importing script...");
    const formData = buildFormData(inputData);
    const options = buildAPIOptions(inputData, formData.getHeaders());
    const request = https.request(options, (response) => {
        let responseBody = '';
        response.on('data', chunk => {
            responseBody += chunk.toString();
        });
        response.on('end', () => {   
            provideUserFeedbackAfterAPICompletion(response.statusCode, responseBody)
        });
    });
    request.on('error', (error) => {
        console.log('Error making API request:', error.message);
        process.exitCode = 1;
    });
    formData.pipe(request);
}

function buildFormData(inputData) {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(inputData.scriptFilePath));
    formData.append('username', inputData.username);
    formData.append('password', inputData.password);
    formData.append('teamName', inputData.teamName);
    formData.append('projectName', inputData.projectName);
    formData.append('suiteName', inputData.suiteName);
    return formData;
}

function buildAPIOptions(inputData, headers) {
    const url = new URL(inputData.URL);
    const options = {
        host: url.hostname,
        port: url.port,
        path: `${contextPath}/import-script-from-file`,
        headers: headers,
        method: 'POST',
        rejectUnauthorized: false
    };
    return options;
}

function provideUserFeedbackAfterAPICompletion(statusCode, responseBody) {
    if (statusCode != 200) {
        console.log('\x1b[31m%s\x1b[0m', 'Failed to import script from file!');
        console.log('\x1b[31m%s\x1b[0m', 'Cause of error:', responseBody);
        process.exitCode = 1;
    } 
    else {
        console.log('\x1b[32m%s\x1b[0m', responseBody)
        process.exitCode = 0;
    }
}

module.exports = {
    trigger
}