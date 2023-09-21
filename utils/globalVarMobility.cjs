var https = require('https');
var http = require('http');
var url = require('url');
const fs = require('fs');

let baseContext = '/cli-adapter-mobility/v1';

const trigger = function(endpoint, username, passcode, teamName, projectName, varName, varType, varValue, envName, fromFile) {   
    //construct body for rest call
    var triggerObject = {
        "userName": username,
        "encodedPassword": passcode,
        "teamName": teamName,
        "projectName": projectName,
        "varName": varName,
        "varType": varType,
        "varValue": varValue,
        "envName": envName
    };

    if(fromFile != null)
        configuration = getFileResults(fromFile)   

    triggerObject = setTriggerObjectData(triggerObject,configuration)

    endpoint = endpoint != null ? endpoint : configuration.configuration.endpoint
    validateConfigurationInfo(triggerObject.userName, triggerObject.encodedPassword,endpoint);
    let apiCallConfig = buildAPICallConfiguration(endpoint);
    
    if ( envName == null) {
        envName = '';
    }
    console.log("Updating global variable...");
     //http request to update the global variables
     var reqPost = https.request(apiCallConfig, function(res) {
        //If the response from the request is not 200 then fail the pipeline 
        var body = '';
        res.on('data', chunk => {
            body += chunk.toString(); // convert Buffer to strin
        });
        res.on('end', () => {
            if(res.statusCode!=200) {
                console.log('Failed to update variable:', body);
                process.exitCode = 1;
                return;
            }
            console.log("Update to variable -", triggerObject.varName, "- is successfull!");
        });
     });
     reqPost.on('error', function(err) {
        console.log("ERROR : "+ err.message);
        process.exitCode = 1;
        return
    }); 
    reqPost.write(JSON.stringify(triggerObject));
    reqPost.end();
}

function getFileResults(fromFile) {
    let fileInfo = fs.readFileSync(fromFile, (err,file) => {
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

function setTriggerObjectData(triggerObject, configuration) {
    if(triggerObject.userName == null)
        triggerObject["userName"] = configuration.configuration.username
    if(triggerObject.encodedPassword == null)
        triggerObject["encodedPassword"] = configuration.configuration.passcode
    if(triggerObject.teamName == null)
        triggerObject["teamName"] = configuration.projectInfo.teamName
    if(triggerObject.projectName == null)
        triggerObject["projectName"] = configuration.projectInfo.projectName
    if(triggerObject.varName == null)
        triggerObject["varName"] = configuration.variableInfo.variableName
    if(triggerObject.varType == null)
        triggerObject["varType"] = configuration.variableInfo.variableType
    if(triggerObject.varValue == null)
        triggerObject["varValue"] = configuration.variableInfo.variableValue  
    if(triggerObject["envName"] == null)  
        triggerObject["envName"] = configuration.variableInfo.envName != null ? configuration.variableInfo.envName : ''     
    return triggerObject
}

function validateConfigurationInfo (username, password, URL)
{
    if ( username == null || password == null || URL == null ) {
        console.error('ERROR : Invalid login info.  Check your username, password and login URL.');
        process.exit(1);
    }
}

function buildAPICallConfiguration(gatewayUrl) {
    const gatewayURLParse = new URL(gatewayUrl);
    let host_name = gatewayURLParse.hostname;
    let port = gatewayURLParse.port;
    let apiCallConfig = {
        host: host_name,
        port: port,
        path: baseContext+'/variables',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        rejectUnauthorized: false
    }
    return apiCallConfig
}

module.exports = {
    trigger
}