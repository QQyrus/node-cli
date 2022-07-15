var https = require('https');
var http = require('http');
var url = require('url');

const trigger = function(endpoint, username, passcode, teamName, 
    projectName, varEnvName, varName, varType, 
    varValue) {
    
    console.log("***** DEBUG PROPERTIES *****");
    console.log(endpoint);
    console.log(username);
    console.log(passcode);
    console.log(teamName);
    console.log(projectName);
    console.log(varEnvName);
    console.log(varName);
    console.log(varType);
    console.log(varValue);
    console.log("***** DEBUG PROPERTIES *****");

    var hostName = url.parse(endpoint).hostname;
    var port = url.parse(endpoint).port;

    // construct URL details for rest 
    var optionspost = {
        host: hostName,
        port: port,
        path: '/updateGlobeVar',
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
        "envName": varEnvName,
        "varName": varName,
        "varType": varType,
        "varValue": varValue
    };

     //http request to update the global variables
     var reqPost = http.request(optionspost, function(res) {
        //If the response from the request is not 200 then fail the pipeline 
        if(res.statusCode!=200) {
            console.log('Failed to run test, Try again.');
            return;
        }
        var body = '';
        res.on('data', chunk => {
            body += chunk.toString(); // convert Buffer to strin
        });
        res.on('end', () => {
            console.log("update to variable - "+varName+" on environment "+varEnvName+" is successfull!");
        });
     });
     reqPost.on('error', function(err) {
        console.log("ERROR : "+err);
    }); 
    reqPost.write(JSON.stringify(triggerObject));
    reqPost.end();
}

module.exports = {
    trigger
}