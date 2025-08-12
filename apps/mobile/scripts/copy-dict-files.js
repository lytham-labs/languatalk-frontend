// copyDictFiles.js
const fs = require('fs-extra');
const path = require('path');

const japaneseSourceDir = path.join(__dirname, '../node_modules', 'kuromoji', 'dict');
// const pinyinSourceDir = path.join(__dirname, '../node_modules', '', 'dict');
const destDir = path.join(__dirname, '../assets', 'dict'); // Change this to your desired destination

async function copyDictFiles() {
  try {
    await fs.copy(sourceDir, destDir);
    console.log('Dictionary files copied successfully!');
  } catch (err) {
    console.error('Error copying dictionary files:', err);
  }
}

copyDictFiles();