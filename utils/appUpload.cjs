const fs = require('fs');
const request = require('request')
const path = require('path')

const trigger = function(gatewayUrl, qyrus_username, qyrus_password,
    qyrus_team_name, qyrus_project_name, appPath,appType, execCmd, configurationFilePath) {
    
    var contextPath = '/cli-adapter-component/v1';
    if ( execCmd === 'mobility' ) {
        contextPath = '/cli-adapter-mobility/v1';
    }
    let inputData = {
        URL: gatewayUrl,
        username: qyrus_username,
        password: qyrus_password,
        teamName: qyrus_team_name,
        projectName: qyrus_project_name,
        appPath: appPath,
        appType: appType
    }
    if(configurationFilePath != null)
        inputData = readInputDataFromFile(inputData, configurationFilePath);

    var appPath = inputData.appPath;
    //upload the app
    if ( fs.existsSync(appPath) ) {
        console.log("Uploading app...");
        if( execCmd === 'rover' ){
            contextPath = '/cli-adapter-rover/v1';
            request.post({
                url: inputData.URL+contextPath+"/uploadApp",
                formData: {
                    file: fs.createReadStream(appPath),
                    username: inputData.username,
                    password: inputData.password,
                    teamName: inputData.teamName,
                    projectName: inputData.projectName.trim(),
                    appType: inputData.appType
                    
                },
            },
                function(error,response) {
                    returnStatus(error,response,appPath);
                });
        }else{
            request.post({
                url: inputData.URL+contextPath+"/uploadApp",
                formData: {
                    file: fs.createReadStream(appPath),
                    username: inputData.username,
                    password: inputData.password,
                    teamName: inputData.teamName,
                    projectName: inputData.projectName.trim(),
                },
            },
                function(error,response) {
                    returnStatus(error,response,appPath);
                });
        }
        
    } else {
        console.log('App not found in artifacts!');
        process.exitCode = 1;
        return;
    } 
}

function returnStatus (error,response,appPath) {
    if (response.statusCode!=200) {
        console.log('Failed to upload app! Try again.');
        console.log(response.body);
        process.exitCode = 1;
        return;
    } else {
        var appName = path.parse(appPath).base;
        console.log("App - "+appName+" uploaded to Qyrus successfully!");
        process.exitCode = 0;
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
    validateAppInfo(inputData);
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
        inputData.teamName = configurationFileData.appInfo.teamName;
    if (inputData.projectName == null)
        inputData.projectName = configurationFileData.appInfo.projectName;
    if (inputData.appPath == null)
        inputData.appPath = configurationFileData.appInfo.appPath;
    if (inputData.appType == null)
        inputData.appType = configurationFileData.appInfo.appType;
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

function validateAppInfo(inputData) {
    const invalidScriptInfo = invalidValue(inputData.teamName) || invalidValue(inputData.projectName) || invalidValue(inputData.appPath);
    if (invalidScriptInfo) {
        console.error('ERROR : Invalid app info');
        process.exit(1);
    }
}

module.exports = {
    trigger
}