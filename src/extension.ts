import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as os from 'os';

export function activate(context: vscode.ExtensionContext) 
{
	console.log('Congratulations, your extension "DependencyCheck" is now active!');
	let pathToDC = '';

	const execShell = (cmd: string, options: cp.ExecOptions = {}) =>
		new Promise<string>((resolve, reject) => {
			cp.exec(cmd, options, (err, out) => {
				if (err) {
						return reject(err);
				}
				return resolve(out);
			});
		});

	const helloWorldCommand = vscode.commands.registerCommand('DependencyCheck.helloWorld', 
	async () => 
	{
		vscode.window.showInformationMessage('Hello World from OWASP Dependency Check Extension!');
	});

	const runDependencyCheckCommand = vscode.commands.registerCommand('DependencyCheck.runDependencyCheck', 
	async () => 
	{
		if (pathToDC.length === 0) {
			vscode.window.showInformationMessage("Set options first, no DC path");
			return;
		}

		let projectPath = '';
		if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
			projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
			vscode.window.showInformationMessage(`Current project: ${projectPath}`);
		} else {
			vscode.window.showErrorMessage('No project folder is open.');
			return;
		}

		let osDCCommand = '';
		if (os.platform() === 'win32') {
			osDCCommand = `dependency-check.bat --project "Dependency Check" --scan "${projectPath}" --out "${projectPath}"`;
		} else {
			osDCCommand = `./dependency-check.sh --project "Dependency Check" --scan "${projectPath}" --out "${projectPath}"`;
		}

		try {
			vscode.window.showInformationMessage('Started Dependency Check');
			await execShell(osDCCommand, { cwd: pathToDC });
			vscode.window.showInformationMessage('Dependency Check finished');
		} catch (error) {
			vscode.window.showErrorMessage(`Error: ${(error as Error).message}`);
		}
	});

	const setOptionsCommand = vscode.commands.registerCommand('DependencyCheck.setOptions', 
	async () => 
	{
		const userInput = await vscode.window.showInputBox({
			prompt: 'Enter path to dependency-check/bin folder',
			placeHolder: 'Type here'
		});

		if (userInput) {
			vscode.window.showInformationMessage(`You entered: ${userInput}`);
			pathToDC = userInput;
		}
	});

	context.subscriptions.push(helloWorldCommand, runDependencyCheckCommand, setOptionsCommand);
}

export function deactivate() {}
