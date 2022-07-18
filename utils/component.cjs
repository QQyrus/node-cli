const fs = require('fs');
const https = require('https')
const http = require('http')
const request = require('request')
const path = require('path')
const url = require('url')
const { exec } = require("child_process");

let baseContext = '/cli-adapter-component/v1';

const trigger = function(endpoint, username, passcode, teamName, project, 
    isComponentWeb, isComponentMobility, browser, operatingSystem, appName, 
    appActivity, deviceName, devicePoolName, testName, bundleId, emailId) {
    
        console.log('\x1b[32m%s\x1b[0m',"Getting your environment ready, your test will start running soon.");

    var host_name = url.parse(endpoint).hostname;
    var port = url.parse(endpoint).port;

    if ( bundleId == null ) {
        bundleId = '';
    }

    /* construct URL details for rest */
    var optionspost = {
        host: host_name,
        port: port,
        path: baseContext+'/componentTestTrigger',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
        
    };

    /* construct URL details to check execution status  */
    var execStatus = {
        host: host_name,
        port: port,
        path: baseContext+'/checkExecutionStatus',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    };

    /* construct URL details to check final exec result */
    var finalResult = {
        host: host_name,
        port: port,
        path: baseContext+'/checkExecutionResult?emailId='+emailId,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    };

    /* construct body for rest call */
    var triggerObject = {
        "userName": username,
        "encodedPassword": passcode,
        "projectName": project,
        "teamName": teamName,
        "operatingSystem": operatingSystem,
        "browser": browser,
        "devicePoolName": devicePoolName,
        "appFileName": appName,
        "appActivity": appActivity,
        "deviceName" : deviceName,
        "componentWeb" : isComponentWeb,
        "componentMobility" : isComponentMobility,
        "testName": testName,
        "bundleId": bundleId
    };

    var reqPost = https.request(optionspost, function(res) {
        /* If the response from the request is not 200 then fail the pipeline */
        if(res.statusCode!=200){
            tl.setResult(tl.TaskResult.Failed, 'Failed to run test, Try again.');
            return;
        }
        console.log('Triggered the test ', testName,' Successfully!');
        let body = '';
        res.on('data', chunk => {
            body += chunk.toString(); // convert Buffer to string
        });
        res.on('end', () => {
            console.log('Execution of test ', testName,' is in progress.');
            checkExecStatus(execStatus,body,testName,finalResult,emailId);
        });
        
    });
    reqPost.on('error', function(err) {
    });
    reqPost.write(JSON.stringify(triggerObject));
    reqPost.end();
}

function checkExecStatus (execStatus,triggerResponse,testSuite,
    finalResult,emailId) {
    //http request to check the status of test
    
    var reqPost = https.request(execStatus, function(res) {
        /* If the response from the request is not 200 then fail the pipeline */
        if(res.statusCode!=200){
            console.log('Failed to run test, Try again.');
            return;
        }
        let body = '';
        res.on('data', chunk => {
            body += chunk.toString(); // convert Buffer to string
            
        });
        res.on('end', () => {
            var parsedJson = JSON.parse(body);
            var triggerResponseBody = JSON.parse(triggerResponse);
            if(parsedJson.runStatus.trim() === "Completed"){
                var executionId = parsedJson.testExecutionId;
                triggerResponseBody.testExecutionId = executionId;
                
                checkFinalStatus(finalResult,JSON.stringify(triggerResponseBody),testSuite,emailId);
                return;
            }
            else {
                setTimeout(() => {  
                    checkExecStatus(execStatus,triggerResponse,testSuite,finalResult,emailId); 
                }, 30000);   
            }  
        }); 
    });
    reqPost.on('error', function(err) {
        console.log("ERROR : "+err);
    });
    reqPost.write(triggerResponse);
    reqPost.end();
}

function checkFinalStatus (finalResult,triggerResponse,testSuite,emailId) {
    var reqPost = https.request(finalResult, function(res) {
        /* If the response from the request is not 200 then fail the pipeline */
        if(res.statusCode!=200){
            console.log('Failed to run test, Try again.');
            return;
        }

        let body = '';
        res.on('data', chunk => {
            body += chunk.toString(); // convert Buffer to string
        });
        res.on('end', () => {
            var parsedJson = JSON.parse(body);
            if (parsedJson.finalStatus === 'Pass' ) {
                console.log('Execution of test suite ',testSuite,' is now complete!');
                console.log("Test Passed! Click on the below link to download the run report");
                console.log(parsedJson.report);
                //there should be an if condition
                console.log('Reports has been sent to the emailId:', emailId);
                console.log('Test Passed, Check the CTC dashboard for more information.');
                return;
            } else {
                console.log('Execution of test suite ',testSuite,' is now complete!');
                console.log("Test Failed! Click on the below link to download the run report");
                console.log(parsedJson.report);
                //there should be an if condition
                console.log('Reports has been sent to the emailId:', emailId);
                console.log('Test Failed, Check the CTC dashboard for more information.');
                return;
            }
        }); 
    });
    reqPost.on('error', function(err) {
    });
    console.log('Grabbing final result of test suite ', testSuite,' ...');
    reqPost.write(triggerResponse);
    reqPost.end();
}

module.exports = {
    trigger
}