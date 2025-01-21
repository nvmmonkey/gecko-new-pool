const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function askQuestion(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function findConfigFiles(currentPath) {
  const files = await fs.readdir(currentPath, { withFileTypes: true });
  let configFiles = [];
  
  for (const file of files) {
    const fullPath = path.join(currentPath, file.name);
    if (file.isDirectory()) {
      configFiles = configFiles.concat(await findConfigFiles(fullPath));
    } else if (file.name.startsWith('config') && 
              (file.name.endsWith('.yml') || file.name.endsWith('.yaml'))) {
      configFiles.push(fullPath);
    }
  }
  return configFiles;
}

function formatNumber(number) {
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '_');
}

async function displayConfigTable(configs) {
  console.log('\n| Index | File Path | Token | Current MIN_QUOTE_PROFIT |');
  console.log('|--------|-----------|--------|----------------------|');
  
  let index = 1;
  for (const [filePath, config] of Object.entries(configs)) {
    if (config.BLIND_QUOTE_STRATEGY?.BASE_MINTS) {
      for (const mint of config.BLIND_QUOTE_STRATEGY.BASE_MINTS) {
        const tokenSymbol = mint.MINT === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' ? 'USDC' :
                           mint.MINT === 'So11111111111111111111111111111111111111112' ? 'SOL' : 
                           mint.MINT.slice(0, 8) + '...';
        console.log(`| ${index} | ${filePath} | ${tokenSymbol} | ${mint.MIN_QUOTE_PROFIT} |`);
        index++;
      }
    }
  }
  return index - 1;
}

async function readYamlFile(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  return content;
}

async function writeYamlFile(filePath, content, newValue, mintIndex) {
  const lines = content.split('\n');
  let inBaseMints = false;
  let currentMintIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('BASE_MINTS:')) {
      inBaseMints = true;
    } else if (inBaseMints && lines[i].includes('MIN_QUOTE_PROFIT:')) {
      currentMintIndex++;
      if (currentMintIndex === mintIndex) {
        lines[i] = lines[i].replace(/\d+(_\d+)*/, formatNumber(newValue));
        break;
      }
    }
  }

  await fs.writeFile(filePath, lines.join('\n'));
}

async function modifyConfigs() {
  try {
    const configFiles = await findConfigFiles('.');
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

    const totalEntries = await displayConfigTable(configs);
    const modifyAll = await askQuestion('\nDo you want to modify all config files? (y/n): ');

    if (modifyAll.toLowerCase() === 'y') {
      const newValue = parseInt((await askQuestion('Enter new MIN_QUOTE_PROFIT value: ')).replace(/_/g, ''));

      for (const [filePath, config] of Object.entries(configs)) {
        if (config.BLIND_QUOTE_STRATEGY?.BASE_MINTS) {
          for (let i = 0; i < config.BLIND_QUOTE_STRATEGY.BASE_MINTS.length; i++) {
            await writeYamlFile(filePath, originalContents[filePath], newValue, i);
          }
          console.log(`Updated ${filePath}`);
        }
      }
    } else {
      const selectedIndex = parseInt(await askQuestion(`\nSelect index to modify (1-${totalEntries}): `));
      if (selectedIndex < 1 || selectedIndex > totalEntries) {
        console.log('Invalid index selected');
        rl.close();
        return;
      }

      const newValue = parseInt((await askQuestion('Enter new MIN_QUOTE_PROFIT value: ')).replace(/_/g, ''));
      let currentIndex = 1;
      for (const [filePath, config] of Object.entries(configs)) {
        if (config.BLIND_QUOTE_STRATEGY?.BASE_MINTS) {
          for (let i = 0; i < config.BLIND_QUOTE_STRATEGY.BASE_MINTS.length; i++) {
            if (currentIndex === selectedIndex) {
              await writeYamlFile(filePath, originalContents[filePath], newValue, i);
              console.log(`Updated ${filePath} with value ${formatNumber(newValue)}`);
              break;
            }
            currentIndex++;
          }
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
