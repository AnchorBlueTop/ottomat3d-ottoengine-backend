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
  flashforge: [
    { label: 'AD5X', value: 'AD5X' },
    { label: 'Adventure 5M Pro', value: 'Adventure 5M Pro' },
  ],
  creality: [
    { label: 'K1C', value: 'K1C' },
  ],
  anycubic: [
    { label: 'Kobra S1', value: 'Kobra S1' },
  ],
  elegoo: [
    { label: 'Centuari Carbon', value: 'Centuari Carbon' },
  ],
  prusa: [
    { label: 'MK3', value: 'MK3' },
    { label: 'MK3S+', value: 'MK3S+' },
    { label: 'MK4', value: 'MK4' },
    { label: 'Core One', value: 'Core One' },
  ],
};
