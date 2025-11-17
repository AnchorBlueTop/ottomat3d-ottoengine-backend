import {
  Alert,
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
  TextInputGroupMain,
} from "@patternfly/react-core";
import { useContext, useEffect, useMemo, useState } from "react";
import { JobContext } from "../../App";
import printerIcon from "../../public/printer-Icon.svg";
import thumbnail from "../../public/thumbnail.png";
import { PrinterRegistrationRepresentation, PrinterRepresentation } from "../../representations/printerRepresentation";
import { PRINTER_BRANDS } from "../../constants/printerBrands";
import { PRINTER_MODELS } from "../../constants/printerModels";
import {
  calibratePrinter,
  deletePrinter,
  getPrinterById,
  registerPrinter,
  testPrinterConnection,
  updatePrinterDetails,
} from "../../ottoengine_API";

export default function PrinterModal() {
  const {
    printer,
    setPrinter,
    printerAddModalOpen,
    setIsPrinterAddModalOpen,
    printerEditModalOpen,
    setIsPrinterEditModalOpen,
    printerIndex,
  } = useContext(JobContext);

  const isEdit = Boolean(printerEditModalOpen);
  const isOpen = Boolean(printerAddModalOpen || printerEditModalOpen);
  const selectedPrinter = useMemo<PrinterRepresentation | undefined>(
    () => (isEdit && printerIndex != null ? printer[printerIndex] : undefined),
    [isEdit, printerIndex, printer]
  );

  const [tempPrinter, setTempPrinter] = useState<Partial<PrinterRepresentation & PrinterRegistrationRepresentation>>({});
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState<string | undefined>();
  const [testSuccess, setTestSuccess] = useState<boolean | undefined>();
  const [submitError, setSubmitError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Initialize state when opened
  useEffect(() => {
    if (!isOpen) return;
    setSubmitError(undefined);
    setTestMessage(undefined);
    setTestSuccess(undefined);
    setSubmitting(false);
    setTesting(false);

    if (isEdit && selectedPrinter) {
      setTempPrinter({ ...selectedPrinter });
    } else {
      setTempPrinter({});
    }
  }, [isOpen, isEdit, selectedPrinter]);

  const onClose = () => {
    if (isEdit) setIsPrinterEditModalOpen(false);
    else setIsPrinterAddModalOpen(false);
    // Reset
    setTempPrinter({});
    setTestMessage(undefined);
    setTestSuccess(undefined);
    setSubmitError(undefined);
    setSubmitting(false);
    setTesting(false);
  };

  const handleTestConnection = async () => {
    if (!tempPrinter?.brand || !tempPrinter?.ip_address) return;
    setTesting(true);
    setTestMessage(undefined);
    setTestSuccess(undefined);
    try {
      const res = await testPrinterConnection({
        brand: tempPrinter.brand,
        ip_address: tempPrinter.ip_address,
        access_code: tempPrinter.access_code,
        serial_number: tempPrinter.serial_number,
      } as any);
      setTestSuccess(true);
      setTestMessage(res?.message || "Connection successful.");
    } catch (e: any) {
      setTestSuccess(false);
      setTestMessage(e?.message || "Connection failed.");
    } finally {
      setTesting(false);
    }
  };

  const handleLevelBed = async () => {
    if (!selectedPrinter?.id) return;
    try {
      await calibratePrinter(selectedPrinter.id);
      alert('Calibration started successfully!');
    } catch (error: any) {
      alert(`Calibration failed: ${error.message}`);
    }
  };

  const handleSave = async () => {
    try {
      setSubmitting(true);
      setSubmitError(undefined);
      if (isEdit && selectedPrinter?.id != null && printerIndex != null) {
        const payload: PrinterRepresentation = { ...(selectedPrinter as any), ...(tempPrinter as any) };
        // Clear UI-only props if any
        (payload as any).status = undefined;
        await updatePrinterDetails(selectedPrinter.id, payload);
        setPrinter(prev => {
          const copy = prev.slice();
          copy[printerIndex] = { ...copy[printerIndex], ...payload };
          return copy;
        });
        setIsPrinterEditModalOpen(false);
      } else {
        // Create
        const input = tempPrinter as PrinterRegistrationRepresentation;
        if (!input?.brand || !input?.model || !input?.name) {
          setSubmitError("Please complete the form before adding a printer.");
          setSubmitting(false);
          return;
        }
        const created: any = await registerPrinter(input);
        const merged = created ? { ...input, ...created } : input;
        setPrinter((prev: any[] | undefined) => {
          const list = prev ?? [];
          return [...list, merged as any];
        });
        if (created?.id) {
          try {
            const fresh = await getPrinterById(created.id);
            setPrinter((prev: any[] | undefined) => {
              const list = prev ?? [];
              return list.map((p: any) => (p?.id === created.id ? { ...p, ...fresh } : p));
            });
          } catch {}
        }
        setIsPrinterAddModalOpen(false);
      }
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || "Failed to save printer.";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!isEdit || selectedPrinter?.id == null || printerIndex == null) return;
    setSubmitting(true);
    setSubmitError(undefined);
    try {
      await deletePrinter(selectedPrinter.id);
      setPrinter(prev => prev.filter((_, i) => i !== printerIndex));
      setIsPrinterEditModalOpen(false);
    } catch (e: any) {
      setSubmitError(e?.message || "Failed to delete printer.");
    } finally {
      setSubmitting(false);
    }
  };

  const title = isEdit ? "EDIT PRINTER" : "ADD NEW PRINTER";

  return (
    <Modal isOpen={isOpen} className="pf-custom-new-printer-modal" aria-label="printerModal" onClose={onClose}>
      <PageSection className="pf-custom-new-printer">
        <ModalHeader className="pf-custom-upload-header">
          <Content component={ContentVariants.h3}>
            <Brand src={printerIcon} alt="Printer logo" className='pf-custom-modal-icon' />
            {` ${title}`}
          </Content>
        </ModalHeader>
        <div style={{ height: '3rem' }} />
        <Grid hasGutter>
          <GridItem span={8}>
            <Form isHorizontal className="pf-custom-text-align-left">
              <Grid>
                <GridItem span={3}><Content>{'PRINTER BRAND:'}</Content></GridItem>
                <GridItem span={8}>
                  <FormSelect
                    id="printer-brand"
                    value={tempPrinter?.brand ?? ''}
                    onChange={(_e, value: string) => setTempPrinter(prev => ({ ...(prev || {}), brand: value, model: '' as any }))}
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
                <GridItem span={3}><Content>{'PRINTER MODEL:'}</Content></GridItem>
                <GridItem span={8}>
                  <FormSelect
                    id="printer-model"
                    isDisabled={!tempPrinter?.brand}
                    value={tempPrinter?.model ?? ''}
                    onChange={(_e, value: string) => setTempPrinter(prev => ({ ...(prev || {}), model: value }))}
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
                <GridItem span={3}><Content>{'NAME:'}</Content></GridItem>
                <GridItem span={8}>
                  <TextInput id='printer-name' placeholder="" value={tempPrinter?.name ?? ''}
                    onChange={(_e, value: string) => setTempPrinter(prev => ({ ...(prev || {}), name: value }))}
                  />
                </GridItem>
              </Grid>

              <div className="pf-c-form-group">
                <span className="pf-custom-border-label">{'CONNECTION: '}</span>
                <Grid hasGutter>
                  <Grid>
                    <GridItem span={3}><Content>{'IP ADDRESS:'}</Content></GridItem>
                    <GridItem span={8}>
                      <TextInputGroup>
                        <TextInputGroupMain id='printer-connection-ipaddress' value={tempPrinter?.ip_address ?? ''}
                          onChange={(_e, value: any) => setTempPrinter(prev => ({ ...(prev || {}), ip_address: value }))}
                        />
                      </TextInputGroup>
                    </GridItem>
                  </Grid>

                  {/* Bambu Lab: Serial + Access Code */}
                  {tempPrinter?.brand === 'bambu_lab' && (
                    <>
                      <Grid>
                        <GridItem span={3}><Content>{'SERIAL NUMBER:'}</Content></GridItem>
                        <GridItem span={8}>
                          <TextInputGroup>
                            <TextInputGroupMain id='printer-connection-serial' value={tempPrinter?.serial_number ?? ''}
                              onChange={(_e, value: any) => setTempPrinter(prev => ({ ...(prev || {}), serial_number: value }))}
                            />
                          </TextInputGroup>
                        </GridItem>
                      </Grid>
                      <Grid>
                        <GridItem span={3}><Content>{'ACCESS CODE:'}</Content></GridItem>
                        <GridItem span={8}>
                          <TextInputGroup>
                            <TextInputGroupMain id='printer-connection-accesscode' value={tempPrinter?.access_code ?? ''}
                              onChange={(_e, value: any) => setTempPrinter(prev => ({ ...(prev || {}), access_code: value }))}
                            />
                          </TextInputGroup>
                        </GridItem>
                      </Grid>
                    </>
                  )}

                  {/* FlashForge: Serial Code + Check Code */}
                  {tempPrinter?.brand === 'flashforge' && (
                    <>
                      <Grid>
                        <GridItem span={3}><Content>{'SERIAL CODE:'}</Content></GridItem>
                        <GridItem span={8}>
                          <TextInputGroup>
                            <TextInputGroupMain id='printer-connection-serial-code' value={(tempPrinter as any)?.serial_code ?? ''}
                              onChange={(_e, value: any) => setTempPrinter(prev => ({ ...(prev || {}), serial_code: value }))}
                            />
                          </TextInputGroup>
                        </GridItem>
                      </Grid>
                      <Grid>
                        <GridItem span={3}><Content>{'CHECK CODE:'}</Content></GridItem>
                        <GridItem span={8}>
                          <TextInputGroup>
                            <TextInputGroupMain id='printer-connection-check-code' value={(tempPrinter as any)?.check_code ?? ''}
                              onChange={(_e, value: any) => setTempPrinter(prev => ({ ...(prev || {}), check_code: value }))}
                            />
                          </TextInputGroup>
                        </GridItem>
                      </Grid>
                    </>
                  )}

                  {/* Prusa: API Key */}
                  {tempPrinter?.brand === 'prusa' && (
                    <Grid>
                      <GridItem span={3}><Content>{'API KEY:'}</Content></GridItem>
                      <GridItem span={8}>
                        <TextInputGroup>
                          <TextInputGroupMain id='printer-connection-api-key' value={(tempPrinter as any)?.api_key ?? ''}
                            onChange={(_e, value: any) => setTempPrinter(prev => ({ ...(prev || {}), api_key: value }))}
                          />
                        </TextInputGroup>
                      </GridItem>
                    </Grid>
                  )}

                  {/* Creality, Anycubic, Elegoo: IP only (no additional auth fields) */}
                  <Grid>
                    <GridItem span={3}><Content>{''}</Content></GridItem>
                    <GridItem span={8}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Button
                          variant="secondary"
                          isDisabled={testing || !tempPrinter?.brand || !tempPrinter?.ip_address}
                          onClick={handleTestConnection}
                          style={{ minWidth: '140px', flexShrink: 0 }}
                        >
                          {testing ? 'Testing…' : 'Test Connection'}
                        </Button>
                        {testMessage && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: testSuccess ? 'var(--pf-global--success-color--100, var(--pf-v5-global--success-color--100, #3E8635))' : 'var(--pf-global--danger-color--100, var(--pf-v5-global--danger-color--100, #C9190B))' }}>
                            {testSuccess ? (
                              <svg width="18" height="18" viewBox="0 0 24 24" role="img" aria-label="Connection successful"><circle cx="12" cy="12" r="10" fill="currentColor" /><path d="M9.5 12.5l2 2 4-5" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            ) : (
                              <svg width="18" height="18" viewBox="0 0 24 24" role="img" aria-label="Connection failed"><circle cx="12" cy="12" r="10" fill="currentColor" /><path d="M8.5 8.5l7 7m0-7l-7 7" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
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

        {submitError && (
          <div style={{ marginTop: '1rem' }}>
            <Alert isInline variant="danger" title={submitError} />
          </div>
        )}

        <ModalFooter className="pf-custom-new-print-job-modal-footer">
          {isEdit && (
            <Button variant="secondary" onClick={handleLevelBed} isDisabled={submitting}>{'Level Bed'}</Button>
          )}
          <Button variant="danger" onClick={onClose}>{'Cancel'}</Button>
          <Button className="pf-custom-button" isDisabled={submitting} onClick={handleSave}>
            {submitting ? (isEdit ? 'Saving…' : 'Adding…') : (isEdit ? 'Save' : 'ADD')}
          </Button>
          {isEdit && (
            <Button className="pf-custom-button" variant="danger" onClick={handleDelete} isDisabled={submitting}>{'Delete'}</Button>
          )}
        </ModalFooter>
      </PageSection>
    </Modal>
  );
}
