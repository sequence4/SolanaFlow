const fs = require('fs');

// Read the file
const filePath = 'server/src/utils/codeGen/handleGenerateCode.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add the return statement and complete the try/catch block
const endOfFile = `         * (/usr/src/target/deploy) so the file survives the later
         *   rm -rf target/deploy && ln -sfnT /usr/src/target/deploy target/deploy
         * step.  This guarantees Anchor re-uses the same key-pair it sees
         * during code-gen, eliminating the phantom "second" Program ID.
         */`;

const replacement = `         * (/usr/src/target/deploy) so the file survives the later
         *   rm -rf target/deploy && ln -sfnT /usr/src/target/deploy target/deploy
         * step.  This guarantees Anchor re-uses the same key-pair it sees
         * during code-gen, eliminating the phantom "second" Program ID.
         */
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

content = content.replace(endOfFile, replacement);

// Write the modified content back to the file
fs.writeFileSync(filePath, content);
console.log('File updated successfully');
