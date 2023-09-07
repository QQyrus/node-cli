const fs = require('fs');
const request = require('request');

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
    request.post({
        url: `${inputData.URL}${contextPath}/import-script-from-file`,
        formData: {
            file: fs.createReadStream(inputData.scriptFilePath),
            username: inputData.username,
            password: inputData.password,
            teamName: inputData.teamName,
            projectName: inputData.projectName,
            suiteName: inputData.suiteName
        }
    },
        (error, response) => {
            if (response.statusCode != 200) {
                console.log('\x1b[31m%s\x1b[0m', 'Failed to import script from file!');
                console.log('\x1b[31m%s\x1b[0m', 'Error:', response.body);
                process.exitCode = 1;
                return;
            } 
            else {
                console.log('\x1b[32m%s\x1b[0m', response.body)
                process.exitCode = 0;
            }
        }
    )
}

module.exports = {
    trigger
}