var request = require('request');

const trigger = function(gatewayUrl,qyrus_username, qyrus_team_name, qyrus_project_name, execCmd) {
    console.log("Fetching the app names in progress...");
    var contextPath = '/cli-adapter-component/v1';
    if ( execCmd === 'mobility' ) {
        contextPath = '/cli-adapter-mobility/v1';
    }
    var options = {
        'method': 'GET',
        'url': gatewayUrl+contextPath+'getapk?userName='+qyrus_username+'&teamName='+qyrus_team_name+'&projectName='+qyrus_project_name,
        'headers': {
            
        }
    };
    request(options, function (error, response) {
        if (error) {
            process.exitCode = 1;
            throw new Error(error);
        }
        console.log("Fething the App details Sucessfully!");
        console.log(response.body);
        process.exitCode = 0;
    });
}

module.exports = {
    trigger
}