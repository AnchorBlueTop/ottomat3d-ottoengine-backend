# OttoStudio - Build & Sign Instructions

Instructions for Harshil to build and sign OttoStudio using his Apple Developer license.

---

## Build Commands

From the **root directory** (`ottostudio/`):

### Apple Silicon (arm64)
```bash
cd /path/to/ottostudio
npm run package:signed
```

### Intel Mac (x64)
```bash
cd /path/to/ottostudio
npm run package:signed:x64
```

---

## Output Location

Built apps will be in:
```
out/OttoStudio-darwin-{arch}/OttoStudio.app
```

Where `{arch}` is:
- `arm64` for Apple Silicon
- `x64` for Intel Mac

---

To run packaged app with console:
Open Terminal:
harshilpatel@Harshils-MacBook-Pro ottostudio % /Users/harshilpatel/Desktop/Projects/MCP/ottostudio/out/OttoStudio-darwin-arm64/OttoStudio.app/Contents/MacOS/OttoStudio

**Note:** Signing uses the Developer ID certificate configured in `scripts/sign.js`

