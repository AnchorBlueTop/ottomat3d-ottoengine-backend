import { Brand, Button, Content, ContentVariants, Form, FormGroup, Grid, GridItem, Modal, ModalFooter, ModalHeader, PageSection, Spinner } from "@patternfly/react-core";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { JobContext } from "../../App";
import PrintJobIcon from '../../public/PrintJob-Icon.svg';
import thumbnail from '../../public/thumbnail.png';
import hourglass from '../../public/hourglass.png';
import JSZip from 'jszip';
import { PrinterRepresentation } from "../../representations/printerRepresentation";
import PrintJobRepresentation from "../../representations/printJobRepresentation";
import { createPrintJob, deletePrintJob, getAllOttoejectDevices, getAllOttoracks, getAllPrinters, getAllPrintJobs, getPrintJobById, getOttorackById } from "../../ottoengine_API";
import { updatePrintJob } from "../../ottoengine_API";

export default function PrintJobModal() {
  const {
    // Modal flags
    printTaskModalOpen,
    setIsPrintTaskModalOpen,
    isEditPrintJobModalOpen,
    setIsEditPrintJobModalOpen,
    // Shared state
    currentFiles,
    setCurrentFiles,
    printFile,
    setPrintFile,
    printJobUID,
    setPrintJob,
    ottoeject,
    setOttoeject,
  } = useContext(JobContext);

  const isEdit = Boolean(isEditPrintJobModalOpen);
  const isOpen = Boolean(printTaskModalOpen || isEditPrintJobModalOpen);

  // Shared lists
  const [printers, setPrinters] = useState<PrinterRepresentation[]>([]);
  const [ottoracks, setOttoracks] = useState<any[]>([]);
  const [selectedOttorackDetails, setSelectedOttorackDetails] = useState<any>(null);

  // New job state
  const [selectedPrinter, setSelectedPrinter] = useState<number | null>(null);
  const [selectedOttoeject, setSelectedOttoeject] = useState<number | null>(null);
  const [selectedOttorack, setSelectedOttorack] = useState<number | null>(null);
  const [selectedStoreLocation, setSelectedStoreLocation] = useState<number>(1);
  const [selectedGrabLocation, setSelectedGrabLocation] = useState<number>(2);
  const [nextItemId, setNextItemId] = useState<number>(1);

  // Edit job state
  const [loading, setLoading] = useState(false);
  const [job, setJob] = useState<PrintJobRepresentation | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Define helpers before usage to avoid temporal dead zone issues
  const safeParse = (text?: string) => {
    try { return text ? JSON.parse(text) : undefined; } catch { return undefined; }
  };

  const details = useMemo(() => {
    const parsed = job?.file_details_json ? safeParse(job.file_details_json) : {};
    return parsed || {};
  }, [job]);

  const modalDataFetchedRef = useRef(false);

  // Initialize on open
  useEffect(() => {
    if (!isOpen) {
      modalDataFetchedRef.current = false;
      return;
    }
    if (modalDataFetchedRef.current) return;
    modalDataFetchedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        // Load printers
        if (printers.length === 0) {
          const printerList = await getAllPrinters();
          if (!cancelled) setPrinters(printerList);
        }
        // Load ottoeject devices for new-job mode
        if (!isEdit && ottoeject.length === 0) {
          const devices = await getAllOttoejectDevices();
          if (!cancelled) setOttoeject(devices);
        }
        // Load ottoracks
        if (ottoracks.length === 0) {
          const rackList = await getAllOttoracks();
          if (!cancelled) setOttoracks(rackList);
        }
        // If editing, load job details
        if (isEdit && printJobUID) {
          if (!cancelled) setLoading(true);
          try {
            const jobResp = await getPrintJobById(String(printJobUID));
            if (!cancelled) {
              setJob(jobResp);
              setSelectedPrinter(jobResp?.printer_id ?? null);
              setSelectedOttoeject(jobResp?.ottoeject_id ?? null);
              setSelectedOttorack(jobResp?.assigned_rack_id ?? null);
              setSelectedStoreLocation(jobResp?.assigned_store_slot ?? 1);
              setSelectedGrabLocation(jobResp?.assigned_grab_slot ?? 2);
            }
          } finally {
            if (!cancelled) setLoading(false);
          }
        }
        // If creating and have files, parse to set printFile
        if (!isEdit && currentFiles?.length) {
          readUploadedFile(currentFiles);
        }
        // Optionally seed nextItemId from existing jobs
        try {
          const jobs = await getAllPrintJobs();
          const highest = jobs?.length ? Math.max(...jobs.map(j => (j as any)?.print_item_id || 0)) : 0;
          if (!cancelled) setNextItemId(highest + 1);
        } catch {}
      } catch (e) {
        console.error('Failed to load print job modal data', e);
      }
    })();

    return () => { cancelled = true; };
  }, [isOpen, isEdit, printJobUID]);

  // Fetch ottorack details when selectedOttorack changes
  useEffect(() => {
    if (selectedOttorack) {
      (async () => {
        try {
          const rackDetails = await getOttorackById(selectedOttorack);
          setSelectedOttorackDetails(rackDetails);
        } catch (e) {
          console.error('Failed to fetch ottorack details', e);
          setSelectedOttorackDetails(null);
        }
      })();
    } else {
      setSelectedOttorackDetails(null);
    }
  }, [selectedOttorack]);

  // Generate slot options based on selected ottorack
  const generateSlotOptions = () => {
    if (!selectedOttorackDetails?.shelf_count) return [];
    const slotCount = selectedOttorackDetails.shelf_count;
    return Array.from({ length: slotCount }, (_, i) => i + 1);
  };

  const onClose = () => {
    if (isEdit) setIsEditPrintJobModalOpen(false);
    else setIsPrintTaskModalOpen(false);
    // Reset transient state
    setCurrentFiles([]);
    setPrintFile(undefined);
    setSelectedPrinter(null);
    setSelectedOttoeject(null);
    setSelectedOttorack(null);
    setSelectedOttorackDetails(null);
    setSelectedStoreLocation(1);
    setSelectedGrabLocation(2);
    setJob(null);
    setLoading(false);
    setDeleting(false);
    modalDataFetchedRef.current = false;
  };

  const refreshJobs = async () => {
    try {
      const all = await getAllPrintJobs();
      setPrintJob(all);
    } catch (e) {
      console.error('Failed to refresh print jobs', e);
    }
  };

  const readUploadedFile = (file: any[]): Promise<string | any> => {
    const fileRead = new Promise(async () => {
      const reader = new FileReader();
      if (file?.[0] && !file?.[0].name?.includes('3mf')) {
        reader.onload = (event) => {
          const result = event.target?.result as string;
          const processedResult = result.split('\n').map((item: any) => String(item)).join('\n');
          setCurrentFiles([processedResult]);

          // Extract helpers
          const match = (regex: RegExp) => processedResult.match(regex);
          const matchPrinter = () => match(/printer_model = (.*)/)?.[1]?.trim() || 'Unknown Printer';
          const matchDuration = () => match(/total estimated time: (.*)/)?.[1]?.trim() || 'Unknown Duration';
          const matchFilamentType = () => match(/filament_type = (.*)/)?.[1]?.trim() || 'Unknown Filament Type';
          const matchFilamentWeight = () => (match(/total filament weight \[g\] : (.*)/)?.[1]?.trim() || 'Unknown Filament Weight') + ' (grams)';
          const matchFilamentLength = () => (match(/total filament length \[mm\] : (.*)/)?.[1]?.trim() || 'Unknown Filament Length') + ' (mm)';
          const matchAMS = () => Boolean(match(/M620(.*)|M621(.*)/)?.[1]);

          const fileDetails = {
            id: String(printJobUID ?? ''),
            name: file?.[0]?.name,
            printer: matchPrinter(),
            duration: matchDuration(),
            filament: matchFilamentType(),
            filament_weight: matchFilamentWeight(),
            filament_length: matchFilamentLength(),
            status: 'NEW',
            ams: matchAMS(),
          };
          setPrintFile(fileDetails);
          return result;
        };
        if (file && file[0] instanceof Blob) reader.readAsText(file[0]);
      } else if (file?.[0] && file?.[0].name?.includes('3mf')) {
        try {
          const zip = new JSZip();
          const fileData = await file[0]?.arrayBuffer();
          const zipContent = await zip.loadAsync(fileData);
          const mainFile = Object.keys(zipContent.files).find((fileName) => fileName.toLowerCase().endsWith('.gcode'));
          const fileContent = mainFile ? await zipContent.files[mainFile].async('text') : '';
          const processedResult = fileContent.split('\n').map((item: any) => String(item)).join('\n');
          setCurrentFiles([processedResult]);

          const match = (regex: RegExp) => processedResult.match(regex);
          const matchPrinter = () => match(/printer_model = (.*)/)?.[1]?.trim() || 'Unknown Printer';
          const matchDuration = () => match(/total estimated time: (.*)/)?.[1]?.trim() || 'Unknown Duration';
          const matchFilamentType = () => match(/filament_type = (.*)/)?.[1]?.trim() || 'Unknown Filament Type';
          const matchFilamentWeight = () => (match(/total filament weight \[g\] : (.*)/)?.[1]?.trim() || 'Unknown Filament Weight') + ' (grams)';
          const matchFilamentLength = () => (match(/total filament length \[mm\] : (.*)/)?.[1]?.trim() || 'Unknown Filament Length') + ' (mm)';
          const matchAMS = () => Boolean(match(/M620(.*)|M621(.*)/)?.[1]);

          const fileDetails = {
            id: String(printJobUID ?? ''),
            name: file?.[0]?.name,
            printer: matchPrinter(),
            duration: matchDuration(),
            filament: matchFilamentType(),
            filament_weight: matchFilamentWeight(),
            filament_length: matchFilamentLength(),
            status: 'NEW',
            ams: matchAMS(),
          };
          setPrintFile(fileDetails);
          return processedResult;
        } catch (error) {
          console.error('Error processing .3mf file:', error);
        }
      }
    });
    return fileRead;
  };

  const handleCreate = async () => {
    if (!selectedPrinter || !selectedOttoeject || !selectedOttorack) return;
    const printJobData = {
      // Prefer the server-provided print_item_id from the upload flow; fall back to computed next id
      print_item_id: printJobUID ?? nextItemId,
      printer_id: selectedPrinter,
      ottoeject_id: selectedOttoeject,
      rack_id: selectedOttorack,
      store_location: selectedStoreLocation,
      grab_location: selectedGrabLocation,
      auto_start: false,
    };
    try {
      await createPrintJob(printJobData);
      // Only increment the local counter when we actually used it
      if (printJobUID == null) setNextItemId(nextItemId + 1);
      await refreshJobs();
    } catch (e) {
      console.error('Error creating print job', e);
    }
    setIsPrintTaskModalOpen(false);
  };

  const handleDelete = async () => {
    const idToDelete = printJobUID ?? job?.id;
    if (!idToDelete) return;
    try {
      setDeleting(true);
      await deletePrintJob(idToDelete);
      await refreshJobs();
      onClose();
    } catch (e) {
      console.error('Failed to delete print job', e);
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async () => {
    if (!job?.id) return onClose();
    try {
      const payload: any = {};
      if (selectedPrinter && selectedPrinter !== job.printer_id) payload.printer_id = selectedPrinter;
      if (selectedOttoeject && selectedOttoeject !== job.ottoeject_id) payload.ottoeject_id = selectedOttoeject;
      if (selectedOttorack && selectedOttorack !== job.assigned_rack_id) payload.rack_id = selectedOttorack;
      if (selectedStoreLocation && selectedStoreLocation !== job.assigned_store_slot) payload.store_location = selectedStoreLocation;
      if (selectedGrabLocation && selectedGrabLocation !== job.assigned_grab_slot) payload.grab_location = selectedGrabLocation;
      // Add future editable fields here
      if (Object.keys(payload).length > 0) {
        await updatePrintJob(Number(job.id), payload);
      }
      await refreshJobs();
    } catch (e) {
      console.error('Failed to save print job', e);
    } finally {
      onClose();
    }
  };

  const durationText = job?.duration || (details as any)?.duration || "-";
  const fileNameText = (job as any)?.fileName || (details as any)?.name || "-";
  const statusText = job?.status || (details as any)?.status || "Unknown";

  const title = isEdit ? 'EDIT PRINT JOB' : 'NEW PRINT JOB';

  return (
    <Modal isOpen={isOpen} className="pf-custom-new-print-job-modal" aria-label="printJobModal" onClose={onClose}>
      <PageSection className="pf-custom-new-print-job">
        <ModalHeader className="pf-custom-upload-header">
          <Content component={ContentVariants.h3}>
            <Brand src={PrintJobIcon} alt="Print job" className='pf-custom-upload-icon' />
            {` ${title}`}
          </Content>
        </ModalHeader>

        {isEdit ? (
          loading ? (
            <div className="pf-u-display-flex pf-u-justify-content-center pf-u-align-items-center" style={{ minHeight: 160 }}>
              <Spinner size="lg" />
            </div>
          ) : (
            <Grid hasGutter>
              <GridItem span={8}>
                <Form isHorizontal className="pf-custom-text-align-left">
                  <Content component={ContentVariants.h6}>{'DETAILS'}</Content>
                  <FormGroup className="pf-custom-formGroup" label="ID">{job?.id ?? '-'}</FormGroup>
                  <FormGroup className="pf-custom-formGroup" label="Filename">{fileNameText}</FormGroup>
                  <FormGroup className="pf-custom-formGroup" label="Status">{statusText}</FormGroup>
                  <FormGroup className="pf-custom-formGroup" label={<span className="pf-custom-duration"><img src={hourglass} alt="" className="pf-custom-duration-icon" />Duration</span>}>{durationText}</FormGroup>

                  <FormGroup className="pf-custom-formGroup" label="Linked Printer">
                    <select className="pf-custom-dropdown" value={selectedPrinter ?? ''} onChange={(e) => setSelectedPrinter(e.target.value ? Number(e.target.value) : null)}>
                      <option value="">Select a printer</option>
                      {printers.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                    </select>
                  </FormGroup>
                  <FormGroup className="pf-custom-formGroup" label="Linked Ottorack">
                    <select className="pf-custom-dropdown" value={selectedOttorack ?? ''} onChange={(e) => setSelectedOttorack(e.target.value ? Number(e.target.value) : null)}>
                      <option value="">Select an ottorack</option>
                      {ottoracks.map((rack) => (<option key={rack.id} value={rack.id}>{rack.name}</option>))}
                    </select>
                  </FormGroup>
                  {selectedOttorack && (
                    <>
                      <FormGroup className="pf-custom-formGroup" label="Store Location">
                        <select className="pf-custom-dropdown" value={selectedStoreLocation} onChange={(e) => setSelectedStoreLocation(Number(e.target.value))}>
                          {generateSlotOptions().map(slot => (
                            <option key={slot} value={slot}>Slot {slot}</option>
                          ))}
                        </select>
                      </FormGroup>
                      <FormGroup className="pf-custom-formGroup" label="Grab Location">
                        <select className="pf-custom-dropdown" value={selectedGrabLocation} onChange={(e) => setSelectedGrabLocation(Number(e.target.value))}>
                          {generateSlotOptions().map(slot => (
                            <option key={slot} value={slot}>Slot {slot}</option>
                          ))}
                        </select>
                      </FormGroup>
                    </>
                  )}
                </Form>
              </GridItem>
              <GridItem span={4}>
                <FormGroup>
                  <Brand src={thumbnail} alt={'print job thumbnail'} className="pf-custom-thumbnail" />
                </FormGroup>
              </GridItem>
              <GridItem span={12}>
                <div className="pf-c-form-group">
                  <span className="pf-custom-border-label"><strong>{'FILE: '}</strong></span>
                  <Content>{fileNameText}</Content>
                </div>
              </GridItem>
            </Grid>
          )
        ) : (
          <Grid hasGutter>
            <GridItem span={8}>
              <Form isHorizontal className="pf-custom-text-align-left">
                <Content component={ContentVariants.h6}>{'DETAILS'}</Content>
                <FormGroup className="pf-custom-formGroup" label={'ID: '}>{(printFile as any)?.id}</FormGroup>
                <FormGroup className="pf-custom-formGroup" label={'PRINTER: '}>
                  <select className="pf-custom-dropdown" value={selectedPrinter || ''} onChange={(e) => setSelectedPrinter(Number(e.target.value))}>
                    <option value="" disabled>Select a printer</option>
                    {printers.map((printer) => (
                      <option key={printer.id} value={printer.id}>{printer.name}</option>
                    ))}
                  </select>
                </FormGroup>
                <FormGroup className="pf-custom-formGroup" label="OTTOEJECT">
                  <select className="pf-custom-dropdown" value={selectedOttoeject || ''} onChange={(e) => setSelectedOttoeject(Number(e.target.value))}>
                    <option value="" disabled>Select an Ottoeject device</option>
                    {ottoeject.map((device) => (
                      <option key={device.id} value={device.id}>{device.device_name}</option>
                    ))}
                  </select>
                </FormGroup>
                <FormGroup className="pf-custom-formGroup" label="OTTORACK">
                  <select className="pf-custom-dropdown" value={selectedOttorack || ''} onChange={(e) => setSelectedOttorack(Number(e.target.value))}>
                    <option value="" disabled>Select an Ottorack</option>
                    {ottoracks.map((rack) => (
                      <option key={rack.id} value={rack.id}>{rack.name}</option>
                    ))}
                  </select>
                </FormGroup>
                {selectedOttorack && (
                  <>
                    <FormGroup className="pf-custom-formGroup" label="STORE LOCATION:">
                      <select className="pf-custom-dropdown" value={selectedStoreLocation} onChange={(e) => setSelectedStoreLocation(Number(e.target.value))}>
                        {generateSlotOptions().map(slot => (
                          <option key={slot} value={slot}>Slot {slot}</option>
                        ))}
                      </select>
                    </FormGroup>
                    <FormGroup className="pf-custom-formGroup" label="GRAB LOCATION:">
                      <select className="pf-custom-dropdown" value={selectedGrabLocation} onChange={(e) => setSelectedGrabLocation(Number(e.target.value))}>
                        {generateSlotOptions().map(slot => (
                          <option key={slot} value={slot}>Slot {slot}</option>
                        ))}
                      </select>
                    </FormGroup>
                  </>
                )}
                <FormGroup className="pf-custom-formGroup" label={'MATERIAL: '}>{(printFile as any)?.filament}</FormGroup>
                <FormGroup className="pf-custom-formGroup" label={'MATERIAL REQUIRED: '}>{(printFile as any)?.filament_weight}</FormGroup>
                <FormGroup className="pf-custom-formGroup" label={'DURATION: '}>{(printFile as any)?.duration}</FormGroup>
              </Form>
            </GridItem>
            <GridItem span={4}>
              <FormGroup>
                <Brand src={thumbnail} alt={'print job thumbnail'} className="pf-custom-thumbnail" />
              </FormGroup>
            </GridItem>
            <GridItem span={12}>
              <div className="pf-c-form-group">
                <span className="pf-custom-border-label"><strong>{'FILE: '}</strong></span>
                <Content>{(printFile as any)?.name}</Content>
              </div>
            </GridItem>
          </Grid>
        )}

        <ModalFooter className="pf-custom-new-print-job-modal-footer">
          {isEdit ? (
            <>
              <Button variant="danger" onClick={handleDelete} isLoading={deleting}>{deleting ? 'Deleting…' : 'Delete'}</Button>
              <Button variant="secondary" onClick={onClose} isDisabled={deleting}>Cancel</Button>
              <Button className="pf-custom-button" onClick={handleSave} isDisabled={deleting}>Save</Button>
            </>
          ) : (
            <>
              <Button isDisabled={(currentFiles?.length ?? 0) === 0} variant="danger" onClick={onClose}>Cancel</Button>
              <Button isDisabled={(currentFiles?.length ?? 0) === 0 || !selectedPrinter || !selectedOttoeject || !selectedOttorack} className="pf-custom-button" onClick={handleCreate}>CREATE</Button>
            </>
          )}
        </ModalFooter>
      </PageSection>
    </Modal>
  );
}
