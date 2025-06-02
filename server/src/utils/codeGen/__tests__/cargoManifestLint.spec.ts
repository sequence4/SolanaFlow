import { validateManifest } from '../cargoManifestLint';

// Broken program-crate manifest (deliberately missing everything we care about)
const BAD_TOML = `
[package]
name = "my_program"
version = "0.1.0"
edition = "2021"

[lib]
# crate-type missing
# test / doctest flags missing

[features]
default = []
# helper features missing

[profile.release]
opt-level = "z"
`;

describe('cargoManifestLint.validateManifest()', () => {
  it('flags every required error for a program crate', () => {
    const issues = validateManifest(BAD_TOML, 'programs/my_program/Cargo.toml', false);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/\[lib] section missing required setting: crate-type/i),
        expect.stringMatching(/\[lib] section missing required setting: test = false/i),
        expect.stringMatching(/\[lib] section missing required setting: doctest = false/i),
        expect.stringMatching(/contains \[profile\.\*\] section/i),
        expect.stringMatching(/\[features] section missing required feature: cpi/i),
        expect.stringMatching(/\[features] section missing required feature: no-entrypoint/i),
      ]),
    );
  });
}); 