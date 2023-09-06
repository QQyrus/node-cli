const fs = require('fs');
const https = require('https')
const http = require('http')
const request = require('request')
const path = require('path')
const url = require('url')
const { exec } = require("child_process");

let baseContext = '/cli-adapter-mobility/v1';

const trigger = function(gatewayUrl, qyrus_username, qyrus_password, 
    qyrus_team_name, qyrus_project_name, qyrus_suite_name, appName, 
    app_activity, device_pool_name, enable_debug, bundle_id, emailId, appPackage, envName, firstAvailable, fromFile) {    
    
    
    let configuration;
    let testObject = {
        "userName": qyrus_username,
        "encodedPassword": qyrus_password,
        "teamName": qyrus_team_name,
        "projectName": qyrus_project_name,
        "testSuiteName": qyrus_suite_name,
        "devicePoolName": device_pool_name,
        "appFileName": appName,
        "appActivity": app_activity,
        "appPackage": appPackage,
        "bundleId": bundle_id,
        "envName": envName,
        "useFirstAvailableDevice": firstAvailable != null && firstAvailable.toLowerCase() == 'yes'
    }    
    
    if(fromFile != null)
        configuration = getFileResults(fromFile)               
    testObject = setTestObjectData(testObject,configuration);
    gatewayUrl = gatewayUrl != null ? gatewayUrl : configuration.configuration.endpoint
    validateConfigurationInfo(testObject.userName, testObject.encodedPassword,gatewayUrl);
    
    let apiCallConfig = buildAPICallConfiguration(gatewayUrl)
    enableDebug = enable_debug != null ? enable_debug : configuration.executionInfo.enableDebug
    printDebugInformation(enableDebug, testObject, apiCallConfig)    

    console.log('\x1b[32m%s\x1b[0m',"Getting your environment ready, your test will start running soon.");


    var reqPost = https.request ( apiCallConfig, function(response) {
        let responseBody = '';
        response.on('data', chunk => {
            responseBody += chunk.toString();
        });
        response.on('end', () => {
            if (response.statusCode != 200) {
                // const message = JSON.parse(responseBody).message;
                console.error(responseBody);
                process.exitCode = 1;
                return;
            }
            console.log('\x1b[32m%s\x1b[0m','Triggered the test suite', testObject.testSuiteName,'Successfully!');
            // console.log('\x1b[32m%s\x1b[0m','Execution of test suite ', testObject.testSuiteName,' is in progress.');
            checkExecStatus(apiCallConfig.host, apiCallConfig.port, responseBody, testObject.testSuiteName, emailId);
        });
    });
    reqPost.on('error', function(error) {
        console.log('Error making api request, try again.', error);
        process.exitCode = 1;
        return;
    });
    reqPost.write(JSON.stringify(testObject));
    reqPost.end();

}

function getFileResults(fromFile) {
    let fileInfo = fs.readFileSync(`../${fromFile}`, (err,file) => {
        if (err) {
            console.error("There was an error while trying to read your file.  Check your file and filepath.")  
            process.exit(1)
        }       
        return file         
    })

    try{
         return JSON.parse(fileInfo)             
    }
    catch(error){
        console.error("Could not parse your JSON file.  Check your configuration.")
        process.exit(1)
    }     
}

function setTestObjectData(testObject, configuration) {   
    if(testObject.userName == null)
        testObject["userName"] = configuration.configuration.username
    if(testObject.encodedPassword == null)
        testObject["encodedPassword"] = configuration.configuration.passcode
    if(testObject.teamName == null)
        testObject["teamName"] = configuration.suiteInfo.teamName
    if(testObject.projectName == null)
        testObject["projectName"] = configuration.suiteInfo.projectName
    if(testObject.testSuiteName == null)
        testObject["testSuiteName"]= configuration.suiteInfo.suiteName
    if(testObject.devicePoolName == null)
        testObject["devicePoolName"] = configuration.executionInfo.devicePoolName
    if(testObject.appFileName == null)
        testObject["appFileName"] = configuration.appInfo.appName != null ? configuration.appInfo.appName : ''
    if(testObject.appActivity == null)
        testObject["appActivity"] = configuration.appInfo.appActivity != null ? configuration.appInfo.appActivity : ''
    if(testObject.appPackage == null)
        testObject["appPackage"] = configuration.appInfo.appPackage != null ? configuration.appInfo.appPackage : ''
    if(testObject.bundleId == null) 
        testObject["bundleId"] = configuration.appInfo.bundleId != null ? configuration.appInfo.bundleId : ''
    if(testObject.envName == null)
        testObject["envName"] = configuration.executionInfo.envName != null ? configuration.executionInfo.envName : ''
    let firstAvailable = testObject.firstAvailable;
    if(firstAvailable == null) {
        firstAvailable = configuration.executionInfo.firstAvailableDevice
        testObject["useFirstAvailableDevice"] = firstAvailable != null ? firstAvailable.toString().toLowerCase() == 'yes' : false;   
    }
    validateFirstAvailableDeviceValue(firstAvailable);
    validateDevicePoolValue(testObject.useFirstAvailableDevice, testObject.devicePoolName);
    return testObject;
}

function validateFirstAvailableDeviceValue(firstAvailable) {
    const invalidValue = firstAvailable == null || (firstAvailable.toLowerCase() != 'yes' && firstAvailable.toLowerCase() != 'no');
    if(invalidValue) {
        console.error('ERROR : Invalid value for first available device:', firstAvailable);
        process.exit(1);
    }
}

function validateDevicePoolValue(useFirstAvailableDevice, devicePoolName) {
    const invalidValue = !useFirstAvailableDevice && (devicePoolName == null || devicePoolName == '');
    if(invalidValue) {
        console.error('ERROR : Device pool name is missing');
        process.exit(1);
    }
}

function validateConfigurationInfo  (username,password,URL)
{
    if ( username == null || password == null || URL == null ) {
        console.error('ERROR : Invalid login info.  Check your username, password and login URL.');
        process.exit(1);
    }
}

function buildAPICallConfiguration(gatewayUrl) {
    console.log("building this ", gatewayUrl)
    const gatewayURLParse = new URL(gatewayUrl);
    let host_name = gatewayURLParse.hostname;
    let port = gatewayURLParse.port;
    let apiCallConfig = {
        host: host_name,
        port: port,
        path: baseContext+'/mobilityTrigger',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        rejectUnauthorized: false
    }
    return apiCallConfig
}

function printDebugInformation(enableDebug,testObject, apiCallConfig) {
    if ( enableDebug == 'yes' ) {
        console.log('******* QYRUS Cloud - INPUT PARAMETERS *******');
        console.log('App Name :',testObject.appFileName);
        console.log('Username :',testObject.userName);
        console.log('Password :',testObject.encodedPassword);
        console.log('Team Name :',testObject.teamName);
        console.log('Project Name :',testObject.projectName);
        console.log('Suite Name :',testObject.testSuiteName);
        console.log('App Activity :',testObject.appActivity);
        console.log('Bundle ID :',testObject.bundleId);
        console.log('Device Pool Name :' ,testObject.devicePoolName);
        console.log('Host Name :', apiCallConfig.host);
        console.log('Port :',apiCallConfig.port);
        console.log('First available device: ', testObject.useFirstAvailableDevice ? "yes" : "no");
    }
}

//method to check the execution status
function checkExecStatus (host_name, port, testRunResponseBody, qyrus_suite_name, emailId) {
    let apiCallConfig = {
        host: host_name,
        port: port,
        path: baseContext+'/checkExecutionStatus',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    }
    var reqPost = https.request(apiCallConfig, function(response) {
        let responseBody = '';
        response.on('data', chunk => {
            responseBody += chunk.toString(); // convert Buffer to string
        });
        response.on('end', () => {   
            if(response.statusCode!=200){
                console.log(responseBody);
                process.exitCode = 1;
                return;
            }
            if(responseBody.trim().toUpperCase() === "COMPLETED"){
                completedTest(host_name, port, testRunResponseBody, qyrus_suite_name, emailId);
                return;
            }
            else {
                console.log('Current execution status:', responseBody);
                setTimeout(() => {  checkExecStatus(host_name, port, testRunResponseBody, qyrus_suite_name, emailId); }, 30000);
            }
        });
    });
    reqPost.on('error', function(error) {
        console.log("Error in checking the execution status : "+error);
        process.exitCode = 1;
        return;
    });
    reqPost.write(testRunResponseBody);
    reqPost.end();
}

//run the below method if the test status is completed.
function completedTest (host_name, port, execStatusResponse, qyrus_suite_name, emailId) {
    let apiCallConfig = {
        host: host_name,
        port: port,
        path: baseContext+'/checkExecutionResult?emailId='+emailId,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    }
    var reqPost = https.request(apiCallConfig, function(response) {
        if(response.statusCode!=200){
            console.log('Failed to run test, Try again.');
            return;
        }

        let responseBody = '';
        response.on('data', chunk => {
            responseBody += chunk.toString(); // convert Buffer to string
        });
        response.on('end', () => {
            var parsedJson = JSON.parse(responseBody);
            let exitCode = 1;
            if (parsedJson.finalStatus === 'Pass' ) {
                console.log('\x1b[32m%s\x1b[0m','Execution of test suite', qyrus_suite_name, 'is now complete!');
                console.log('\x1b[32m%s\x1b[0m',"Test Passed! Click on the below link to download the run report");
                console.log('\x1b[34m%s\x1b[0m',parsedJson.report);
                exitCode = 0;
                return;
            }
            else if(parsedJson.finalStatus === 'Error in Test') {
                console.log('\x1b[31m%s\x1b[0m','Unable to execute test suite', qyrus_suite_name);
                console.log('\x1b[31m%s\x1b[0m',"Cause of error:", parsedJson.errorMessage);
            }
            else {
                console.log('\x1b[31m%s\x1b[0m','Execution of test suite', qyrus_suite_name, 'is now complete!');
                console.log('\x1b[31m%s\x1b[0m',"Test Failed! Click on the below link to download the run report");
                console.log(parsedJson.report);   
            }
            process.exitCode = exitCode;
            return;
        });
    });
    reqPost.on('error', function(error) {
        console.error("Error in checking the execution status : "+error);
        process.exitCode = 1;
        return;
    });
    reqPost.write(execStatusResponse);
    reqPost.end();
}

module.exports = {
    trigger
}