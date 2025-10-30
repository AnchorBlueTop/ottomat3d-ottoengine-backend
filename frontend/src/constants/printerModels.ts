export type PrinterModelOption = { label: string; value: string };

// Map brand value -> array of model options
export const PRINTER_MODELS: Record<string, PrinterModelOption[]> = {
  bambu_lab: [
    { label: 'A1', value: 'A1' },
    { label: 'A1 Mini', value: 'A1 Mini' },
    { label: 'P1P', value: 'P1P' },
    { label: 'P1S', value: 'P1S' },
    { label: 'X1C', value: 'X1C' },
  ],
  // prusa: [
  //   { label: 'MK3S+', value: 'MK3S+' },
  //   { label: 'MK4', value: 'MK4' },
  //   { label: 'MINI+', value: 'MINI+' },
  // ],
  // anycubic: [
  //   { label: 'Kobra', value: 'Kobra' },
  //   { label: 'Kobra 2', value: 'Kobra 2' },
  //   { label: 'Vyper', value: 'Vyper' },
  // ],
  // creality: [
  //   { label: 'Ender 3', value: 'Ender 3' },
  //   { label: 'Ender 3 V2', value: 'Ender 3 V2' },
  //   { label: 'K1', value: 'K1' },
  //   { label: 'K1 Max', value: 'K1 Max' },
  // ],
  // flashforge: [
  //   { label: 'Adventurer 3', value: 'Adventurer 3' },
  //   { label: 'Adventurer 4', value: 'Adventurer 4' },
  // ],
  // elegoo: [
  //   { label: 'Neptune 3', value: 'Neptune 3' },
  //   { label: 'Neptune 4', value: 'Neptune 4' },
  // ],
  klipper: [
    { label: 'Generic Klipper', value: 'Generic Klipper' },
  ]
};
