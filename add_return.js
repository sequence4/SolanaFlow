const fs = require('fs');

// Read the file
const filePath = 'server/src/utils/codeGen/handleGenerateCode.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Find the end of the file
if (content.endsWith('*/')) {
  // Add the return statement and complete the try/catch block
  content += `
      }   // end inner try

      /* ----------------------------------------------------------- *
       * 🎉  All generation steps successful – hand final data back
       * ----------------------------------------------------------- */
      return { sentinelId, programName };           // <- outer function

    } catch (err) {
      console.error('[GEN] handleGenerateCode error:', err);
      throw err;                                    // keep original stack
    }
};                                                // function ends cleanly`;
}

// Write the modified content back to the file
fs.writeFileSync(filePath, content);
console.log('Return statement added successfully');
