const fs = require('fs');
const https = require('https')
const http = require('http')
const request = require('request')
const path = require('path')
const url = require('url')
const { exec } = require("child_process");

let baseContext = '/cli-adapter-component/v1';
let triggerTestResponseBody = '';
let execStatusResponseBody = '';
//let baseContext = '';
let runIds = [];

const trigger = async function(endpoint, username, passcode, teamName, project, 
    isComponentWeb, isComponentMobility, browser, operatingSystem, appName, 
    appActivity, deviceName, devicePoolName, testName, bundleId, emailId, appPackage, envName,
    consolidateReports) {
    
    var host_name = url.parse(endpoint).hostname;
    var port = url.parse(endpoint).port;

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

    var finalResult = {
        host: host_name,
        port: port,
        path: baseContext+'/checkExecutionResult?emailId='+emailId,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    };

    /* construct URL details for rest */
    var consolidatedReportCall = {
        host: host_name,
        port: port,
        path: baseContext+'/consolidateReports',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    };

    //iteration on testNames
    var testNames = testName.split(',');
    for (let i = 0 ; i < testNames.length ; i++ ) {
        testName = testNames[i];
        console.log("executing test = "+testName);
        await triggerTest( endpoint, username, passcode, teamName, project, 
            isComponentWeb, isComponentMobility, browser, operatingSystem, appName, 
            appActivity, deviceName, devicePoolName, testName, bundleId, emailId, appPackage, envName);
        
        await checkExecStatus(execStatus,triggerTestResponseBody,finalResult,testName).then(() => console.log(''));
        await checkFinalStatus(finalResult,JSON.stringify(execStatusResponseBody),testName);
    } 

    var emails = [];
    if ( emailId != 'undefined' ) {
        var emailIds = emailId.split(',');
        for (let j = 0 ; j < emailIds.length ; j++ ) {
            emails.push(emailIds[j]);
        }
    }
    
    if ( consolidateReports == 'yes' ) {
        if ( emailId == 'undefined' ) {
            console.log("You need to provide email id to send consolidated reports");
            return;
        }
        var consolidatedReportsPayload = {
            "runIds": runIds,
            "emailIds": emails,
            "userName": username,
            "encodedPassword": passcode
        }
        consolidateReportsFn(consolidatedReportCall,consolidatedReportsPayload);
    } 
}


function triggerTest (endpoint, username, passcode, teamName, project, 
    isComponentWeb, isComponentMobility, browser, operatingSystem, appName, 
    appActivity, deviceName, devicePoolName, testName, bundleId, emailId, appPackage, envName) {
    return new Promise((resolve) => {

        console.log('\x1b[32m%s\x1b[0m',"Getting your environment ready, your test will start running soon.");

        var host_name = url.parse(endpoint).hostname;
        var port = url.parse(endpoint).port;
        
        if ( appName == null ) {
            appName = '';
        }
        
        if ( bundleId == null ) {
            bundleId = '';
        }
        
        if ( appPackage == null ) {
            appPackage = '';
        }
        
        if ( appActivity == null ) {
            appActivity = '';
        }
        
        if ( envName == null ) {
            envName = '';
        }

        if ( triggerTestResponseBody != '' ) {
            triggerTestResponseBody = '';
        }
        
        if ( execStatusResponseBody != '' ) {
            execStatusResponseBody = '';
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
            "bundleId": bundleId,
            "appPackage": appPackage,
            "envName": envName
        };
        
        var reqPost = https.request(optionspost, function(res) {
            /* If the response from the request is not 200 then fail the pipeline */
            if(res.statusCode!=200){
                console.log('Failed to run test, Try again.');
                resolve();
                return;
            }
            console.log('Triggered the test ', testName,' Successfully!');
            //let body = '';
            res.on('data', chunk => {
                triggerTestResponseBody += chunk.toString(); // convert Buffer to string
            });
            res.on('end', () => {
                console.log('Execution of test ', testName,' is in progress.');
                resolve();
                return;
                //checkExecStatus(execStatus,body,testName,finalResult,emailId);
            });
            
        });
        reqPost.on('error', function(err) {
        });
        reqPost.write(JSON.stringify(triggerObject));
        reqPost.end();
    });
}

function checkExecStatus (execStatus,triggerResponse) {
    return new Promise((resolve) => {
        //https request to check the status of test
        var reqPost = https.request(execStatus, function(res) {
            /* If the response from the request is not 200 then fail the pipeline */
            if(res.statusCode!=200){
                console.log('Failed to check execution status, Try again.');
                resolve();
                return;
            }
            let body = '';
            res.on('data', chunk => {
                body += chunk.toString(); // convert Buffer to string
                
            });
            res.on('end', () => {
                var parsedJson = JSON.parse(body);
                execStatusResponseBody = JSON.parse(triggerResponse);
                if(parsedJson.runStatus.trim() === "Completed"){
                    var executionId = parsedJson.testExecutionId;
                    execStatusResponseBody.testExecutionId = executionId;
                    return resolve();
                }
                else {
                    setTimeout(() => {  
                        return resolve(checkExecStatus(execStatus,triggerResponse));
                    }, 30000);
                }  
            }); 
        });
        reqPost.on('error', function(err) {
            console.log("ERROR : "+err);
        });
        reqPost.write(triggerResponse);
        reqPost.end();
    });
}

function checkFinalStatus (finalResult,triggerResponse,testSuite) {
    return new Promise((resolve) => {
        //get the executed run ids and push to a list
        var parsedJson = JSON.parse(triggerResponse);
        runIds.push(Number(parsedJson.runId));
       
        var reqPost = https.request(finalResult, function(res) {
            /* If the response from the request is not 200 then fail the pipeline */
            if(res.statusCode!=200){
                console.log('Failed to check final test result, Try again.');
                return resolve();
            }

            let body = '';
            res.on('data', chunk => {
                body += chunk.toString(); // convert Buffer to string
            });
            res.on('end', () => {
                var parsedJson = JSON.parse(body);
                if (parsedJson.finalStatus === 'Pass' ) {
                    console.log('\x1b[32m%s\x1b[0m','Execution of test suite ',testSuite,' is now complete!');
                    console.log('\x1b[32m%s\x1b[0m','Click on the below link to download the run report');
                    console.log(parsedJson.report);
                    //there should be an if condition
                    console.log('\x1b[32m%s\x1b[0m','Test Passed!, Check the CTC dashboard for more information.');
                    process.exitCode = 0;
                    return resolve();
                } else {
                    console.log('\x1b[31m%s\x1b[0m','Execution of test suite ',testSuite,' is now complete!');
                    console.log('\x1b[31m%s\x1b[0m','Click on the below link to download the run report');
                    console.log(parsedJson.report);
                    //there should be an if condition
                    console.log('\x1b[31m%s\x1b[0m','Test Failed, Check the CTC dashboard for more information.');
                    process.exitCode = 1;
                    return resolve();
                }
            }); 
        });
        reqPost.on('error', function(err) {
        });
        console.log('Grabbing final result of test suite ', testSuite,' ...');
        reqPost.write(triggerResponse);
        reqPost.end(); 
    });
}

function consolidateReportsFn (consolidatedReportCallOptions,payload) {
    var reqPost = https.request(consolidatedReportCallOptions, function(res) {
        /* If the response from the request is not 200 then fail the pipeline */
        if(res.statusCode!=200){
            console.log('Failed to send consolidated report.');
            return;
        }
        
        let body = '';
        res.on('data', chunk => {
            body += chunk.toString(); // convert Buffer to string
        });
        res.on('end', () => {
            console.log('You will recieve email shortly.');
            return;
        });
        
    });
    reqPost.on('error', function(err) {
    });
    reqPost.write(JSON.stringify(payload));
    reqPost.end();
}

module.exports = {
    trigger
}