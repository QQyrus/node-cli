#!/usr/bin/env node

const { Command } = require('commander');
var webUtil = require('./utils/web.cjs');
var mobilityUtil = require('./utils/mobility.cjs');
var componentUtil = require('./utils/component.cjs');
var globalVarUtil = require('./utils/globalVar.cjs');
var globalVarMobilityUtil = require('./utils/globalVarMobility.cjs');
var appUploadMobilityUtil = require('./utils/appUploadMobility.cjs');
var globalVarComponentUtil = require('./utils/globalVarComponent.cjs');

const program = new Command();

program
  .name('qyrus-cli')
  .description('Helps you to manage variables, apps and to run tests on Qyrus platform')
  .version('0.0.1');

// Web Commands
program.command('web')
  .description('helps you trigger web tests on the platform')
  .option('--endPoint <string>', 'Qyrus endpoint provided by Qyrus admin')
  .option('-u, --username <string>', 'Qyrus admin provided email')
  .option('-p, --passcode <string>', 'Qyrus admin provided passcode in base64 format')
  .option('--teamName <string>', 'Team name you can find by logging into Qyrus app.')
  .option('--projectName <string>', 'Project name you can find by logging into Qyrus app.')
  .option('--suiteName <string>', 'Test suite name you can find by logging into Qyrus app.')
  .option('--env <string>', '(optional) Global variable name you can find by logging into Qyrus app.')
  .option('--browserOS <string>', 'Browser operating system eg: windows/linux')
  .option('--browser <string>', 'Browser name eg: chrome/firefox/MicrosoftEdge?')
  .option('--onErrorContinue <boolean>', 'Continue execution on error?')
  .option('--emailId <string>', '(optional) email id to which the reports need to be sent post execution')
  .action((options) => {
    webUtil.trigger(options.endPoint, options.username, options.passcode, 
        options.teamName, options.projectName, options.suiteName, 
        options.browserOS, options.browser, options.onErrorContinue, 
        options.emailId, options.env);
});

program.command('update-web-variables')
  .description('helps you update global variables on web automation service')
  .option('--endPoint <string>', 'Qyrus endpoint provided by Qyrus admin')
  .option('-u, --username <string>', 'Qyrus admin provided email')
  .option('-p, --passcode <string>', 'Qyrus admin provided passcode in base64 format')
  .option('--teamName <string>', 'Team name you can find by logging into Qyrus app.')
  .option('--projectName <string>', 'Project name you can find by logging into Qyrus app.')
  .option('--variableEnvName <string>', 'Variables environment name, you can find by logging into Qyrus app.')
  .option('--variableName <string>', 'Existing variable name eg: Demo')
  .option('--variableType <string>', 'Existing variable type eg: Custom, BaseURL, Password.')
  .option('--variableValue <string>', 'Value to update the existing variable.')
  .action((options) => {
    globalVarUtil.trigger(options.endPoint, options.username, options.passcode, 
        options.teamName, options.projectName, options.variableEnvName, 
        options.variableName, options.variableType, options.variableValue);
});

// Mobility Commands
program.command('mobility')
  .description('helps you trigger mobility tests on the platform')
  .option('--endPoint <string>', 'Qyrus endpoint provided by Qyrus admin')
  .option('-u, --username <string>', 'Qyrus admin provided email')
  .option('-p, --passcode <string>', 'Qyrus admin provided passcode in base64 format')
  .option('--teamName <string>', 'Team name you can find by logging into Qyrus app.')
  .option('--projectName <string>', 'Project name you can find by logging into Qyrus app.')
  .option('--suiteName <string>', 'Test suite name you can find by logging into Qyrus app.')
  .option('--appName <string>', 'Enter android/iOS app name')
  .option('--appActivity <string>', 'Enter android app activity which will be in the form of com.example.splash_screen')
  .option('--devicePoolName <string>', 'Specify your device pool name which you created on Qyrus, a device pool will have list of devices added and a test run will happen on a device from the pool.')
  .option('--enableDebug <string>', 'Prints additional debug information if this option is enabled. eg: yes/no')
  .option('--bundleId <string>', 'Enter iOS app bundleId which will be in the form of com.example.splash_screen (Optional, during android runs)')
  .option('--emailId <string>', '(optional) email id to which the reports need to be sent post execution')
  .action((options) => {
    mobilityUtil.trigger(options.endPoint, options.username, options.passcode,
      options.teamName, options.projectName, options.suiteName, 
      options.appName, options.appActivity, options.devicePoolName,
      options.enableDebug, options.bundleId, options.emailId);
});

program.command('update-mobility-variables')
  .description('helps you update global variables on mobility service')
  .option('--endPoint <string>', 'Qyrus endpoint provided by Qyrus admin')
  .option('-u, --username <string>', 'Qyrus admin provided email')
  .option('-p, --passcode <string>', 'Qyrus admin provided passcode in base64 format')
  .option('--teamName <string>', 'Team name you can find by logging into Qyrus app.')
  .option('--projectName <string>', 'Project name you can find by logging into Qyrus app.')
  .option('--variableName <string>', 'Existing variable name eg: Demo')
  .option('--variableType <string>', 'Existing variable type eg: Custom, BaseURL, Password.')
  .option('--variableValue <string>', 'Value to update the existing variable.')
  .action((options) => {
    globalVarMobilityUtil.trigger(options.endPoint, options.username, options.passcode, 
        options.teamName, options.projectName, options.variableName, 
        options.variableType, options.variableValue);
});

program.command('upload-app-mobility')
  .description('helps you upload apps iOS/android to mobility service')
  .option('--endPoint <string>', 'Qyrus endpoint provided by Qyrus admin')
  .option('-u, --username <string>', 'Qyrus admin provided email')
  .option('-p, --passcode <string>', 'Qyrus admin provided passcode in base64 format')
  .option('--teamName <string>', 'Team name you can find by logging into Qyrus app.')
  .option('--projectName <string>', 'Project name you can find by logging into Qyrus app.')
  .option('--appPath <string>', 'Existing variable name eg: Demo')
  .action((options) => {
    var execCmd = 'mobility';
    appUploadMobilityUtil.trigger(options.endPoint, options.username, options.passcode, 
        options.teamName, options.projectName, options.appPath, execCmd);
});

// Component Commands
program.command('update-component-variables')
  .description('helps you update global variables on component service')
  .option('--endPoint <string>', 'Qyrus endpoint provided by Qyrus admin')
  .option('-u, --username <string>', 'Qyrus admin provided email')
  .option('-p, --passcode <string>', 'Qyrus admin provided passcode in base64 format')
  .option('--teamName <string>', 'Team name you can find by logging into Qyrus app.')
  .option('--projectName <string>', 'Project name you can find by logging into Qyrus app.')
  .option('--variableName <string>', 'Existing variable name eg: Demo')
  .option('--variableType <string>', 'Existing variable type eg: Custom, BaseURL, Password.')
  .option('--variableValue <string>', 'Value to update the existing variable.')
  .action((options) => {
    globalVarComponentUtil.trigger(options.endPoint, options.username, options.passcode, 
        options.teamName, options.projectName, options.variableName, 
        options.variableType, options.variableValue);
});

program.command('component')
  .description('helps you trigger component tests on the platform')
  .option('--endPoint <string>', 'Qyrus endpoint provided by Qyrus admin')
  .option('-u, --username <string>', 'Qyrus admin provided email')
  .option('-p, --passcode <string>', 'Qyrus admin provided passcode in base64 format')
  .option('--teamName <string>', 'Team name you can find by logging into Qyrus app.')
  .option('--projectName <string>', 'Project name you can find by logging into Qyrus app.')
  .option('--componentWeb <boolean>', 'set it true if you want to run web tests on component eg: true/false')
  .option('--componentMobility <boolean>', 'set it true if you want to run mobility tests on component eg: true/false')
  .option('--appName <string>', 'Enter android/iOS app name')
  .option('--appActivity <string>', 'Enter android app activity which will be in the form of com.example.splash_screen')
  .option('--devicePoolName <string>', 'Specify your device pool name which you created on Qyrus, a device pool will have list of devices added and a test run will happen on a device from the pool.')
  .option('--deviceName <string>', 'Specify your device name which belongs to a pool')
  .option('--testName <string>', 'Specify your test name created under component tests')
  .option('--bundleId <string>', 'Enter iOS app bundleId which will be in the form of com.example.splash_screen (Optional, during android runs)')
  .option('--browserOS <string>', 'Browser operating system eg: windows/linux')
  .option('--browser <string>', 'Browser name eg: chrome/firefox/MicrosoftEdge?')
  .option('--emailId <string>', '(optional) email id to which the reports need to be sent post execution')
  
  .action((options) => {
    componentUtil.trigger(options.endPoint, options.username, options.passcode,
      options.teamName, options.projectName, options.componentWeb, 
      options.componentMobility, options.browser, options.browserOS,
      options.appName, options.appActivity, options.deviceName, 
      options.devicePoolName, options.testName, options.bundleId,
      options.emailId);
});

program.command('upload-app-component')
  .description('helps you upload apps iOS/android to component service')
  .option('--endPoint <string>', 'Qyrus endpoint provided by Qyrus admin')
  .option('-u, --username <string>', 'Qyrus admin provided email')
  .option('-p, --passcode <string>', 'Qyrus admin provided passcode in base64 format')
  .option('--teamName <string>', 'Team name you can find by logging into Qyrus app.')
  .option('--projectName <string>', 'Project name you can find by logging into Qyrus app.')
  .option('--appPath <string>', 'Existing variable name eg: Demo')
  .action((options) => {
    var execCmd = 'component';
    appUploadMobilityUtil.trigger(options.endPoint, options.username, options.passcode, 
        options.teamName, options.projectName, options.appPath, execCmd);
});

program.parse();

//To trigger test
// ./index.cjs web --endPoint http://localhost:8087 --username prajwalt@quinnox.com --passcode UGFzc3dvcmRAMQ== --teamName "CTC - STG Common Area" --projectName Test --suiteName Test --browserOS Windows --browser Chrome --onErrorContinue true --emailId saiprasadt@quinnox.com

//To update env variables web
// ./index.cjs update-web-variables --endPoint http://localhost:8087 --username prajwalt@quinnox.com --passcode UGFzc3dvcmRAMQ== --teamName "CTC - STG Common Area" --projectName Test --variableEnvName Test --variableName url --variableType Custom --variableValue PrajwalT


//upload app mobility
// ./index.cjs upload-app-mobility --endPoint http://localhost:8081 --username prajwalt@quinnox.com --passcode UGFzc3dvcmRAMQ== --teamName "CTC - STG Common Area" --projectName TestAndroid --appPath /Users/saiprasadt/Downloads/qyrus_training.apk

//To update env variables mobility
// ./index.cjs update-mobility-variables --endPoint http://localhost:8081 --username prajwalt@quinnox.com --passcode UGFzc3dvcmRAMQ== --teamName "CTC - STG Common Area" --projectName TestAndroid --variableName URL --variableType BaseURL --variableValue "https://qyrus.com"

// trigger test mobility
// ./index.cjs mobility --endPoint http://localhost:8081 --username prajwalt@quinnox.com --passcode UGFzc3dvcmRAMQ== --teamName "CTC - STG Common Area" --projectName TestAndroid --suiteName Demo --appName qyrus_training.apk --appActivity "com.quinnox.qyrus_training.SplashScreen" --devicePoolName Samsung --enableDebug no --emailId someemail@test.com



//To update env variables component
// ./index.cjs update-component-variables --endPoint http://localhost:8087 --username prajwalt@quinnox.com --passcode UGFzc3dvcmRAMQ== --teamName "CTC - STG Common Area" --projectName CliTest --variableName URL --variableType BaseURL --variableValue "https://qyrus.com"

//trigger test component
// ./index.cjs component --endPoint http://localhost:8087 --username prajwalt@quinnox.com --passcode UGFzc3dvcmRAMQ== --teamName "CTC - STG Common Area" --projectName CliTest --componentWeb true --componentMobility true --appName qyrus_training.apk --appActivity "com.quinnox.qyrus_training.SplashScreen" --devicePoolName samsung --deviceName "Galaxy A32" --testName DemoTest --browser chrome --browserOS windows