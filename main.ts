/* eslint-disable no-console */
import childProcess from 'child_process';
import inquirer from 'inquirer';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import spdxList from 'spdx-license-ids';
import { repos } from './consts';

interface UserInfo {
  name: string;
  cliName: string;
  desc: string;
  author: string;
  version: string;
  license: string;
  useGit: boolean;
}

interface GitOptions {
  commitMsg: string;
}

const licenseIds = spdxList.map((item) => item.toLowerCase());

const init = async () => {
  // input info
  console.log(
    chalk.cyan('We need some necessary information to initialize your typescript cli project:'),
  );
  const userInfo: UserInfo = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Project Name: ',
      validate: (v) => {
        if (!v) {
          return 'Project name should not be empty.';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'cliName',
      message: 'Command line interface name: ',
      validate: (v) => {
        if (!v) {
          return 'Command line interface name should not be empty.';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'desc',
      message: 'Description: ',
      default: '',
    },
    {
      type: 'input',
      name: 'version',
      message: 'Version: ',
      default: '0.0.0',
    },
    {
      type: 'input',
      name: 'author',
      message: 'Author: ',
      default: '',
    },
    {
      type: 'input',
      name: 'license',
      message: 'License: ',
      default: 'MIT',
      validate: (v) => {
        return licenseIds.includes(v.toLowerCase()) ? true : 'Invalid license.';
      },
    },
    {
      type: 'confirm',
      name: 'useGit',
      message: 'Do you want to use Git to manage your project?',
      default: true,
    },
  ]);
  const gitOptions: GitOptions = await inquirer.prompt([
    {
      type: 'input',
      name: 'commitMsg',
      message: 'First commit message: ',
      default: 'First commit',
    },
  ]);
  const projectPath = path.resolve(process.cwd(), `./${userInfo.name}`);
  if (fs.existsSync(projectPath)) {
    const stat = fs.statSync(projectPath);
    if (stat.isDirectory()) {
      const confirm = await inquirer.prompt({
        type: 'confirm',
        name: 'v',
        message: `The folder named ${userInfo.name} already exists in the current directory, do you want to continue creating your project?`,
        default: false,
      });
      if (!confirm.v) {
        return;
      }
      const delConfirm = await inquirer.prompt({
        type: 'confirm',
        name: 'v',
        message: 'Do you want to empty the directory and then create the project?',
        default: false,
      });
      if (delConfirm.v) {
        fs.rmSync(projectPath, { recursive: true, force: true });
      }
    }
  } else {
    fs.mkdirSync(projectPath);
  }
  // clone repo
  console.log(chalk.cyan('Very well, next we will clone the boilerplate into the project folder.'));
  const branch = 'main';
  console.log(`git clone ${repos.defaultBoilerplate} -b ${branch} --depth 1 .`);
  childProcess.execSync(`git clone ${repos.defaultBoilerplate} -b ${branch} --depth 1 .`, {
    stdio: 'inherit',
    cwd: projectPath,
  });
  // install dependencies
  console.log(chalk.cyan('Looks good, we still need to do some final work to finish.'));
  childProcess.execSync('npm install', {
    stdio: 'inherit',
    cwd: projectPath,
  });
  // modify package.json
  const packageInfoPath = path.resolve(projectPath, './package.json');
  if (fs.existsSync(packageInfoPath)) {
    const packageInfo = JSON.parse(fs.readFileSync(packageInfoPath, { encoding: 'utf8' }));
    const { name, author, license, desc, version } = userInfo;
    Object.assign(packageInfo, {
      name,
      author,
      license,
      version,
      description: desc,
    });
    if (!packageInfo.bin) {
      packageInfo.bin = {};
    }
    packageInfo.bin[userInfo.cliName] = './bin/cli.js';
    fs.writeFileSync(packageInfoPath, JSON.stringify(packageInfo, null, '  '), {
      encoding: 'utf-8',
    });
  } else {
    console.log(
      chalk.yellow(
        'We did not find an available package.json, you may need to modify it manually by yourself.',
      ),
    );
  }
  // git
  if (userInfo.useGit) {
    console.log(chalk.cyan('Creating git repository...'));
    childProcess.execSync(`git init && git add . && git commit -m "${gitOptions.commitMsg}"`, {
      cwd: projectPath,
    });
  }
  // done
  console.log(
    chalk.green(
      `\n\n====================\n\nAll things done, you can build up your project now!\n\nHow to build your project: \n\ncd ./${userInfo.name}\nnpm run build\n\n`,
    ),
  );
};

// execute

init();
