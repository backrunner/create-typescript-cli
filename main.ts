/* eslint-disable no-console */
import childProcess from 'child_process';
import inquirer from 'inquirer';
import chalk from 'chalk';
import path from 'path';
import ejs from 'ejs';
import fs from 'fs';
import fsp from 'fs/promises';
import spdxList from 'spdx-license-ids';
import npmName from 'npm-name';
import { repos } from './consts';
import README_TEMPLATE from './templates/Readme.md.ejs';

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

const UNNECESSARY_FILES = ['./CHANGELOG.md'];
const UNNECESSARY_PACKAGE_INFO = ['keywords', 'bugs', 'repository', 'homepage'];

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
      message: 'Package Name: ',
      validate: async (v) => {
        if (!v) {
          return 'Package name should not be empty.';
        }

        let checkRes = true;
        try {
          checkRes = await npmName(v);
        } catch (err: unknown) {
          return (err as Error).message;
        }

        if (!checkRes) {
          const confirmRes = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'stillUse',
              message: 'This package name has existed on npm, still use it?',
            },
          ]);
          if (!confirmRes.stillUse) {
            return 'Package name existed on npm.';
          }
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
        return licenseIds.includes(v.toLowerCase())
          ? true
          : 'Invalid license.\nLicense should be the identifier in the SPDX License list.\nSee https://spdx.org/licenses/ for more details.';
      },
    },
    {
      type: 'confirm',
      name: 'useGit',
      message: 'Do you want to use Git to manage your project?',
      default: true,
    },
  ]);
  let gitOptions: GitOptions | null = null;
  if (userInfo.useGit) {
    gitOptions = await inquirer.prompt([
      {
        type: 'input',
        name: 'commitMsg',
        message: 'First commit message: ',
        default: 'First commit',
      },
    ]);
  }
  const projectPath = path.resolve(process.cwd(), `./${userInfo.name}`);
  if (fs.existsSync(projectPath)) {
    const stat = await fsp.stat(projectPath);
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
        await fsp.rm(projectPath, { recursive: true, force: true });
      }
    }
  } else {
    await fsp.mkdir(projectPath, { recursive: true });
  }
  // clone repo
  console.log(chalk.cyan('Very well, next we will clone the boilerplate into the project folder.'));
  const branch = 'main';
  console.log(`git clone ${repos.defaultBoilerplate} -b ${branch} --depth 1 .`);
  childProcess.execSync(`git clone ${repos.defaultBoilerplate} -b ${branch} --depth 1 .`, {
    stdio: 'inherit',
    cwd: projectPath,
  });
  // delete unnecessary files
  await Promise.all(
    UNNECESSARY_FILES.map((filePath) => {
      return fsp.rm(path.resolve(projectPath, filePath), { force: true });
    }),
  );
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
    packageInfo.bin = {
      [userInfo.cliName]: './bin/cli.js',
    };
    UNNECESSARY_PACKAGE_INFO.forEach((key) => {
      delete packageInfo[key];
    });
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
  // modify Readme.md
  const potentialReadmePath = ['./reamde.md', './README.md', './Readme.md'];
  const readmePath = path.resolve(projectPath, './Readme.md');
  const readmeExists = potentialReadmePath.reduce(
    (res, item) => {
      if (res.exists) {
        return res;
      }
      const itemPath = path.resolve(projectPath, item);
      if (fs.existsSync(itemPath)) {
        return {
          exists: true,
          path: itemPath,
        };
      }
      return res;
    },
    {
      exists: false,
      path: '',
    },
  );
  if (readmeExists.exists) {
    await fsp.rm(readmeExists.path, { force: true });
  }
  await fsp.writeFile(
    readmePath,
    ejs.render(README_TEMPLATE, {
      name: userInfo.name,
      desc: userInfo.desc,
      license: userInfo.license,
    }),
    { encoding: 'utf-8' },
  );
  // setup git
  const gitDataPath = path.resolve(projectPath, './.git');
  if (fs.existsSync(gitDataPath)) {
    // whether user determined, remove the original .git folder
    await fsp.rm(gitDataPath, { recursive: true, force: true });
  }
  if (userInfo.useGit) {
    console.log(chalk.cyan('Creating git repository...'));
    childProcess.execSync(
      `git init && git add . && git commit -m "${gitOptions?.commitMsg || 'First commit'}"`,
      {
        cwd: projectPath,
      },
    );
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
