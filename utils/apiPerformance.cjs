const fs = require('fs');
const https = require('https')
const http = require('http')
const request = require('request')
const path = require('path')
const url = require('url')
const { exec } = require("child_process");

let baseContext = '/cli-adapter-api-performance/v1';

const trigger = function(gatewayUrl, username, password, team_name, project_name, testSuiteName, testScriptName, environmentVariableName, thread, latencyThreshold, emailId, enable_debug) {
    
    const gatewayURLParse = new URL(gatewayUrl);
    let host_name = gatewayURLParse.hostname;
    let port = gatewayURLParse.port;

    // testing parameters
    if ( username == null || password == null || gatewayUrl == null || team_name == null || project_name == null || testSuiteName == null || testScriptName == null || environmentVariableName == null || thread == null || latencyThreshold == null ) {
        console.log('ERROR : One or more parameters are invalid');
        process.exitCode = 1;
    }

    if ( username == null ) {
        username = '';
    }

    if ( password == null ) {
        password = '';
    }

    if ( gatewayUrl == null ) {
        gatewayUrl = '';
    }

    if ( team_name == null ) {
        team_name = '';
    }

    if ( project_name == null ) {
        project_name = '';
    }

    if ( testSuiteName == null ) {
        testSuiteName = '';
    }

    if ( testScriptName == null ) {
        testScriptName = '';
    }
    if( environmentVariableName == null){
        environmentVariableName = ''
    }
    
    if ( thread == null ) {
        thread = '';
    }

    if ( latencyThreshold == null ) {
        latencyThreshold = '';
    }

    if ( enable_debug == 'yes' ) {
        console.log('******* QYRUS Cloud - INPUT PARAMETERS *******');
        console.log('Username :',username);
        console.log('Password :',password);
        console.log('Team Name :',team_name);
        console.log('Project Name :',project_name);
        console.log('testSuiteName :',testSuiteName);
        console.log('testScriptName :',testScriptName);
        console.log('environmentVariableName :', environmentVariableName);
        console.log('thread :',thread);
        console.log('latencyThreshold :',latencyThreshold);
        console.log('Host Name :',host_name);
        console.log('Port :',port);
        console.log('emailId :',emailId);
    }

    let apiCallConfig = {
        host: host_name,
        port: port,
        path: baseContext+'/apiPerformanceTrigger',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    }
    let testObject = {
        "userName": username,
        "encodedPassword": password,
        "teamName": team_name,
        "projectName": project_name,
        "testSuiteName": testSuiteName,
        "testScriptName": testScriptName,
        "environmentVariableName": environmentVariableName,
        "thread": thread,
        "latencyThreshold": latencyThreshold
    }

    console.log('\x1b[32m%s\x1b[0m',"Getting your environment ready, your test will start running soon.");

    var reqPost = https.request ( apiCallConfig, function(response) {
        if (response.statusCode != 200) {
            console.log("Failed to run test, Try again.");
            process.exitCode = 1;
            return;
        }
        console.log('\x1b[32m%s\x1b[0m','Triggerd the test suite ', testSuiteName,' Successfully!');
        let responseBody = '';
        response.on('data', chunk => {
            responseBody += chunk.toString();
        });
        response.on('end', () => {
            console.log('\x1b[32m%s\x1b[0m','Execution of test suite ', testSuiteName,' is in progress.');
            checkExecStatus(host_name, port, responseBody, testSuiteName, emailId, team_name, project_name);
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
function checkExecStatus (host_name, port, testRunResponseBody, testSuiteName, emailId,team_name,project_name) {

    const URI = baseContext+"/checkExecutionStatus?teamName="+team_name+"&projectName="+project_name; 
    const encodedURI = encodeURI(URI);
    let apiCallConfig = {
        host: host_name,
        port: port,
        path: encodedURI,
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
                completedTest(host_name, port, testRunResponseBody, testSuiteName, emailId,team_name,project_name);
                return;
            }
            else {
                setTimeout(() => {  checkExecStatus(host_name, port, testRunResponseBody, testSuiteName, emailId,team_name,project_name); }, 30000);
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
function completedTest (host_name, port, execStatusResponse, testSuiteName, emailId,team_name,project_name) {
    
    const URI = baseContext+"/checkExecutionResult?teamName="+team_name+"&projectName="+project_name
    const encodedURI = encodeURI(URI);
    let apiCallConfig = {
        host: host_name,
        port: port,
        path: encodedURI,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    }
    
    var reqPost = https.request(apiCallConfig, function(response){
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
           
            if (parsedJson.finalStatus === 'COMPLETED' ) {
                console.log('\x1b[32m%s\x1b[0m','Execution of test suite ',testSuiteName,' is now complete!');
                console.log('\x1b[32m%s\x1b[0m',"Test Passed!");
                process.exitCode = 0;
                return;
            } else {
                console.log('\x1b[31m%s\x1b[0m','Execution of test suite ',testSuiteName,' is now complete!');
                console.log('\x1b[31m%s\x1b[0m',"Test Failed!");
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