var request = require('request');
const fs = require('fs');

const trigger = function(gatewayUrl, qyrus_username, qyrus_password, qyrus_team_name, qyrus_project_name, appName, execCmd, configurationFilePath) {
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
        appName: appName
    }
    if(configurationFilePath != null)
        inputData = readInputDataFromFile(inputData, configurationFilePath);
    console.log("App - "+inputData.appName+" removal in progress...");
    var options = {
        'method': 'POST',
        'url': inputData.URL+contextPath+'/deleteApp?username='+inputData.username+'&password='+inputData.password+'&teamName='+inputData.teamName+'&projectName='+inputData.projectName+'&appName='+inputData.appName,
        'headers': {
        },
        'rejectUnauthorized': false
    };

    if(execCmd === 'rover'){
        contextPath = '/cli-adapter-rover/v1'; 
        options = {
            'method': 'DELETE',
            'url': inputData.URL+contextPath+'/deleteApp?username='+inputData.username+'&password='+inputData.password+'&teamName='+inputData.teamName+'&projectName='+inputData.projectName+'&appName='+inputData.appName,
            'headers': {
            },
            'rejectUnauthorized': false
        };
    }
    request(options, function (error, response) {
        if (response.statusCode !=200) {
            console.log('Failed to delete app! Try again.');
            process.exitCode = 1;
            throw new Error(error);
        }
        console.log(response.statusCode)
        console.log("App - "+inputData.appName+" Deleted Sucessfully!");
        process.exitCode = 0;
    });
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
    if (inputData.appName == null)
        inputData.appName = configurationFileData.appInfo.appName;
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
    const invalidScriptInfo = invalidValue(inputData.teamName) || invalidValue(inputData.projectName) || invalidValue(inputData.appName);
    if (invalidScriptInfo) {
        console.error('ERROR : Invalid app info');
        process.exit(1);
    }
}

module.exports = {
    trigger
}