const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const readline = require('readline');
const os = require('os');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function askQuestion(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function findConfigFiles(currentPath) {
  try {
    const files = await fs.readdir(currentPath, { withFileTypes: true });
    let configFiles = [];
    
    for (const file of files) {
      const fullPath = path.join(currentPath, file.name);
      if (file.isDirectory()) {
        configFiles = configFiles.concat(await findConfigFiles(fullPath));
      } else if (/^config(\.[a-zA-Z0-9]+)*\.yaml$/.test(file.name)) {
        configFiles.push(fullPath);
      }
    }
    return configFiles;
  } catch (error) {
    console.error(`Error reading directory ${currentPath}:`, error.message);
    return [];
  }
}

function formatNumber(number) {
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '_');
}

async function displayConfigTable(configs, selectedOption) {
  console.log('\n| Index | File Path | Setting | Current Value |');
  console.log('|--------|-----------|----------|---------------|');
  
  let index = 1;
  for (const [filePath, config] of Object.entries(configs)) {
    if (config.JITO?.[selectedOption]) {
      console.log(`| ${index} | ${filePath} | ${selectedOption} | ${config.JITO[selectedOption]} |`);
      index++;
    }
    // Add similar checks for other config options as needed
  }
  return index - 1;
}

async function readYamlFile(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  return content;
}

async function writeYamlFile(filePath, content, setting, newValue) {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(setting)) {
      lines[i] = lines[i].replace(/\d+(_\d+)*/, formatNumber(newValue));
      break;
    }
  }
  await fs.writeFile(filePath, lines.join('\n'));
}

async function modifyConfigs() {
  try {
    const homeDir = os.homedir();
    const configFiles = await findConfigFiles(homeDir);
    if (configFiles.length === 0) {
      console.log('No config files found');
      rl.close();
      return;
    }

    const configs = {};
    const originalContents = {};
    for (const file of configFiles) {
      const content = await readYamlFile(file);
      originalContents[file] = content;
      configs[file] = yaml.load(content);
    }

    // Prompt user for which config to modify
    const configOptions = ['STATIC_TIP_BP', 'TEMPORAL_DYNAMIC_FEE_BP', 'FAST_DYNAMIC_FEE_BP', 'NEXTBLOCK_DYNAMIC_FEE_BP', 'BLOXROUTE_DYNAMIC_FEE_BP'];
    console.log('Which configuration do you want to modify?');
    configOptions.forEach((option, index) => {
      console.log(`${index + 1}. ${option}`);
    });

    const selectedOptionIndex = parseInt(await askQuestion(`Select an option (1-${configOptions.length}): `));
    if (selectedOptionIndex < 1 || selectedOptionIndex > configOptions.length) {
      console.log('Invalid option selected');
      rl.close();
      return;
    }

    const selectedOption = configOptions[selectedOptionIndex - 1];

    // Display the current configuration table for the selected option
    const totalEntries = await displayConfigTable(configs, selectedOption);

    const modifyAll = await askQuestion(`Do you want to modify all settings for ${selectedOption}? (y/n): `);

    if (modifyAll.toLowerCase() === 'y') {
      const newValue = parseInt((await askQuestion('Enter new BP value: ')).replace(/_/g, ''));
      
      for (const [filePath, config] of Object.entries(configs)) {
        if (config.JITO?.[selectedOption]) {
          await writeYamlFile(filePath, originalContents[filePath], `${selectedOption}:`, newValue);
        }
        // Add similar checks for other config options as needed
      }
    } else {
      const selectedIndex = parseInt(await askQuestion(`\nSelect index to modify (1-${totalEntries}): `));
      if (selectedIndex < 1 || selectedIndex > totalEntries) {
        console.log('Invalid index selected');
        rl.close();
        return;
      }

      const newValue = parseInt((await askQuestion('Enter new BP value: ')).replace(/_/g, ''));
      let currentIndex = 1;
      for (const [filePath, config] of Object.entries(configs)) {
        if (config.JITO?.STATIC_TIP_BP && currentIndex === selectedIndex) {
          await writeYamlFile(filePath, originalContents[filePath], 'STATIC_TIP_BP:', newValue);
          break;
        }
        currentIndex++;
        if (config.TEMPORAL?.TEMPORAL_DYNAMIC_FEE_BP && currentIndex === selectedIndex) {
          await writeYamlFile(filePath, originalContents[filePath], 'TEMPORAL_DYNAMIC_FEE_BP:', newValue);
          break;
        }
        currentIndex++;
        if (config.FAST?.FAST_DYNAMIC_FEE_BP && currentIndex === selectedIndex) {
          await writeYamlFile(filePath, originalContents[filePath], 'FAST_DYNAMIC_FEE_BP:', newValue);
          break;
        }
        currentIndex++;
        if (config.NEXTBLOCK?.NEXTBLOCK_DYNAMIC_FEE_BP && currentIndex === selectedIndex) {
          await writeYamlFile(filePath, originalContents[filePath], 'NEXTBLOCK_DYNAMIC_FEE_BP:', newValue);
          break;
        }
        currentIndex++;
        if (config.BLOXROUTE?.BLOXROUTE_DYNAMIC_FEE_BP && currentIndex === selectedIndex) {
          await writeYamlFile(filePath, originalContents[filePath], 'BLOXROUTE_DYNAMIC_FEE_BP:', newValue);
          break;
        }
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    rl.close();
  }
}

// Start the script
modifyConfigs();
