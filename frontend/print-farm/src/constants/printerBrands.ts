export type PrinterBrandOption = {
  label: string;
  value: string;
};

export const PRINTER_BRANDS: PrinterBrandOption[] = [
  { label: 'Bambu Lab', value: 'bambu_lab' },
  { label: 'Prusa', value: 'prusa' },
  { label: 'Anycubic', value: 'anycubic' },
  { label: 'Creality', value: 'creality' },
  { label: 'Flashforge', value: 'flashforge' },
  { label: 'Elegoo', value: 'elegoo' },
  { label: 'Klipper (Moonraker)', value: 'klipper' }
];
