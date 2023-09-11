var https = require('https');
var http = require('http');
var url = require('url');

let baseContext = '/cli-adapter-component/v1';

const trigger = function(endpoint, username, passcode, teamName, 
    projectName, varName, varType, 
    varValue, envName) {
    
    var hostName = url.parse(endpoint).hostname;
    var port = url.parse(endpoint).port;
    
    if ( envName == null ) {
        envName = ''
    }

    // construct URL details for rest 
    var optionspost = {
        host: hostName,
        port: port,
        path: baseContext+'/variables',
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
        "projectName": projectName,
        "varName": varName,
        "varType": varType,
        "varValue": varValue.trim(),
        "envName": envName
    };

     //http request to update the global variables
     var reqPost = https.request(optionspost, function(res) {
        //If the response from the request is not 200 then fail the pipeline 
        if(res.statusCode!=200) {
            console.log('Failed to update variables, Try again.');
            process.exitCode = 1;
            return;
        }
        var body = '';
        res.on('data', chunk => {
            body += chunk.toString(); // convert Buffer to strin
        });
        res.on('end', () => {
            console.log("update to variable - "+varName+" - is successfull!");
            process.exitCode = 0;
            return;
        });
     });
     reqPost.on('error', function(err) {
        console.log("ERROR : "+err);
        process.exitCode = 1;
        return;
    });
    reqPost.write(JSON.stringify(triggerObject));
    reqPost.end();
}

module.exports = {
    trigger
}