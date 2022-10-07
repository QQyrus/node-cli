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
    app_activity, device_pool_name, enable_debug, bundle_id, emailId, appPackage, envName) {
    
    const gatewayURLParse = new URL(gatewayUrl);
    let host_name = gatewayURLParse.hostname;
    let port = gatewayURLParse.port;

    // testing parameters
    if ( qyrus_username == null || qyrus_password == null || gatewayUrl == null ) {
        console.log('ERROR : One or more parameters are invalid');
        process.exitCode = 1;
    }

    if ( app_activity == null ) {
        app_activity = '';
    }

    if ( bundle_id == null ) {
        bundle_id = '';
    }

    if ( appName == null ) {
        appName = '';
    }

    if ( appPackage == null ) {
        appPackage = '';
    }

    if ( envName == null ) {
        envName = '';
    }

    if ( enable_debug == 'yes' ) {
        console.log('******* QYRUS Cloud - INPUT PARAMETERS *******');
        console.log('App Name :',appName);
        console.log('Username :',qyrus_username);
        console.log('Password :',qyrus_password);
        console.log('Team Name :',qyrus_team_name);
        console.log('Project Name :',qyrus_project_name);
        console.log('Suite Name :',qyrus_suite_name);
        console.log('App Activity :',app_activity);
        console.log('Bundle ID :',bundle_id);
        console.log('Device Pool Name :',device_pool_name);
        console.log('Host Name :',host_name);
        console.log('Port :',port);
    }

    let apiCallConfig = {
        host: host_name,
        port: port,
        path: baseContext+'/mobilityTrigger',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    }
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
        "envName": envName
    }

    console.log('\x1b[32m%s\x1b[0m',"Getting your environment ready, your test will start running soon.");

    var reqPost = https.request ( apiCallConfig, function(response) {
        if (response.statusCode != 200) {
            console.log("Failed to run test, Try again.");
            process.exitCode = 1;
            return;
        }
        console.log('\x1b[32m%s\x1b[0m','Triggerd the test suite ', qyrus_suite_name,' Successfully!');
        let responseBody = '';
        response.on('data', chunk => {
            responseBody += chunk.toString();
        });
        response.on('end', () => {
            console.log('\x1b[32m%s\x1b[0m','Execution of test suite ', qyrus_suite_name,' is in progress.');
            checkExecStatus(host_name, port, responseBody, qyrus_suite_name, emailId);
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
        if(response.statusCode!=200){
            console.log('Failed to run check execution status fully, Try again.');
            process.exitCode = 1;
            return;
        }
        let responseBody = '';
        response.on('data', chunk => {
            responseBody += chunk.toString(); // convert Buffer to string
        });
        response.on('end', () => {   
            if(responseBody.trim() === "COMPLETED"){
                completedTest(host_name, port, testRunResponseBody, qyrus_suite_name, emailId);
                return;
            }
            else {
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
            if (parsedJson.finalStatus === 'Pass' ) {
                console.log('\x1b[32m%s\x1b[0m','Execution of test suite ',qyrus_suite_name,' is now complete!');
                console.log('\x1b[32m%s\x1b[0m',"Test Passed! Click on the below link to download the run report");
                console.log('\x1b[34m%s\x1b[0m',parsedJson.report);
                process.exitCode = 0;
                return;
            } else {
                console.log('\x1b[31m%s\x1b[0m','Execution of test suite ',qyrus_suite_name,' is now complete!');
                console.log('\x1b[31m%s\x1b[0m',"Test Failed! Click on the below link to download the run report");
                console.log(parsedJson.report);
                process.exitCode = 1;
                return;
            }
        });
    });
    reqPost.on('error', function(error) {
        console.log("Error in checking the execution status : "+error);
        process.exitCode = 1;
        return;
    });
    reqPost.write(execStatusResponse);
    reqPost.end();
}

module.exports = {
    trigger
}