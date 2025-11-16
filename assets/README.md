# OttoStudio App Icons

Place your application icons in this directory for packaging.

## Required Icons:

### Windows (.ico)
- `icon.ico` - 256x256 icon for Windows installer and taskbar

### macOS (.png)
- `icon.png` - 512x512 or 1024x1024 PNG icon for macOS

### Linux (.png)
- `icon.png` - 512x512 PNG icon for Linux

## Icon Requirements:

- **Format**: ICO (Windows), PNG (macOS/Linux)
- **Size**: At least 512x512 pixels (1024x1024 recommended)
- **Background**: Transparent or your brand color
- **Style**: Simple, recognizable at small sizes

## Temporary Placeholder:

If you don't have icons yet, Electron will use default icons. You can add your custom icons later and rebuild the app.

## Creating Icons:

You can use tools like:
- **Online**: https://www.icoconverter.com/ (PNG → ICO)
- **Design**: Figma, Adobe Illustrator, or Inkscape
- **Conversion**: ImageMagick, GIMP

Example with ImageMagick:
```bash
# Create ICO from PNG
convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
```
