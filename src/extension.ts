import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) 
{
	// Terminal runner
	const execShell = (cmd: string, options: cp.ExecOptions = {}) =>
		new Promise<string>((resolve, reject) => {
			cp.exec(cmd, options, (err, out) => {
				if (err) {return reject(err);}
				return resolve(out);
			});
		});
		
	let currentPanel: vscode.WebviewPanel | undefined = undefined;

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

			const config = vscode.workspace.getConfiguration('dependency-check');
			const reportFileFormat = config.get<string>('reportFileFormat', 'JSON');
			const disableAutoUpdate = config.get<boolean>('disableAutoUpdate', true);
			currentPanel.webview.postMessage({ command: 'setReportFileFormat', format: reportFileFormat });
			currentPanel.webview.postMessage({ command: 'setDisableAutoUpdate', disableAutoUpdate});

			currentPanel.webview.onDidReceiveMessage(
				message => handleWebviewMessage(message, currentPanel, execShell),
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

	const checkInstrumentsInstallationCommand = vscode.commands.registerCommand('dependency-check.checkInstrumentsInstallation', 
	async () => {
		const commands = ['npm -v', 'mvn -v', 'java -version', 'node -v'];
    for (const command of commands) {
			try {
				const output = await execShell(command);
				vscode.window.showInformationMessage(`${command.split(' ')[0]} installed, version: ${output}`);
			} 
			catch (error) {
				vscode.window.showWarningMessage(`${command.split(' ')[0]} not installed: ${(error as Error).message}`);
			}
    }
	});

	// Command to update Dependency Check 
	const updateDependencyCheckCommand = vscode.commands.registerCommand('dependency-check.updateDependencyCheck', async () => {
		const config = vscode.workspace.getConfiguration('dependency-check');
		const pathToDC = config.get<string>('pathToDC', '');
		if (!pathToDC) {
			vscode.window.showErrorMessage("Set extension options first, path to DC 'bin' folder is empty");
			return;
		}

		const dcFolderPath = path.dirname(pathToDC);
		try {
			const isWindows = os.platform() === 'win32';
			
			// Getting latest version and compare it to current, may be bugs here
			const versionCommand = `curl https://jeremylong.github.io/DependencyCheck/current.txt`;
			const version = (await execShell(versionCommand)).trim();
			const currentVersion: Array<string> = (await execShell("dependency-check.bat -v",{ cwd: pathToDC })).trim().split(" ");
			if (currentVersion.length > 0 && version === currentVersion[currentVersion.length-1]) {
				vscode.window.showInformationMessage(`Current version is up to date`);
				return;
			}

			// Clearing the DC folder
			const deleteCommand = isWindows ? `rd /s /q "${dcFolderPath}"` : `rm -rf "${dcFolderPath}/*"`;
			await execShell(deleteCommand);
			vscode.window.showInformationMessage(`DC deleted`);

			// Uploading zip
			const FolderForDCPath = path.dirname(dcFolderPath);
			const zipPath = path.join(FolderForDCPath, 'dependency-check.zip');
			vscode.window.showInformationMessage(`Zip path: ${zipPath}`);
			const downloadCommand = `curl -L "https://github.com/jeremylong/DependencyCheck/releases/download/v${version}/dependency-check-${version}-release.zip" --output-dir "${FolderForDCPath}" --output "dependency-check.zip"`;
			await execShell(downloadCommand);

			// Unzipping
			const unzipCommand = isWindows ? `powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${FolderForDCPath}' -Force"` : `unzip -o "${zipPath}" -d "${FolderForDCPath}"`;
			await execShell(unzipCommand);

			// Deleting zip
			await execShell(isWindows ? `del "${zipPath}"` : `rm "${zipPath}"`);
			vscode.window.showInformationMessage(`Dependency Check updated to version ${version}`);
		} catch (error) {
			vscode.window.showErrorMessage(`Error updating Dependency Check: ${(error as Error).message}`);
		}
	});

	context.subscriptions.push(showExtensionWindowCommand, checkInstrumentsInstallationCommand, updateDependencyCheckCommand);

	// Tracking changes in files with dependencies
	if (vscode.workspace.workspaceFolders) {
		const dependencyFiles = ['package.json', 'packages-lock.json', 'pom.xml', 'build.gradle', 'yarn.lock']; // List of files with dependencies
		const watchers = dependencyFiles.map(file =>
			vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.workspace.workspaceFolders![0], `**/${file}`))
		);

		watchers.forEach(watcher => {
			watcher.onDidChange(uri => handleDependencyFileChange(uri));
			watcher.onDidCreate(uri => handleDependencyFileChange(uri));
			watcher.onDidDelete(uri => handleDependencyFileChange(uri));
		});

		context.subscriptions.push(...watchers);
	}

	// Tracking changes in extension settings
	vscode.workspace.onDidChangeConfiguration(event => {
		if (event.affectsConfiguration('dependency-check.reportFileFormat')) {
			const config = vscode.workspace.getConfiguration('dependency-check');
			const reportFileFormat = config.get<string>('reportFileFormat', 'JSON');
			if (currentPanel) {
				currentPanel.webview.postMessage({ command: 'setReportFileFormat', format: reportFileFormat });
			}
		}
		else if (event.affectsConfiguration('dependency-check.disableAutoUpdate')){
			const config = vscode.workspace.getConfiguration('dependency-check');
			const disableAutoUpdate = config.get<boolean>('disableAutoUpdate', true);
			if (currentPanel) {
				currentPanel.webview.postMessage({ command: 'setDisableAutoUpdate', disableAutoUpdate});
			}
		}
	});
}

export function deactivate() {}

async function handleWebviewMessage(message: any, currentPanel: vscode.WebviewPanel | undefined, execShell: (cmd: string, options?: cp.ExecOptions) => Promise<string>) {
	switch (message.command) {
		case 'runDependencyCheck':
			await runDependencyCheck(currentPanel, execShell);
			break;
	}
}

// Main function, that starts DC
async function runDependencyCheck(currentPanel: vscode.WebviewPanel | undefined, execShell: (cmd: string, options?: cp.ExecOptions) => Promise<string>) {
	const dcData = setConfigurationForDC();
	if (!dcData) {
		currentPanel?.webview.postMessage({ command: 'enableStartDCButton' });
		return;
	}
	const { pathToDC, osDCCommand, projectPath } = dcData;

	currentPanel?.webview.postMessage({ command: 'startFakeProgress' });
	try {
		await execShell(osDCCommand, { cwd: pathToDC });
	} 
	catch {
		vscode.window.showWarningMessage(`Warning! Problem in DC running. Check dependency-check-report if exists.`);
	} 
	finally {
		currentPanel?.webview.postMessage({ command: 'finishFakeProgress' });
	}
	try {
		// Creating DC report
		const jsonFilePath = path.join(projectPath, 'dependency-check-report.json');
		const jsonData = parseJsonFile(jsonFilePath);
		const vulnerableDependencies = getVulnerableDependencies(jsonData);
		const vulnerableDependenciesCount = (vulnerableDependencies.length > 0) ? vulnerableDependencies.length : 0;
		vscode.window.showInformationMessage(`Found ${vulnerableDependenciesCount} vurnerable dependencies.`);
		const reportHtml = generateHtmlReport(vulnerableDependencies);
		currentPanel?.webview.postMessage({ command: 'updateReport', html: reportHtml });
	} 
	catch (error) {
		vscode.window.showErrorMessage(`Error in creating DC report: ${(error as Error).message}`);
		currentPanel?.webview.postMessage({ command: 'errorInFakeProgress' });
	}
}

function setConfigurationForDC(): {pathToDC: string, osDCCommand: string, projectPath: string} | undefined {
	const config = vscode.workspace.getConfiguration('dependency-check');
	const pathToDC = config.get<string>('pathToDC', '');
	const reportFileFormat = config.get<string>('reportFileFormat', 'JSON');
	const disableAutoUpdate = config.get<boolean>('disableAutoUpdate', true) ? "--noupdate" : "";
	if (pathToDC.length === 0) {
		vscode.window.showErrorMessage("Set extension options first, path to DC 'bin' folder is empty");
		return;
	}

	let projectPath = '';
	if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
		projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
	} else {
		vscode.window.showErrorMessage('No project folder is currently open');
		return;
	}

	let osDCCommand = '';
	if (os.platform() === 'win32') {
		osDCCommand = `dependency-check.bat --project "Dependency Check" --scan "${projectPath}" --out "${projectPath}" "${disableAutoUpdate}" --prettyPrint --format "${reportFileFormat}"`;
	} else {
		osDCCommand = `./dependency-check.sh --project "Dependency Check" --scan "${projectPath}" --out "${projectPath}" "${disableAutoUpdate}" --prettyPrint --format "${reportFileFormat}"`;
	}

	return {pathToDC, osDCCommand, projectPath};
}

function handleDependencyFileChange(uri: vscode.Uri) {
	vscode.window.showInformationMessage('Dependency file changed. Do you want to run the Dependency Check?', 'Yes', 'No')
		.then(selection => {
			if (selection === 'Yes') {
				vscode.commands.executeCommand('dependency-check.showExtensionWindow');
			}
		});
}

// All below - DC report components
class VulnerableDependency {
	fileName: string;
	filePath: string;
	description: string;
	vulnerabilities: { name: string; severity: string; description: string }[];

	constructor(fileName: string, filePath: string, description: string, vulnerabilities: { name: string; severity: string; description: string }[]) {
		this.fileName = fileName;
		this.filePath = filePath;
		this.description = description;
		this.vulnerabilities = vulnerabilities;
	}

	static fromJson(json: any): VulnerableDependency | null {
		if (!json.vulnerabilities || json.vulnerabilities.length === 0) {
			return null;
		}

		const vulnerabilities = json.vulnerabilities.map((vul: any) => ({
			name: vul.name,
			severity: vul.severity,
			description: vul.description
		}));

		return new VulnerableDependency(
			json.fileName,
			json.filePath,
			json.description || '',
			vulnerabilities
		);
	}
}

const parseJsonFile = (filePath: string): any => {
	try{
		const data = fs.readFileSync(filePath, 'utf8');
		return JSON.parse(data);
	}
	catch(error){
		vscode.window.showErrorMessage(`Error: ${(error as Error).message}`);
		return;
	}
};

const getVulnerableDependencies = (json: any): VulnerableDependency[] => {
	return json.dependencies
			.map((dep: any) => VulnerableDependency.fromJson(dep))
			.filter((dep: VulnerableDependency | null) => dep !== null) as VulnerableDependency[];
};

const generateHtmlReport = (dependencies: VulnerableDependency[]): string => {
	let html = `
		<table>
			<thead>
				<tr>
					<th>File Name</th>
					<th>File Path</th>
					<th>Description</th>
					<th>Vulnerabilities</th>
				</tr>
			</thead>
			<tbody>
	`;

	dependencies.forEach(dep => {
		dep.vulnerabilities.forEach(vul => {
			html += `
				<tr>
					<td><strong>${dep.fileName}</strong></td>
					<td>${dep.filePath}</td>
					<td>${dep.description}</td>
					<td>
						<strong>Name:</strong> ${vul.name} <br>
						<strong>Severity:</strong> ${vul.severity} <br>
						<strong>Description:</strong> ${vul.description}
					</td>
				</tr>
			`;
		});
	});

	html += `
				</tbody>
		</table>
	`;

	return html;
};