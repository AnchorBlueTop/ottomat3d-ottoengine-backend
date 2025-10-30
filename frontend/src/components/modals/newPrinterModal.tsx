import {
    Brand,
    Button,
    Content,
    ContentVariants,
    Form,
    FormGroup,
    FormSelect,
    FormSelectOption,
    Grid,
    GridItem,
    Modal,
    ModalFooter,
    ModalHeader,
    PageSection,
    TextInput,
    TextInputGroup,
    TextInputGroupMain
} from "@patternfly/react-core";
import { useContext, useState } from "react";
import { JobContext } from "../../App.tsx";
import printerIcon from '../../public/printer-Icon.svg';
import thumbnail from '../../public/thumbnail.png';
import { PrinterRegistrationRepresentation } from "../../representations/printerRepresentation.ts";
import { registerPrinter, testPrinterConnection } from "../../ottoengine_API.ts";
import { PRINTER_BRANDS } from "../../constants/printerBrands";
import { PRINTER_MODELS } from "../../constants/printerModels";

export default function newPrinter() {
    const { printer, setPrinter, printerAddModalOpen, setIsPrinterAddModalOpen } = useContext(JobContext);
    const [tempPrinter, setTempPrinter] = useState<PrinterRegistrationRepresentation>();
    const [testing, setTesting] = useState(false);
    const [testMessage, setTestMessage] = useState<string | undefined>();
    const [testSuccess, setTestSuccess] = useState<boolean | undefined>();

    const updatePrinterList = (tempPrinter: any) => {
        // if (!printer && tempPrinter) {
        //     console.log(tempPrinter);
        //     const registeredResponse = registerPrinter(tempPrinter).then(() => { console.log('in printer registration') });
        //     setPrinter([tempPrinter]);
        //     setTempPrinter({});
        // } else {
        //     if (!printer[0]) {
        //         delete printer[0];
        //         printer.push(tempPrinter);

        //         setPrinter(printer);
        //         setTempPrinter({});
        //     } else {
        //         const registeredResponse = registerPrinter(tempPrinter).then(() => { console.log('in printer registration') });
        //         printer.push(tempPrinter);
        //         setPrinter(printer);
        //         setIsPrinterAddModalOpen(false);
        //         setTempPrinter({});
        //     }
        // }

        if (!tempPrinter) {
            console.error("No printer data provided.");
            return;
        }
        if (!printer && tempPrinter) {
            registerPrinter(tempPrinter).then(() => { console.log('in printer registration') });
            setPrinter([tempPrinter]);
            setTempPrinter({});
        } else {
            if (!printer[0]) {
                delete printer[0];
                printer.push(tempPrinter);

                setPrinter(printer);
                setTempPrinter({});
            } else {
                registerPrinter(tempPrinter).then(() => { console.log('in printer registration') });
                printer.push(tempPrinter);
                setPrinter(printer);
                setIsPrinterAddModalOpen(false);
                setTempPrinter({});
            }
        }
        // Register the printer using the API
        registerPrinter(tempPrinter).then(() => {
            console.log("Printer registered successfully:", tempPrinter);

            // Update the printer list
            if (!printer || printer.length === 0) {
                // If no printers exist, initialize the printer list
                setPrinter([tempPrinter]);
            } else {
                // Add the new printer to the existing list
                setPrinter([...printer, tempPrinter]);
            }

            // Reset the temporary printer and close the modal
            setTempPrinter({});
            setIsPrinterAddModalOpen(false);
        })
        .catch((error) => {
            console.error("Error registering printer:", error);
        });
        setIsPrinterAddModalOpen(false);
    };

    return (
        <>
            <Modal
                isOpen={printerAddModalOpen}
                className="pf-custom-new-printer-modal"
                aria-label="newPrinter"
                onClose={() => setIsPrinterAddModalOpen(false)}
            >
                <PageSection className="pf-custom-new-printer">
                    <ModalHeader className="pf-custom-upload-header">
                        <Content component={ContentVariants.h3}>
                            <Brand src={printerIcon} alt="Printer logo" className='pf-custom-modal-icon' />
                            {' ADD NEW PRINTER'}</Content>
                    </ModalHeader>
                    <Grid hasGutter>

                        <GridItem span={8}>
                            <Form isHorizontal className="pf-custom-text-align-left">

                                <Grid>
                                    <GridItem span={3}>
                                        <Content>{'PRINTER BRAND:'}</Content>
                                    </GridItem>
                                    <GridItem span={8}>
                                        <FormSelect
                                            id="printer-brand"
                                            value={tempPrinter?.brand ?? ''}
                                            onChange={(_event, value: string) => {
                                                // when brand changes, clear model to force re-select
                                                setTempPrinter({ ...tempPrinter, brand: value, model: '' as any });
                                            }}
                                            aria-label="Select printer brand"
                                        >
                                            <FormSelectOption key="placeholder" label="Select a brand" value="" />
                                            {PRINTER_BRANDS.map(b => (
                                                <FormSelectOption key={b.value} label={b.label} value={b.value} />
                                            ))}
                                        </FormSelect>
                                    </GridItem>
                                </Grid>

                                <Grid>
                                    <GridItem span={3}>
                                        <Content>{'PRINTER MODEL:'}</Content>
                                    </GridItem>
                                    <GridItem span={8}>
                                        <FormSelect
                                            id="printer-model"
                                            isDisabled={!tempPrinter?.brand}
                                            value={tempPrinter?.model ?? ''}
                                            onChange={(_event, value: string) => setTempPrinter({ ...tempPrinter, model: value })}
                                            aria-label="Select printer model"
                                        >
                                            <FormSelectOption key="placeholder" label={tempPrinter?.brand ? 'Select a model' : 'Select a brand first'} value="" />
                                            {(PRINTER_MODELS[tempPrinter?.brand || ''] || []).map(m => (
                                                <FormSelectOption key={m.value} label={m.label} value={m.value} />
                                            ))}
                                        </FormSelect>
                                    </GridItem>
                                </Grid>

                                <Grid>
                                    <GridItem span={3}>
                                        <Content>{'NAME:'}</Content>
                                    </GridItem>
                                    <GridItem span={8}>
                                        <TextInput
                                            id='printer-name'
                                            placeholder=""
                                            value={tempPrinter?.name}
                                            onChange={(_event, value: string) => setTempPrinter({ ...tempPrinter, name: value })}
                                        />
                                    </GridItem>
                                </Grid>

                                <div className="pf-c-form-group">
                                    <span className="pf-custom-border-label">{'CONNECTION: '}</span>
                                    <Grid hasGutter>
                                        <Grid>
                                            <GridItem span={3}>
                                                <Content>{'IP ADDRESS:'}</Content>
                                            </GridItem>
                                            <GridItem span={8}>
                                                <TextInputGroup>
                                                    <TextInputGroupMain id='printer-connection-ipaddress' value={tempPrinter?.ip_address} onChange={(_event, value: any) => setTempPrinter({ ...tempPrinter, ip_address: value })} />
                                                </TextInputGroup>
                                            </GridItem>
                                        </Grid>
                                        <Grid>
                                            <GridItem span={3}>
                                                <Content>{'SERIAL:'}</Content>
                                            </GridItem>
                                            <GridItem span={8}>
                                                <TextInputGroup>
                                                    <TextInputGroupMain id='printer-connection-serial' value={tempPrinter?.serial_number} onChange={(_event, value: any) => setTempPrinter({ ...tempPrinter, serial_number: value })} />
                                                </TextInputGroup>
                                            </GridItem>
                                        </Grid>
                                        <Grid>
                                            <GridItem span={3}>
                                                <Content>{'ACCESS CODE:'}</Content>
                                            </GridItem>
                                            <GridItem span={8}>
                                                <TextInputGroup>
                                                    <TextInputGroupMain id='printer-connection-accesscode' value={tempPrinter?.access_code} onChange={(_event, value: any) => setTempPrinter({ ...tempPrinter, access_code: value })} />
                                                </TextInputGroup>
                                            </GridItem>
                                        </Grid>
                                        <Grid>
                                            <GridItem span={3}>
                                                <Content>{''}</Content>
                                            </GridItem>
                                            <GridItem span={8}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                    <Button
                                                        variant="secondary"
                                                        isDisabled={testing || !tempPrinter?.brand || !tempPrinter?.ip_address}
                                                        onClick={async () => {
                                                            if (!tempPrinter) return;
                                                            setTesting(true);
                                                            setTestMessage(undefined);
                                                            setTestSuccess(undefined);
                                                            try {
                                                                const res = await testPrinterConnection({
                                                                    brand: tempPrinter.brand,
                                                                    ip_address: tempPrinter.ip_address,
                                                                    access_code: tempPrinter.access_code,
                                                                    serial_number: tempPrinter.serial_number,
                                                                });
                                                                setTestSuccess(true);
                                                                setTestMessage(res?.message || 'Connection successful.');
                                                            } catch (e: any) {
                                                                setTestSuccess(false);
                                                                setTestMessage(e?.message || 'Connection failed.');
                                                            } finally {
                                                                setTesting(false);
                                                            }
                                                        }}
                                                    >
                                                        {testing ? 'Testing…' : 'Test Connection'}
                                                    </Button>
                                                    {testMessage && (
                                                        <span
                                                            style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: 8,
                                                                // Try PF v6/v5 tokens with hex fallbacks
                                                                color: testSuccess
                                                                    ? 'var(--pf-global--success-color--100, var(--pf-v5-global--success-color--100, #3E8635))'
                                                                    : 'var(--pf-global--danger-color--100, var(--pf-v5-global--danger-color--100, #C9190B))'
                                                            }}
                                                        >
                                                            {testSuccess ? (
                                                                // Green circle with white tick
                                                                <svg
                                                                    width="18"
                                                                    height="18"
                                                                    viewBox="0 0 24 24"
                                                                    role="img"
                                                                    aria-label="Connection successful"
                                                                >
                                                                    <circle cx="12" cy="12" r="10" fill="currentColor" />
                                                                    <path
                                                                        d="M9.5 12.5l2 2 4-5"
                                                                        fill="none"
                                                                        stroke="#ffffff"
                                                                        strokeWidth="2.2"
                                                                        strokeLinecap="round"
                                                                        strokeLinejoin="round"
                                                                    />
                                                                </svg>
                                                            ) : (
                                                                // Red circle with white cross
                                                                <svg
                                                                    width="18"
                                                                    height="18"
                                                                    viewBox="0 0 24 24"
                                                                    role="img"
                                                                    aria-label="Connection failed"
                                                                >
                                                                    <circle cx="12" cy="12" r="10" fill="currentColor" />
                                                                    <path
                                                                        d="M8.5 8.5l7 7m0-7l-7 7"
                                                                        fill="none"
                                                                        stroke="#ffffff"
                                                                        strokeWidth="2.2"
                                                                        strokeLinecap="round"
                                                                        strokeLinejoin="round"
                                                                    />
                                                                </svg>
                                                            )}
                                                            <span>{testMessage}</span>
                                                        </span>
                                                    )}
                                                </div>
                                            </GridItem>
                                        </Grid>
                                    </Grid>
                                </div>
                            </Form>
                        </GridItem>

                        <GridItem span={4}>
                            <FormGroup>
                                <Brand src={thumbnail} alt={"printer thumbnail"} className="pf-custom-thumbnail" />
                            </FormGroup>
                        </GridItem>

                    </Grid>

                    <ModalFooter className="pf-custom-new-print-job-modal-footer">
                        <Button
                            variant="danger"
                            onClick={() => { setIsPrinterAddModalOpen(false) }}
                        >
                            {'Cancel'}
                        </Button>
                        <Button
                            className="pf-custom-button"
                            onClick={() => {
                                if (tempPrinter) {
                                    updatePrinterList(tempPrinter);
                                } else {
                                    console.error("No printer data to add.");
                                }
                            }}
                        >
                            {'ADD'}
                        </Button>
                    </ModalFooter>
                </PageSection>
            </Modal>
        </>
    )
}