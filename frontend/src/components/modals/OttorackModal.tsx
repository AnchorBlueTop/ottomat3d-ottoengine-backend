import {
  Brand,
  Button,
  Content,
  ContentVariants,
  Form,
  Grid,
  GridItem,
  Modal,
  ModalFooter,
  ModalHeader,
  NumberInput,
  PageSection,
  TextInput
} from "@patternfly/react-core";
import { useContext, useEffect, useMemo, useState } from "react";
import { JobContext } from "../../App";
import { OttoRack, OttoRackRegistration, Shelf } from "../../representations/ottorackRepresentation";
import RackVisualizer from "../rackVisualisation";
import OttoRackIcon from "../../public/ottorack-icon.png";
import { createOttorack, deleteOttorack, getOttorackById, updateOttorackMeta, updateOttorackShelf } from "../../ottoengine_API";

export default function OttorackModal() {
  const {
    ottorack,
    setOttorack,
    ottorackAddModalOpen,
    setIsOttorackAddModalOpen,
    ottorackEditModalOpen,
    setIsOttorackEditModalOpen,
    ottorackIndex
  } = useContext(JobContext);

  const isEdit = Boolean(ottorackEditModalOpen);
  const isOpen = Boolean(ottorackAddModalOpen || ottorackEditModalOpen);
  const selectedRack: OttoRack | undefined = useMemo(
    () => (isEdit && ottorackIndex != null ? ottorack[ottorackIndex] : undefined),
    [isEdit, ottorackIndex, ottorack]
  );

  // Local state
  const [tempOttorack, setTempOttorack] = useState<OttoRack>({ name: "" });
  const [tempShelf, setTempShelf] = useState<Shelf[]>([]);
  const minValue = 1;
  const maxValue = 6;
  const [value, setValue] = useState<number>(minValue);
  const [bedSize, setBedSize] = useState<string>("");
  const [shelfSpacingMm, setShelfSpacingMm] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const title = isEdit ? "EDIT OTTORACK" : "ADD NEW OTTORACK";

  // Initialize when opened
  useEffect(() => {
    if (!isOpen) return;
    if (isEdit && selectedRack) {
      // Populate edit fields from selected rack
      setTempOttorack({ name: selectedRack.name, shelves: selectedRack.shelves });
      const shelves = (selectedRack.shelves ?? []).map((s, i) => {
        const has_plate = (s as any)?.has_plate === true;
        const plate_state = (s as any)?.plate_state;
        const type: '' | 'empty_plate' = has_plate && plate_state === 'empty' ? 'empty_plate' : '';
        return { id: i + 1, type, occupied: type !== '' } as Shelf;
      });
      setTempShelf(shelves);
      setValue(Math.max(minValue, Math.min(maxValue, shelves.length || minValue)));
      setBedSize((selectedRack as any)?.bed_size || (selectedRack as any)?.bedSize || "");
      const spacing = (selectedRack as any)?.shelf_spacing_mm ?? (selectedRack as any)?.shelfSpacingMm;
      setShelfSpacingMm(spacing !== undefined && spacing !== null ? String(spacing) : "");
      setErrorMessage(null);
    } else {
      // New rack defaults
      setTempOttorack({ name: "" });
      setTempShelf(Array.from({ length: minValue }, (_, i) => ({ id: i + 1, type: '', occupied: false })));
      setValue(minValue);
      setBedSize("");
      setShelfSpacingMm("");
      setErrorMessage(null);
    }
  }, [isOpen, isEdit, selectedRack]);

  // Keep tempShelf length in sync with value
  useEffect(() => {
    setTempShelf(prev => {
      const next = [...prev];
      while (next.length < value) next.push({ id: next.length + 1, type: '', occupied: false });
      if (next.length > value) next.splice(value);
      return next.map((s, i) => ({ ...s, id: i + 1 }));
    });
  }, [value]);

  const onMinus = () => setValue(v => Math.max(minValue, v - 1));
  const onPlus = () => setValue(v => Math.min(maxValue, v + 1));

  const onClose = () => {
    if (isEdit) setIsOttorackEditModalOpen(false);
    else setIsOttorackAddModalOpen(false);
  };

  const handleShelfTypeChange = (shelfNumber: number, newType: '' | 'empty_plate' | 'build_plate') => {
    setTempShelf(prev => {
      const next = [...prev];
      const idx = next.findIndex(s => s.id === shelfNumber);
      const updated = { id: shelfNumber, type: newType, occupied: newType !== '' };
      if (idx !== -1) next[idx] = updated; else next.push(updated);
      return next;
    });
  };
  const handleShelfClick = (shelfNumber: number) => {
    setTempShelf(prev => {
      const next = [...prev];
      const idx = next.findIndex(shelf => shelf.id === shelfNumber);
      if (idx !== -1) {
        const cur = next[idx];
        next[idx] = cur.type === 'empty_plate' ? { ...cur, type: '', occupied: false } : { ...cur, type: 'empty_plate', occupied: true };
      } else {
        next.push({ id: shelfNumber, type: 'empty_plate', occupied: true });
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      if (isEdit && selectedRack?.id != null && ottorackIndex != null) {
        // Update meta
        const metaPayload: any = {};
        const newName = (tempOttorack?.name || '').trim();
        if (newName && newName !== selectedRack.name) metaPayload.name = newName;
        if (shelfSpacingMm !== '') metaPayload.shelfSpacingMm = Number(shelfSpacingMm);
        if (bedSize) metaPayload.bedSize = bedSize;
        if (Object.keys(metaPayload).length) await updateOttorackMeta(Number(selectedRack.id), metaPayload);

        // Update shelves
        const updates = tempShelf.map(s => {
          let has_plate = false as boolean;
          let plate_state: 'empty' | 'with_print' | null = null;
          if (s.type === 'empty_plate') { has_plate = true; plate_state = 'empty'; }
          else if (s.type === 'build_plate') { has_plate = true; plate_state = 'with_print'; }
          return updateOttorackShelf(Number(selectedRack.id), Number(s.id), { has_plate, plate_state, print_job_id: null });
        });
        await Promise.allSettled(updates);

        // Refresh
        const fresh = await getOttorackById(Number(selectedRack.id));
        const next = [...ottorack];
        next[ottorackIndex] = fresh;
        setOttorack(next);
        setIsOttorackEditModalOpen(false);
      } else {
        // Create
        const count = value;
        const shelves = Array.from({ length: count }, (_, i) => {
          const id = i + 1;
          const s = tempShelf.find(sh => sh.id === id);
          const type = s?.type === 'empty_plate' ? 'empty_plate' : '';
          return { id, type };
        });
        const registration: OttoRackRegistration = {
          name: (tempOttorack.name || '').trim(),
          number_of_shelves: count,
          bedSize: bedSize || undefined,
          shelfSpacingMm: shelfSpacingMm !== '' ? Number(shelfSpacingMm) : undefined,
          shelves,
        };
        const created = await createOttorack(registration);
        const rackId = created?.id ?? created?.ottorack_id;
        if (rackId) {
          const details = await getOttorackById(Number(rackId));
          setOttorack(prev => (prev ? [...prev, details] : [details]));
        } else {
          setOttorack(prev => (prev ? [...prev, created] : [created]));
        }
        setIsOttorackAddModalOpen(false);
        // Reset
        setTempOttorack({ name: '' });
        setTempShelf([]);
        setValue(minValue);
        setBedSize('');
        setShelfSpacingMm('');
      }
    } catch (e: any) {
      setErrorMessage(e?.message || 'Failed to save.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!isEdit || selectedRack?.id == null || ottorackIndex == null) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await deleteOttorack(Number(selectedRack.id));
    } catch (e) {
      console.warn('Delete API failed.', e);
    } finally {
      const next = ottorack.filter((_, i) => i !== ottorackIndex);
      setOttorack(next);
      setIsOttorackEditModalOpen(false);
      setSubmitting(false);
    }
  };

  const isSaveDisabled = !isEdit && !(tempOttorack.name || '').trim();

  return (
    <Modal isOpen={isOpen} className="pf-custom-new-ottorack-modal" aria-label="ottorackModal" onClose={onClose}>
      <PageSection className="pf-custom-new-ottorack">
        <ModalHeader className="pf-custom-upload-header">
          <Content component={ContentVariants.h3}>
            <Brand src={OttoRackIcon} alt="Ottorack logo" className='pf-custom-modal-icon' />
            {title}
          </Content>
        </ModalHeader>
        <div style={{ height: '3rem' }} />
        <Grid hasGutter>
          <GridItem span={8}>
            <Form isHorizontal>
              <Grid>
                <GridItem span={3}><Content>{'NAME:'}</Content></GridItem>
                <GridItem span={9}>
                  <TextInput id="ottorack-name" placeholder="Enter name" value={tempOttorack?.name || ''}
                    onChange={(_e, v) => setTempOttorack({ ...tempOttorack, name: v })} />
                </GridItem>
              </Grid>
              <Grid>
                <GridItem span={3}><Content>{'SHELVES:'}</Content></GridItem>
                <GridItem span={9}>
                  <NumberInput value={value} min={minValue} max={maxValue} onMinus={onMinus} onPlus={onPlus}
                    inputName="input" inputAriaLabel="number input" minusBtnAriaLabel="minus" plusBtnAriaLabel="plus" />
                </GridItem>
              </Grid>
              <Grid>
                <GridItem span={3}><Content>{'BED SIZE:'}</Content></GridItem>
                <GridItem span={9}>
                  <select id="ottorack-bed-size" value={bedSize} onChange={(e) => setBedSize(e.target.value)} className="pf-custom-dropdown">
                    <option value="">Select</option>
                    <option value="150 x 150">150 x 150</option>
                    <option value="256 x 256">256 x 256</option>
                  </select>
                </GridItem>
              </Grid>
              <Grid>
                <GridItem span={3}><Content>{'SHELF SPACING:'}</Content></GridItem>
                <GridItem span={9}>
                  <TextInput id="ottorack-shelf-spacing" placeholder="Enter spacing in mm" value={shelfSpacingMm}
                    onChange={(_e, v: string) => setShelfSpacingMm(v)} />
                </GridItem>
              </Grid>
            </Form>
          </GridItem>
          <GridItem span={4} className="pf-custom-rack-render">
            <RackVisualizer
              shelves={tempShelf}
              count={value}
              onTypeChange={handleShelfTypeChange}
              onShelfClick={handleShelfClick}
              includeBuildPlateOption={false}
            />
          </GridItem>
        </Grid>
        <ModalFooter>
          <Button variant="danger" onClick={onClose}>{'Cancel'}</Button>
          <Button className="pf-custom-button" isDisabled={submitting || isSaveDisabled} onClick={handleSave}>
            {submitting ? 'Saving…' : (isEdit ? 'Save' : 'CREATE')}
          </Button>
          {isEdit && (
            <Button className="pf-custom-button" variant="danger" isDisabled={submitting} onClick={handleDelete}>
              {submitting ? 'Deleting…' : 'Delete'}
            </Button>
          )}
        </ModalFooter>
        {errorMessage && <p style={{ color: 'red' }}>{errorMessage}</p>}
      </PageSection>
    </Modal>
  );
}
