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

async function findConfigFiles(startPath = os.homedir()) {
  const files = await fs.readdir(startPath, { withFileTypes: true });
  let configFiles = [];
  
  for (const file of files) {
    const fullPath = path.join(startPath, file.name);
    try {
      if (file.isDirectory()) {
        configFiles = configFiles.concat(await findConfigFiles(fullPath));
      } else if (file.name.startsWith('config') && 
                (file.name.endsWith('.yml') || file.name.endsWith('.yaml'))) {
        configFiles.push(fullPath);
      }
    } catch (error) {
      if (error.code !== 'EACCES') {
        console.warn(`Warning: Skipping ${fullPath} - ${error.message}`);
      }
    }
  }
  return configFiles;
}

function formatNumber(number) {
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '_');
}

async function displayConfigTable(configs) {
  console.log('\n| Index | File Path | Setting | Current Value |');
  console.log('|--------|-----------|----------|---------------|');
  
  let index = 1;
  for (const [filePath, config] of Object.entries(configs)) {
    // if (config.TEMPORAL?.TEMPORAL_KEY) {
    //   console.log(`| ${index} | ${filePath} | TEMPORAL_KEY | ${config.TEMPORAL.TEMPORAL_KEY} |`);
    //   index++;
    // }
    // if (config.FAST?.FAST_KEY) {
    //   console.log(`| ${index} | ${filePath} | FAST_KEY | ${config.FAST.FAST_KEY} |`);
    //   index++;
    // }
    if (config.NEXTBLOCK?.NEXTBLOCK_KEY) {
      console.log(`| ${index} | ${filePath} | NEXTBLOCK_KEY | ${config.NEXTBLOCK.NEXTBLOCK_KEY} |`);
      index++;
    }
    // if (config.BLOXROUTE?.BLOXROUTE_KEY) {
    //   console.log(`| ${index} | ${filePath} | BLOXROUTE_KEY | ${config.BLOXROUTE.BLOXROUTE_KEY} |`);
    //   index++;
    // }
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
    const configFiles = await findConfigFiles();
    if (configFiles.length === 0) {
      console.log('No config files found in home directory');
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

    const totalEntries = await displayConfigTable(configs);
    const modifyAll = await askQuestion('\nDo you want to modify all settings? (y/n): ');

    if (modifyAll.toLowerCase() === 'y') {
      const newValue = parseInt((await askQuestion('Enter new KEY value: ')).replace(/_/g, ''));
      
      for (const [filePath, config] of Object.entries(configs)) {
        // if (config.TEMPORAL?.TEMPORAL_KEY) {
        //   await writeYamlFile(filePath, originalContents[filePath], 'TEMPORAL_KEY:', newValue);
        // }
        // if (config.FAST?.FAST_KEY) {
        //   await writeYamlFile(filePath, originalContents[filePath], 'FAST_KEY:', newValue);
        // }
        if (config.NEXTBLOCK?.NEXTBLOCK_KEY) {
          await writeYamlFile(filePath, originalContents[filePath], 'NEXTBLOCK_KEY:', newValue);
        }
        // if (config.BLOXROUTE?.BLOXROUTE_KEY) {
        //   await writeYamlFile(filePath, originalContents[filePath], 'BLOXROUTE_KEY:', newValue);
        // }
        console.log(`Updated ${filePath}`);
      }
    } else {
      const selectedIndex = parseInt(await askQuestion(`\nSelect index to modify (1-${totalEntries}): `));
      if (selectedIndex < 1 || selectedIndex > totalEntries) {
        console.log('Invalid index selected');
        rl.close();
        return;
      }

      const newValue = parseInt((await askQuestion('Enter new KEY value: ')).replace(/_/g, ''));
      let currentIndex = 1;
      for (const [filePath, config] of Object.entries(configs)) {
        // if (config.TEMPORAL?.TEMPORAL_KEY && currentIndex === selectedIndex) {
        //   await writeYamlFile(filePath, originalContents[filePath], 'TEMPORAL_KEY:', newValue);
        //   break;
        // }
        // currentIndex++;
        // if (config.FAST?.FAST_KEY && currentIndex === selectedIndex) {
        //   await writeYamlFile(filePath, originalContents[filePath], 'FAST_KEY:', newValue);
        //   break;
        // }
        currentIndex++;
        if (config.NEXTBLOCK?.NEXTBLOCK_KEY && currentIndex === selectedIndex) {
          await writeYamlFile(filePath, originalContents[filePath], 'NEXTBLOCK_KEY:', newValue);
          break;
        }
        // currentIndex++;
        // if (config.BLOXROUTE?.BLOXROUTE_KEY && currentIndex === selectedIndex) {
        //   await writeYamlFile(filePath, originalContents[filePath], 'BLOXROUTE_KEY:', newValue);
        //   break;
        // }
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
