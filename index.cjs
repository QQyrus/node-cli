#!/usr/bin/env node

const { Command } = require('commander');
var webUtil = require('./utils/web.cjs');
var globalVarUtil = require('./utils/globalVar.cjs');

const program = new Command();

program
  .name('qyrus-cli')
  .description('Helps you to trigger tests on Qyrus platform')
  .version('0.0.1');

program.command('web')
  .description('helps you trigger web tests on the platform')
  .option('--endPoint <string>', 'Qyrus endpoint provided by Qyrus admin')
  .option('-u, --username <string>', 'Qyrus admin provided email')
  .option('-p, --passcode <string>', 'Qyrus admin provided passcode in base64 format')
  .option('--teamName <string>', 'Team name you can find by logging into Qyrus app.')
  .option('--projectName <string>', 'Project name you can find by logging into Qyrus app.')
  .option('--suiteName <string>', 'Test suite name you can find by logging into Qyrus app.')
  .option('--variableEnvName <string>', 'Global variable name you can find by logging into Qyrus app.')
  .option('--browserOS <string>', 'Browser operating system eg: windows/linux')
  .option('--browser <string>', 'Browser name eg: chrome/firefox/MicrosoftEdge?')
  .option('--onErrorContinue <boolean>', 'Continue execution on error?')
  .option('--emailId <string>', 'email id to which the reports need to be sent post execution')
  .action((options) => {
    webUtil.trigger(options.endPoint, options.username, options.passcode, 
        options.teamName, options.projectName, options.suiteName, 
        options.browserOS, options.browser, options.onErrorContinue, 
        options.emailId);
});

program.command('update-web-varibles')
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

program.command('mobility')
  .description('helps you trigger mobility tests on the platform')
  .option('-u, --username <string>', 'Qyrus admin provided email')
  .option('-p, --passcode <string>', 'Qyrus admin provided passcode in base64 format')
  .action((options) => {
    console.log(options.username);
    console.log(options.passcode);
    console.log(options.teamName);
  });

program.parse();

//To trigger test
// ./index.cjs web --endPoint http://localhost:8087 --username prajwalt@quinnox.com --passcode UGFzc3dvcmRAMQ== --teamName "CTC - STG Common Area" --projectName Test --suiteName Test --browserOS Windows --browser Chrome --onErrorContinue true --emailId saiprasadt@quinnox.com
//To update env variables
// ./index.cjs update-web-varibles --endPoint http://localhost:8087 --username prajwalt@quinnox.com --passcode UGFzc3dvcmRAMQ== --teamName "CTC - STG Common Area" --projectName Test --variableEnvName Test --variableName url --variableType Custom --variableValue PrajwalT

