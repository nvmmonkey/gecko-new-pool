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
  try {
    // Parse the existing YAML content
    const config = yaml.load(content);
    
    // Update the specific key while preserving the structure
    if (setting === 'NEXTBLOCK_KEY:') {
      if (!config.NEXTBLOCK) {
        config.NEXTBLOCK = {};
      }
      config.NEXTBLOCK.NEXTBLOCK_KEY = newValue;
    }
    
    // Convert back to YAML string with proper formatting
    const updatedContent = yaml.dump(config, {
      indent: 2,
      lineWidth: -1,
      noQuotes: true
    });
    
    // Write the updated content back to file
    await fs.writeFile(filePath, updatedContent);
  } catch (error) {
    console.error(`Error updating ${filePath}: ${error.message}`);
    throw error;
  }
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
      const newValue = await askQuestion('Enter new KEY value: ');
      
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

      const newValue = await askQuestion('Enter new KEY value: ');
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
