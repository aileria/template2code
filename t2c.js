const config = require('./t2c.config');
const fs = require('fs');
const readline = require('readline');

let templateStructure;
let templateVars = {};

const placeholderRegex = new RegExp(
    `${config.placeholder.start}([^(${config.placeholder.start})(${config.placeholder.end})]*)${config.placeholder.end}`,
    "g"
);


// UTILITY FUNCTIONS

function exitWithError(msg) {
    console.error(`${config.colors.error}${msg}`);
    process.exit(1);
}

function requestUserInput(questions) {
    const askQuestion = (rl, question) => {
        return new Promise(resolve => {
            rl.question(question, (answer) => {
                resolve(answer);
            });
        });
    }
    return new Promise(async resolve => {
        let rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        let results = {};
        for (let i = 0; i < questions.length; i++) {
            results[questions[i].name] = await askQuestion(rl, questions[i].question);
        }
        rl.close();
        resolve(results);
    });
}

function registerTemplateVarsFromSource(source) {
    source.match(placeholderRegex)?.forEach(keyword => {
        const varName = keyword.slice(config.placeholder.start.length, -config.placeholder.end.length);
        templateVars[varName] = null;
    });
}

function readAvailableTemplates() {
    return fs.readdirSync(config.templateDir)
        .filter(file => fs.lstatSync(`${config.templateDir}/${file}`).isDirectory());
}

function parseTemplate(templateDirName) {
    return parseTemplateStructure(`${config.templateDir}/${templateDirName}`);
}

function parseTemplateStructure(rootDir) {
    const getFileContent = (fileName) => {
        const buffer = fs.readFileSync(fileName);
        return buffer.toString();
    }

    let res = {};
    fs.readdirSync(rootDir).forEach(fileOrDirName => {
        const fullPath = `${rootDir}/${fileOrDirName}`;
        registerTemplateVarsFromSource(fullPath);
        if (fs.lstatSync(fullPath).isDirectory()) {
            res[fileOrDirName] = parseTemplateStructure(fullPath);
        } else {
            const fileContent = getFileContent(fullPath);
            registerTemplateVarsFromSource(fileContent);
            res[fileOrDirName] = fileContent;
        }
    });
    return res;
}

function generateFinalStructure(rootNode) {
    const generateFinalString = (str) => {
        return str.replace(placeholderRegex, (r, k) => {
            if (templateVars[k] === undefined) {
                console.error(`No value provided for ${k}` + '\033[0m');
                process.exit(1);
            }
            return templateVars[k];
        });
    }

    const res = {};
    Object.keys(rootNode).forEach(node => {
        res[generateFinalString(node)] = typeof rootNode[node] === 'string'
            ? generateFinalString(rootNode[node])
            : generateFinalStructure(rootNode[node]);
    })
    return res;
}

function writeStructureToFilesystem(parentNode, rootDir) {
    Object.entries(parentNode).forEach(([node, value]) => {
        const writeDir = `${rootDir}/${node}`;
        if (typeof value === 'string') {
            fs.writeFileSync(writeDir, value);
        } else {
            if (!fs.existsSync(writeDir)) fs.mkdirSync(writeDir);
            writeStructureToFilesystem(value, writeDir);
        }
    })
}


// MAIN ACTIONS

function requestTemplateFromUser() {
    const availableTemplates = readAvailableTemplates();
    if (availableTemplates.length === 0) exitWithError('No templates found');

    console.log('Available templates:\n');
    availableTemplates.forEach((template, index) =>
        console.log(`${index}. ${config.colors.templateName}${template}${config.colors.reset}`));
    console.log();

    return requestUserInput(
        [{
            name: 0,
            question: `Select a template (0-${availableTemplates.length}): `,
        }]
    ).then(answers => {
        let templateName = availableTemplates[answers[0]];
        if (!templateName) exitWithError(`Template not found`);
        templateStructure = parseTemplate(templateName);
        console.log(`Using template: ${config.colors.templateName}${templateName}${config.colors.reset}`);
    });
}

function requestValuesFromUser() {
    console.log(`\nInput one value for each variable:\n`);
    return requestUserInput(
        Object.keys(templateVars).map(key => {
            return {
                name: key,
                question: `${config.colors.placeholderName}${key}${config.colors.reset} = `
            }
        })
    ).then(answers => {
        templateVars = answers;
        Object.keys(templateVars).forEach(key => {
            if (!templateVars[key]) {
                exitWithError(`No valid value provided for: ${config.colors.placeholderName}${key}`);
            }
        })
    });
}

function saveChanges() {
    const finalStructure = generateFinalStructure(templateStructure);
    writeStructureToFilesystem(finalStructure, config.generationDir);
    console.log(`${config.colors.success}\nDone!`);
}


// ENTRYPOINT

console.log(`
 _                       _       _        _____               _      
| |                     | |     | |      / __  \\             | |     
| |_ ___ _ __ ___  _ __ | | __ _| |_ ___ \`' / /' ___ ___   __| | ___ 
| __/ _ \\ '_ \` _ \\| '_ \\| |/ _\` | __/ _ \\  / /  / __/ _ \\ / _\` |/ _ \\
| ||  __/ | | | | | |_) | | (_| | ||  __/./ /__| (_| (_) | (_| |  __/
 \\__\\___|_| |_| |_| .__/|_|\\__,_|\\__\\___|\\_____/\\___\\___/ \\__,_|\\___|
                  | |                                                
                  |_|                                                
`)
requestTemplateFromUser().then(requestValuesFromUser).then(saveChanges);
