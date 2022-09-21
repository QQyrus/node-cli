const fs = require('fs');
const request = require('request')
const path = require('path')

const trigger = function(gatewayUrl, qyrus_username, qyrus_password,
    qyrus_team_name, qyrus_project_name, appPath, execCmd) {
    
    var contextPath = '/cli-adapter-component/v1';
    if ( execCmd === 'mobility' ) {
        contextPath = '/cli-adapter-mobility/v1';
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
                    console.log(response.body);
                    process.exitCode = 1;
                    return;
                } else {
                    //get the appName
                    var appName = path.parse(appPath).base;
                    console.log("App - "+appName+" uploaded to Qyrus successfully!");
                    process.exitCode = 0;
                }
            });
    } else {
        console.log('App not found in artifacts!');
        process.exitCode = 1;
        return;
    } 
}

module.exports = {
    trigger
}