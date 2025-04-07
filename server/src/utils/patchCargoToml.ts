import * as fs from "fs";
import * as path from "path";

export async function patchCargoToml(cargoTomlPath: string): Promise<void> {
  if (!fs.existsSync(cargoTomlPath)) {
    throw new Error(`Cargo.toml not found at: ${cargoTomlPath}`);
  }
  const originalToml = fs.readFileSync(cargoTomlPath, "utf8");

  const alreadyHasPatch = originalToml.includes("[patch.crates-io]") && 
                          originalToml.includes("bytemuck_derive =");

  if (alreadyHasPatch) {
    console.log(`[INFO] bytemuck_derive override already found in ${cargoTomlPath}. No change needed.`);
    return;
  }

  if (originalToml.includes("[patch.crates-io]")) {
    const patchedToml = originalToml.replace(
      /\[patch\.crates-io\]/,
      `[patch.crates-io]\nbytemuck_derive = "=1.8.1"`
    );
    fs.writeFileSync(cargoTomlPath, patchedToml, "utf8");
    console.log(`[INFO] Inserted bytemuck_derive override in existing [patch.crates-io] block.`);
  } else {
    const appendedToml = `${originalToml.trim()}

[patch.crates-io]
bytemuck_derive = "=1.8.1"
`;
    fs.writeFileSync(cargoTomlPath, appendedToml, "utf8");
    console.log(`[INFO] Added new [patch.crates-io] block with bytemuck_derive override.`);
  }
}

if (require.main === module) {
  (async () => {
    try {
      const cargoTomlPath = process.argv[2];
      if (!cargoTomlPath) {
        throw new Error("Usage: ts-node patchCargoToml.ts /path/to/Cargo.toml");
      }
      await patchCargoToml(path.resolve(cargoTomlPath));
      console.log("[SUCCESS] Cargo.toml patched successfully.");
    } catch (err: any) {
      console.error("[ERROR]", err.message || err);
      process.exit(1);
    }
  })();
} 