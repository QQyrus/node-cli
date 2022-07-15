const fs = require('fs');
const request = require('request')
const path = require('path')

const trigger = function(gatewayUrl, qyrus_username, qyrus_password,
    qyrus_team_name, qyrus_project_name, appPath, execCmd) {
    
    console.log("****** DEBUG AREA ******")
    console.log(gatewayUrl);
    console.log(qyrus_username);
    console.log(qyrus_password);
    console.log(qyrus_team_name);
    console.log(qyrus_project_name);
    console.log(appPath);
    console.log("****** DEBUG AREA ******")
    
    var contextPath = '';
    if ( execCmd === 'mobility' ) {
        contextPath = '';
    }

    var appPath = appPath;
    //upload the app
    if ( fs.existsSync(appPath) ) {
        request.post({
            url: gatewayUrl+contextPath+"/uploadApp",
            formData: {
                file: fs.createReadStream(appPath),
                username: qyrus_username,
                password: qyrus_password,
                teamName: qyrus_team_name,
                projectName: qyrus_project_name
            },
            }, function(error, response, body) {
                if (response.statusCode!=200) {
                    console.log('Failed to upload app! Try again.');
                    return;
                } else {
                    //get the appName
                    var appName = path.parse(appPath).base;
                    console.log("App - "+appName+" uploaded to Qyrus successfully!");
                }
            });
    } else {
        console.log('App not found in artifacts!');
        return;
    } 
}

module.exports = {
    trigger
}