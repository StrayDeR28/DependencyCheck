import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as os from 'os';

export function activate(context: vscode.ExtensionContext) 
{
	console.log('Congratulations, your extension "DependencyCheck" is now active!');

	const execShell = (cmd: string, options: cp.ExecOptions = {}) =>
		new Promise<string>((resolve, reject) => {
			cp.exec(cmd, options, (err, out) => {
				if (err) {
						return reject(err);
				}
				return resolve(out);
			});
		});

	
	const runDependencyCheckCommand = vscode.commands.registerCommand('dependency-check.runDependencyCheck', 
	async () => 
	{
		const config = vscode.workspace.getConfiguration('dependency-check');
		const pathToDC = config.get<string>('pathToDC', '');
		if (pathToDC.length === 0) {
			vscode.window.showInformationMessage("Set options first, path to DC is empty");
			return;
		}

		let projectPath = '';
		if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
			projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
			vscode.window.showInformationMessage(`Current project: ${projectPath}`);
		} else {
			vscode.window.showErrorMessage('No project folder is currently open');
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

	const setOptionsCommand = vscode.commands.registerCommand('dependency-check.setOptions', 
	async () => 
	{
		const config = vscode.workspace.getConfiguration('dependency-check');
		const userInputDC = await vscode.window.showInputBox({
			prompt: 'Enter path to dependency-check/bin folder',
			placeHolder: 'Type here'
		});

		if (userInputDC) {
			vscode.window.showInformationMessage(`You entered: ${userInputDC}`);
			await config.update('pathToDC', userInputDC, vscode.ConfigurationTarget.Global);
		}

		const userInputMaven = await vscode.window.showInputBox({
			prompt: 'Enter path to Maven executable',
			placeHolder: 'Type here'
		});

		if (userInputMaven) {
			vscode.window.showInformationMessage(`You entered: ${userInputMaven}`);
			await config.update('pathToMaven', userInputMaven, vscode.ConfigurationTarget.Global);
		}

	});

	context.subscriptions.push(runDependencyCheckCommand, setOptionsCommand);
}

export function deactivate() {}