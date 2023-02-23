var request = require('request');

const trigger = function(gatewayUrl, qyrus_username, qyrus_password, qyrus_team_name, qyrus_project_name, appName) {
    console.log("App - "+appName+" removal in progress...");
    var contextPath = '/cli-adapter-rover/v1';

    var options = {
        'method': 'DELETE',
        'url': gatewayUrl+contextPath+'/deleteApp?username='+qyrus_username+'&password='+qyrus_password+'&teamName='+qyrus_team_name+'&projectName='+qyrus_project_name+'&appName='+appName,
        'headers': {
        }
    };
    request(options, function (error, response) {
        if (response.statusCode !=200) {
            console.log('Failed to delete app! Try again.');
            process.exitCode = 1;
            throw new Error(error);
        }
        console.log(response.statusCode)
        console.log("App - "+appName+" Deleted Sucessfully!");
        process.exitCode = 0;
    });
}

module.exports = {
    trigger
}