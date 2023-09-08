var request = require('request');
const fs = require('fs');

const trigger = function(gatewayUrl, qyrus_team_name, qyrus_project_name, execCmd, configurationFilePath) {
    console.log("Fetching the app names in progress...");
    let inputData = {
        URL: gatewayUrl,
        teamName: qyrus_team_name,
        projectName: qyrus_project_name,
    }
    if(configurationFilePath != null)
        inputData = readInputDataFromFile(inputData, configurationFilePath);
    if ( execCmd === 'mobility' ) {
        var contextPath = '/cli-adapter-mobility/v1';
    }
    var options = {
        'method': 'GET',
        'url': inputData.URL+contextPath+'/getapk?teamName='+inputData.teamName+'&projectName='+inputData.projectName
    };
    request(options, function (error, response) {
        if (response.statusCode !=200) {
            console.log('Failed to fetch app details! Try again.');
            process.exitCode = 1;
            throw new Error(error);
        }
        console.log(response.body);
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
    validateInputData(inputData);
    return inputData;
}

function setInputDataFromConfigurationFile(inputData, configurationFileData) {
    if (inputData.URL == null)
        inputData.URL = configurationFileData.configuration.endpoint;
    if (inputData.teamName == null)
        inputData.teamName = configurationFileData.projectInfo.teamName;
    if (inputData.projectName == null)
        inputData.projectName = configurationFileData.projectInfo.projectName;
    return inputData;
}

function validateInputData(inputData) {
    const invalidConfigurationInfo = invalidValue(inputData.URL) || invalidValue(inputData.teamName) || invalidValue(inputData.projectName);
    if (invalidConfigurationInfo) {
        console.error('ERROR : Invalid input data');
        process.exit(1);
    }
}

function invalidValue(data) {
    return data == null || data.toString() == '';
}

module.exports = {
    trigger
}