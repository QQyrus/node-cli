var request = require('request');

const trigger = function(gatewayUrl, qyrus_team_name, qyrus_project_name, execCmd) {
    console.log("Fetching the app names in progress...");
    if ( execCmd === 'mobility' ) {
        var contextPath = '/cli-adapter-mobility/v1';
    }
    var options = {
        'method': 'GET',
        'url': gatewayUrl+contextPath+'/getapk?teamName='+qyrus_team_name+'&projectName='+qyrus_project_name,
        'headers': {
            
        }
    };
    request(options, function (error, response) {
        if (response.statusCode !=200) {
            console.log('Failed to fetch app details! Try again.');
            process.exitCode = 1;
            throw new Error(error);
        }
        console.log("Fething the App details!");
        console.log(response.body);
        process.exitCode = 0;
    });
}

module.exports = {
    trigger
}