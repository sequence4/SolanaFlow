const fs = require('fs');

// Read the file
const filePath = 'server/src/utils/codeGen/handleGenerateCode.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Step 1: Add sentinelId and programName declarations at the top level
content = content.replace(
  /export const handleGenerateCode = async \(\{[\s\S]*?\}: Args\): Promise<\{ sentinelId: string; programName: string \}> => \{[\s\S]*?const isDevServer = process\.env\.SF_DEV_SERVER === '1';/,
  match => match + `

  /* ------------------------------------------------------------- *
   * Values we fill during generation and return at the very end
   * ------------------------------------------------------------- */
  let sentinelId = '';
  let programName = '';`
);

// Step 2: Replace any const programName declarations with assignments
content = content.replace(
  /let programName = 'my_program';([\s\S]*?)if \(projName\) \{[\s\S]*?programName = normalizeProjectName\(projName\);[\s\S]*?\}/,
  match => match
);

// Step 3: Fix the sentinelId declarations
content = content.replace(
  /const programId\s*=\s*programKeypair\.publicKey\.toBase58\(\);[\s\S]*?const sentinelId\s*=\s*programId;/g,
  'const programId = programKeypair.publicKey.toBase58();\n        sentinelId = programId;                       // <-- assign'
);

// Step 4: Remove any duplicate sentinelId declarations
content = content.replace(
  /\/\*\*[\s\S]*?\* Anchor's "sentinel" build task[\s\S]*?\*\/[\s\S]*?const sentinelId = programId;/g,
  '/**\n         * Anchor\'s "sentinel" build task (created a few lines above)\n         * resolves to this deterministic program ID, so we can safely\n         * expose it as the sentinel ID for callers.\n         */'
);

// Step 5: Add the final return statement at the end of the function
content = content.replace(
  /\s*\}\s*\/\/\s*←\s*closes\s*"try\s*\{"\s*[\s\S]*?\/\*[\s\S]*?file continued without returning[\s\S]*?\*\/\s*\};/,
  `
      }   // end inner try

      /* ----------------------------------------------------------- *
       * 🎉  All generation steps successful – hand final data back
       * ----------------------------------------------------------- */
      return { sentinelId, programName };           // <- outer function

    } catch (err) {
      console.error('[GEN] handleGenerateCode error:', err);
      throw err;                                    // keep original stack
    }
};                                                // function ends cleanly`
);

// Write the modified content back to the file
fs.writeFileSync(filePath, content);
console.log('File updated successfully');
