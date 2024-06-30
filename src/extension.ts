import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) 
{
	console.log('Congratulations, your extension "DependencyCheck" is now active!');

	let currentPanel: vscode.WebviewPanel | undefined = undefined;

	const execShell = (cmd: string, options: cp.ExecOptions = {}) =>
		new Promise<string>((resolve, reject) => {
			cp.exec(cmd, options, (err, out) => {
				if (err) {return reject(err);}
				return resolve(out);
			});
		});

	const showExtensionWindowCommand = vscode.commands.registerCommand('dependency-check.showExtensionWindow', 
	async () => 
	{
		const columnToShowIn = vscode.window.activeTextEditor
		? vscode.window.activeTextEditor.viewColumn
		: undefined;

		if (currentPanel) {
			currentPanel.reveal(columnToShowIn);
		} else {
			currentPanel = vscode.window.createWebviewPanel(
				'dependency-check',
				'Dependency Check',
				columnToShowIn || vscode.ViewColumn.One,
				{
					enableScripts: true,
					retainContextWhenHidden: true
				}
			);

			const htmlPath = path.join(context.extensionPath, 'webview.html');
			const htmlContent = fs.readFileSync(htmlPath, 'utf8');
			currentPanel.webview.html = htmlContent;

			currentPanel.webview.onDidReceiveMessage(
				async message => {
					switch (message.command) {
						case 'runDependencyCheck':
							const dcData = setConfigurationForDC();
							if (!dcData) {return;}
							const { pathToDC, osDCCommand } = dcData;

							currentPanel?.webview.postMessage({ command: 'startFakeProgress' });
							try {
								vscode.window.showInformationMessage('Started Dependency Check');
								await execShell(osDCCommand, { cwd: pathToDC });
								currentPanel?.webview.postMessage({ command: 'finishFakeProgress' });
							} catch (error) {
								vscode.window.showErrorMessage(`Error: ${(error as Error).message}`);
								currentPanel?.webview.postMessage({ command: 'errorInFakeProgress' });
							}
							break;
					}
				},
				undefined,
				context.subscriptions
			);

			currentPanel.onDidDispose(
				() => {
					currentPanel = undefined;
				},
				null,
				context.subscriptions
			);
		}
	});

	context.subscriptions.push(showExtensionWindowCommand);
}

export function deactivate() {}

function setConfigurationForDC(): {pathToDC: string, osDCCommand: string} | undefined {
	const config = vscode.workspace.getConfiguration('dependency-check');
	const pathToDC = config.get<string>('pathToDC', '');
	if (pathToDC.length === 0) {
		vscode.window.showErrorMessage("Set extension options first, path to DC 'bin' folder is empty");
		return;
	}

	let projectPath = '';
	if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
		projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
		//vscode.window.showInformationMessage(`Current project: ${projectPath}`);
	} else {
		vscode.window.showErrorMessage('No project folder is currently open');
		return;
	}

	let osDCCommand = '';
	if (os.platform() === 'win32') {
		osDCCommand = `dependency-check.bat --project "Dependency Check" --scan "${projectPath}" --out "${projectPath}" --noupdate --prettyPrint --format "JSON"`;// add "--noupdate" in case of no response
	} else {
		osDCCommand = `./dependency-check.sh --project "Dependency Check" --scan "${projectPath}" --out "${projectPath}" --noupdate --prettyPrint --format "JSON"`;
	}

	return {pathToDC, osDCCommand};
}