# BiBaBenchBuddy

### Free Molecular Biology Lab Calculators & Bench Tools

<a href="https://github.com/DaphneHoutackers/BiBaBenchBuddy/releases/latest">
  <img src="https://img.shields.io/github/v/release/DaphneHoutackers/BiBaBenchBuddy?style=for-the-badge&logo=github&label=release" height="20" />
</a>
<img src="https://img.shields.io/github/downloads/DaphneHoutackers/BiBaBenchBuddy/total?style=for-the-badge&label=downloads" height="20" />
<a href="https://bi-ba-bench-buddy.vercel.app/">
  <img src="https://img.shields.io/badge/Webapp-BF5FFF?style=for-the-badge&logo=vercel&logoColor=white" height="20" />
</a>
<a href="https://github.com/DaphneHoutackers/BiBaBenchBuddy/releases/latest/download/BiBaBenchBuddy-mac-arm64.dmg">
  <img src="https://img.shields.io/badge/macOS-black?style=for-the-badge&logo=apple&logoColor=white" height="20" />
</a>
<a href="https://github.com/DaphneHoutackers/BiBaBenchBuddy/releases/latest/download/BiBaBenchBuddy-Setup.exe">
  <img src="https://img.shields.io/badge/Windows-blue?style=for-the-badge&logo=android&logoColor=white" height="20" />
</a>
<a href="https://buymeacoffee.com/daphnewoodpecker">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" height="20" />
</a>

BiBaBenchBuddy is a free molecular biology laboratory toolkit for everyday bench work. It combines commonly used lab calculators, visualization tools, DNA analysis and protocol support in one desktop and web application.

Use BiBaBenchBuddy for PCR setup, restriction digests, DNA ligation, Gibson assembly, dilutions, protein assays, buffer preparation, gel electrophoresis, western blot simulation, plasmid and DNA sequence analysis, and molecular biology protocols.

![BiBaBenchBuddy molecular biology laboratory calculator and bench toolkit](/docs/app-screenshot.png)

## Features

- DNA digestion calculator
- Ligation calculator
- Gibson calculator
- PCR setup & optimization tools
- Dilution and concentration calculators
- Gel electrophoresis and western blot simulator
- Buffer library & calculator
- Clean, fast, mobile-friendly interface

## Use & Installation

### WebApp [Open webapp ↗](https://bi-ba-bench-buddy.vercel.app/)

The latest webapp version is accessible in any browser at: **[https://bi-ba-bench-buddy.vercel.app/](https://bi-ba-bench-buddy.vercel.app/)**

### Desktop App [Download app ↗](https://github.com/DaphneHoutackers/BiBaBenchBuddy/releases)

For a standalone experience with native performance download the latest release for **[macOS](https://github.com/DaphneHoutackers/BiBaBenchBuddy/releases/latest/download/BiBaBenchBuddy-mac-arm64.dmg)** or **[Windows](https://github.com/DaphneHoutackers/BiBaBenchBuddy/releases/latest/download/BiBaBenchBuddy-Setup.exe)**

If you see the warning "BiBaBenchBuddy.app is damaged and can’t be opened. You should move it to the Trash" when opening the app for the first time, run the following command in your Terminal:

```bash
xattr -cr "/Applications/BiBaBenchBuddy.app"
```

After running this, try opening the app again. The warning should now be resolved.

## Usage

Click the **Settings** icon in the top right:

- **Sync:** Log in with **Email** or **GitHub** to keep your sessions and settings synced across your laptop and web browser.
- **AI Settings:** Paste your API keys (e.g., Google Gemini or OpenAI) to unlock the AI Assistant.

## Features

**Calculators**

- **Digestion**: Batch process restriction digests with a vast library of NEB and Thermo enzymes.
- **Ligation**: Calculate optimal vector-to-insert molar ratios for standard ligations.
- **Gibson**: Multi-fragment assembly planning with molarity and volume calculations.
- **Protein**:
  - **Protein Concentration**: Accurately determine protein concentration using A280 readings, MW, and extinction coefficients.
  - **Sample preparation**: automatically creates the sample preparation mix table for the measured protein samples in the Protein Concentration tool.
- **PCR Calculator**:
  - **PCR Mix**: Calculate mastermixes for multiple samples with different template concentrations.
  - **Ta Calculator**: Advanced annealing temperature prediction using the nearest-neighbor model. Provides Tm, MW, and GC content analysis.
  - **OE-PCR**: Plan Overlap Extension PCRs for site-directed mutagenesis or fragment joining.
  - **Product Sequence**: Automatically generate the final DNA sequence based on your primers and template.
- **Dilution**: Simple or serial dilution calculations with molarity or percentage support.

**Lab & Visualization**

- **Gel Simulator**: Simulate agarose gels. Manually enter band sizes or paste your DNA sequence and select enzymes to visualize the fragments on gel automatically. Mark bands for extraction directly on the gel.
- **Western Blot**: Predict protein migration patterns. Select specific PAGE gel types and use specialized protein ladders.
- **Plasmid Analyzer**:
  - **Map Visualization**: View circular or linear plasmid maps add features and primers and find  restriction sites.
  - **Alignment**: Align two sequences to identify mismatches

**Protocols & AI**

- **General AI Assistant**: Available via the top-bar icon to answer lab-related questions or explain tool functionalities.
- - **Protocol Library**: A searchable database of standard molecular biology protocols that can be customized and exported.
- **AI Buffer Assistant**: A conversational AI optimized for lab chemistry. Describe the buffer you need (e.g., "1X TAE with 10mM EDTA"), and it will generate a recipe you can save to your history.

## Known Issues

- The mobile webapp doesn't work very  everything works 

## Support

If you like this app, feel free to buy me a coffee :)

<a href="https://buymeacoffee.com/daphnewoodpecker" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" height="30">
</a>