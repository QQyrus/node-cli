var url = require('url');
var https = require('https');
var http = require('http');
var delay = require('q');

let count1 = 0;
let oldSet = new Set();
let newSet = new Set();
let array3 =[];
let baseContext = '/cli-adapter-web-repository/v1';

const trigger = function(endpoint, username, passcode, teamName, 
    projectName, testSuiteName,  operatingSystem, 
    browserName, onErrorContinue,parameterFileSource, emailId, envName) {
    
    console.log('\x1b[32m%s\x1b[0m',"Getting your environment ready, your test will start running soon.");

    var hostName = url.parse(endpoint).hostname;
    var port = url.parse(endpoint).port;

    var status = "RUN INITIATED" ;
    var statusResponse;

    // construct URL details for rest 
    var optionspost = {
        host: hostName,
        port: port,
        path: baseContext+'/webrepoAutomationTrigger',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    };

    //construct URL details to check execution status 
    var execStatus = {
        host: hostName,
        port: port,
        path: baseContext+'/checkExecutionStatus?username='+username+'&passcode='+passcode,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    };

    // construct URL details to check final exec result 
    var finalResult = {
        host: hostName,
        port: port,
        path: baseContext+'/checkExecutionResult?username='+username+'&passcode='+passcode+'&emailId='+emailId,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    };

    //get script result status 
    var scriptResultStatus = {
        host: hostName,  
        port: port,
        path: baseContext+'/checkScriptExecutionStatus?username='+username+'&passcode='+passcode,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    };

    //construct body for rest call
    var triggerObject = {
        "userName": username,
        "encodedPassword": passcode,
        "teamName": teamName,
        "project": projectName,
        "testSuite": testSuiteName,
        "operatingSystem": operatingSystem,
        "browser": browserName,
        "onErrorContinue": onErrorContinue,
        "parameterFileSource":  parameterFileSource,
        "variableEnvironmentId": envName
    };
    
    //http request to trigger the test
    var reqPost = https.request(optionspost, function(res) {
        //If the response from the request is not 200 then fail the pipeline 
        if(res.statusCode!=200) {
            console.log('Failed to run test, Try again.');
            return;
        }
        console.log('Triggered the TestSuite ', testSuiteName,' Successfully!!');
        let finalbody = '';
        let body = '';
        res.on('data', chunk => {
            body += chunk.toString(); // convert Buffer to string
            let varObject = JSON.parse(body);
            let runId = varObject.runId;
            let varId1 = runId.split('"')
            let varId2 = varId1[3]
            let jsonObject = { "runId" : varId2 , "token" : varObject.token }
            finalbody = JSON.stringify(jsonObject)
        });
        res.on('end', () => {
            console.log('Execution of TestSuite ', testSuiteName,' is in Progress...');
            checkExecStatus(execStatus,finalbody,testSuiteName,
                finalResult,status,statusResponse,
                scriptResultStatus,emailId,
                username,passcode);
        });
    });
    reqPost.on('error', function(err) {
        console.log("ERROR : "+err);
    }); 
    reqPost.write(JSON.stringify(triggerObject));
    reqPost.end();
} 

function checkExecStatus (execStatus,triggerResponse,testSuite,
    finalResult,status,statusResponse,
    scriptResultStatus,emailId,
    username,passcode) {
    //http request to check the status of test
    var reqPost = https.request(execStatus, function(res) {
        /* If the response from the request is not 200 then fail the pipeline */
        if(res.statusCode!=200){
            return;
        }
        let body = '';
        res.on('data', chunk => {
            body += chunk.toString(); // convert Buffer to string
            statusResponse = checkRunStatus(body.trim());

            if (statusResponse == 'RUNNING') {
                checkScriptStatus(scriptResultStatus, triggerResponse,username,passcode);
            }
            if(status !== statusResponse){
                status = statusResponse ;
                console.log('TestSuite Run Status: '+ status);
            }
        });
        res.on('end', () => {
             
            if(body.trim() === "COMPLETED"){
                checkScriptStatus(scriptResultStatus, triggerResponse,username,passcode,);
                delay(5000);
                checkFinalStatus(finalResult,triggerResponse,testSuite,emailId,username,passcode);
                return;
            }
            else {
                setTimeout(() => {  checkExecStatus(execStatus,triggerResponse,testSuite,finalResult,status,statusResponse,scriptResultStatus,emailId,username,passcode); }, 10000);
                
            }  
        }); 
    });
    reqPost.on('error', function(err) {
        console.log("ERROR : "+err);
    });
    
    reqPost.write(triggerResponse);
    reqPost.end();
}

function checkScriptStatus(scriptResultStatus, triggerResponse) {
    var reqPost = https.request(scriptResultStatus, function (res) {
        /* If the response from the request is not 200 then fail the pipeline */
        if (res.statusCode != 200) {
            return;
        }
        let body = '';
        res.on('data', chunk => {
            body += chunk.toString(); // convert Buffer to string
        });
        res.on('end', chunk => {
            if((body === null) || (typeof body === 'undefined')||(body ==="")) {
                return;
            }
            else{
                var parsedJson = JSON.parse(body);
                getUniqueScripts(parsedJson)
            }
        });
    });
    reqPost.write(triggerResponse);
    reqPost.end();
}

function getUniqueScripts(parsedJson) {
    for (let i = 0; i < parsedJson.length; i++) {
        newSet.add(parsedJson[i].scriptName);
        
    }
    if(count1 == 0) {
        oldSet = new Set(function*() { yield* Array.from(newSet.values()); yield* Array.from(oldSet.values()); }());
        printLogs(Array.from(newSet.values()), parsedJson);
        count1++;
    }
    else {
        array3 = Array.from(newSet.values()).filter(function (obj) { return Array.from(oldSet.values()).indexOf(obj) == -1; });
        printLogs(array3, parsedJson)
        oldSet = new Set(function*() { yield* Array.from(newSet.values()); yield* Array.from(oldSet.values()); }());
    }    
}

function printLogs(array3, parsedJson){
    for (var i = 0; i < array3.length; i++) {
        for (var j = 0; j < parsedJson.length; j++) {
            if (array3[i] === parsedJson[j].scriptName) {
                console.log(parsedJson[j].scriptName + " : " + parsedJson[j].scriptResult);
            }
        }
    }
}

function checkRunStatus (status){
    if(status === "P3"){
        return "RUNNING" ;
    }else if(status === "P1"){
        return "ALLOCATING BROWSER" ;
    }else if(status === "P2"){
        return "WAITING FOR BROWSER" ;
    }else if(status === "EXECUTING"){
        return "RUN INITIATED" ;
    }else if(status === "COMPLETED"){
        return "COMPLETED" ;
    }else if(status === "Q2"){
        return "WAITING FOR BROWSER" ;
    }else if(status === "GENERATING_REPORT"){
        return "GENERATING REPORT" ;
    }            
}

function checkFinalStatus (finalResult,triggerResponse,testSuite,emailId) {
    var reqPost = https.request(finalResult, function(res) {
        /* If the response from the request is not 200 then fail the pipeline */
        if(res.statusCode!=200){
            tl.setResult(tl.TaskResult.Failed, 'Failed to run test, Try again.');
            return;
        }

        let body = '';
        res.on('data', chunk => {
            body += chunk.toString(); // convert Buffer to string
        });
        res.on('end', () => {
            var parsedJson = JSON.parse(body);
            if (parsedJson.finalStatus === 'Pass' ) {
                console.log('Execution of TestSuite ',testSuite,' is now Complete!');
                console.log("Test Passed! Click on the below link to download the run report");
                console.log(parsedJson.report);
                process.exitCode = 0;
                return;
            } else {
                console.log('Execution of TestSuite ',testSuite,' is now Complete!');
                console.log("Test Failed! Click on the below link to download the run report");
                console.log(parsedJson.report);
                process.exitCode = 1;
                return;
            }
        }); 
    });
    reqPost.on('error', function(err) {
        console.log(err);
    });
    console.log('Grabbing final result of TestSuite ', testSuite,' ...');
    reqPost.write(triggerResponse);
    reqPost.end();
}


module.exports = {
    trigger
}