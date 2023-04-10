const fs = require('fs');
const https = require('https')
const http = require('http')
const request = require('request')
const path = require('path')
const url = require('url')
const { exec } = require("child_process");
const crypto = require("crypto");

let baseContext = '/cli-adapter-rover/v1/';

const trigger = function(gatewayUrl, qyrus_username, qyrus_password, 
    qyrus_team_name, qyrus_project_name, app_name, device_id, device_name, data_list_id,exploration_name,enable_debug) {
        
    const gatewayURLParse = new URL(gatewayUrl);
    let host_name = gatewayURLParse.hostname;
    let port = gatewayURLParse.port;
    
    let apiCallConfig = {
        host: host_name,
        port: port,
        path: baseContext+'roverTrigger',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    }
    let execStatus = {
        host: host_name,
        port: port,
        path: baseContext+'checkExplorationStatus',
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        }
    }
    // testing parameters
    if ( qyrus_username == null || qyrus_password == null || gatewayUrl == null ||
        device_id == null || data_list_id == null || device_name == null || exploration_name == null || app_name == null) {
        console.log('ERROR : One or more parameters are invalid');
        process.exitCode = 1;
    }

    if ( enable_debug == 'yes' ) {
        console.log('******* QYRUS Cloud - INPUT PARAMETERS *******');
        console.log('Username :',qyrus_username);
        console.log('Password :',qyrus_password);
        console.log('Team Name :',qyrus_team_name);
        console.log('Project Name :',qyrus_project_name);
        console.log('App Name :',app_name);
        console.log('Device Id :',device_id);
        console.log('Device Name :',device_name);
        console.log('Data List Id :',data_list_id);
        console.log('Exploration Name :',exploration_name);
        console.log('Host Name :',host_name);
        console.log('Port :',port);
    }
    console.log('\x1b[32m%s\x1b[0m',"Getting your environment ready, your test will start running soon.");
    roverTrigger(qyrus_username, qyrus_password, 
        qyrus_team_name, qyrus_project_name, app_name, device_id, device_name, data_list_id,exploration_name,execStatus,apiCallConfig);
    
}

function roverTrigger (qyrus_username, qyrus_password, 
    qyrus_team_name, qyrus_project_name, app_name, device_id, device_name, data_list_id,exploration_name,execStatus,apiCallConfig) {
    return new Promise((resolve) => {
        let testObject = {
            "userName": qyrus_username,
            "encodedPassword": qyrus_password,
            "teamName": qyrus_team_name,
            "projectName": qyrus_project_name,
            "appName": app_name,
            "deviceUUID": device_id,
            "deviceName": device_name,
            "dataListId": data_list_id,
            "explorationName": exploration_name
        }
        var reqPost = https.request ( apiCallConfig, function(response) {
            if (response.statusCode != 200) {
                if(response.statusCode == 400){
                    const id = crypto.randomBytes(2).toString("hex");
                    exploration_name = exploration_name+'-'+id;
                    roverTrigger(qyrus_username, qyrus_password, 
                        qyrus_team_name, qyrus_project_name, app_name, device_id, device_name, data_list_id,exploration_name,execStatus,apiCallConfig);
                }
                console.log("Failed to run test, Try again.");
                process.exitCode = 1;
                return;
            }
            console.log('\x1b[32m%s\x1b[0m','Triggerd the exploration ', exploration_name,' Successfully!');
            let responseBody = '';
            response.on('data', chunk => {
                responseBody += chunk.toString();
            });
            response.on('end', () => {
                console.log('\x1b[32m%s\x1b[0m','Execution of exploration ', exploration_name,' is inprogress!.');
                checkExecStatus(execStatus, responseBody);
                resolve();
            });
        });
        reqPost.on('error', function(error) {
            console.log('Error making api request, try again.', error);
            process.exitCode = 1;
            return;
        });
       reqPost.write(JSON.stringify(testObject));
       reqPost.end();
    });
}

//method to check the execution status
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
                console.log("inside checkExecStatus after exec:"+res.statusCode,parsedJson.status)
                if(parsedJson.status.trim() === "Completed"){
                    var executionId = parsedJson.testExecutionId;
                    execStatusResponseBody.testExecutionId = executionId;
                    console.log('\x1b[32m%s\x1b[0m','Execution of exploration is completed.');
                    return resolve();
                }
                else {
                    setTimeout(() => {  
                        return resolve(checkExecStatus(execStatus,triggerResponse));
                    }, 3000);
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

module.exports = {
    trigger
}
