import {
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
import { useContext, useState, useEffect } from "react";
import { JobContext } from "../../App.tsx";
import { OttoRack, Shelf } from "../../representations/ottorackRepresentation.ts";
import RackVisualizer from '../rackVisualisation';
export default function editOttorack() {
    const { ottorack, setOttorack, ottorackEditModalOpen, setIsOttorackEditModalOpen, ottorackIndex } = useContext(JobContext);
    const [tempOttorack, setTempOttorack] = useState<OttoRack>({ name: '' });
    // Remove rackVis
    // const [rackVis, setRackVis] = useState<any[]>([]);
    const [selectedShelf, setSelectedShelf] = useState<number | null>(null);

    const [tempShelf, setTempShelf] = useState<Shelf[]>([]);
    const minValue = 1;
    const maxValue = 6;
    const [value, setValue] = useState<number>(minValue);

    const editOttorackSave = () => {
        setTempOttorack({ ...tempOttorack, shelves: tempShelf });
        if (tempOttorack) {
            ottorack[ottorackIndex!] = { ...tempOttorack, shelves: tempShelf };
        }
        setOttorack([...ottorack]);
    };

    const deletingOttorack = (id: any) => {
        delete ottorack[id];
        setOttorack([...ottorack]);
    };

    const normalizeBetween = (val: number, min: number, max: number) =>
        Math.max(Math.min(val, max), min);

    // Keep tempShelf length in sync with `value`
    useEffect(() => {
        setTempShelf(prev => {
            const next = [...prev];
            while (next.length < value) next.push({ id: next.length + 1, type: '', occupied: false });
            if (next.length > value) next.splice(value);
            return next.map((s, i) => ({ ...s, id: i + 1 }));
        });
    }, [value]);

    const onMinus = () => {
        const newValue = normalizeBetween(value - 1, minValue, maxValue);
        setValue(newValue);
    };

    const onPlus = () => {
        const newValue = normalizeBetween(value + 1, minValue, maxValue);
        setValue(newValue);
    };

    // Optional direct input handlers if you enable free typing
    // const onChange = (_e: React.FormEvent<HTMLInputElement>, v?: string) => {
    //   const n = Number(v ?? value);
    //   if (!Number.isNaN(n)) setValue(n);
    // };
    // const onBlur = (_e: any) => setValue(normalizeBetween(value, minValue, maxValue));

    const handleShelfTypeChange = (shelfNumber: number, newType: '' | 'empty_plate' | 'build_plate') => {
        setTempShelf(prev => {
          const next = [...prev];
          const idx = next.findIndex(s => s.id === shelfNumber);
          const updated = { id: shelfNumber, type: newType, occupied: newType === 'empty_plate' };
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
                next[idx] = cur.type === "empty_plate"
                    ? { ...cur, type: "", occupied: false }
                    : { ...cur, type: "empty_plate", occupied: true };
            } else {
                next.push({ id: shelfNumber, type: "empty_plate", occupied: true });
            }
            return next;
        });
        setSelectedShelf(shelfNumber);
    };

    useEffect(() => {
        if (!ottorackEditModalOpen) return;
        if (ottorackIndex !== undefined && ottorackIndex !== null) {
            const src = ottorack[ottorackIndex];
            const shelves = (src?.shelves ?? []).map((s, i) => ({
                id: i + 1,
                type: s.type ?? '',
                occupied: !!s.occupied
            }));
            setTempOttorack({ name: src?.name ?? '', shelves });
            setTempShelf(shelves);
            setValue(Math.max(minValue, Math.min(maxValue, shelves.length || minValue)));
        }
    }, [ottorackEditModalOpen, ottorackIndex]);

    return (
        <Modal
            isOpen={ottorackEditModalOpen}
            className="pf-custom-new-ottorack-modal"
            aria-label="newOttorack"
            onClose={() => setIsOttorackEditModalOpen(false)}
        >
            <PageSection className="pf-custom-new-ottorack">
                <ModalHeader className="pf-custom-upload-header">
                    <Content component={ContentVariants.h3}>
                        {'EDIT OTTORACK'}
                    </Content>
                </ModalHeader>
                <div style={{ height: '3rem' }} />
                <Grid hasGutter>
                    <GridItem span={8}>
                        <Form isHorizontal className="pf-custom-text-align-left">
                            <Grid>
                                <GridItem span={3}>
                                    <Content>{'NAME:'}</Content>
                                </GridItem>
                                <GridItem span={8}>
                                    <TextInput
                                        id='ottorack-name'
                                        placeholder=""
                                        value={tempOttorack?.name || ''}
                                        onChange={(_event, v) => setTempOttorack({ ...tempOttorack, name: v })}
                                    />
                                </GridItem>
                            </Grid>

                            <div className="pf-c-form-group">
                                <span className="pf-custom-border-label">{'SHELF CONFIGURATION: '}</span>
                                <Grid>
                                    <GridItem span={3}>
                                        <Content>{'SHELVES:'}</Content>
                                    </GridItem>
                                    <GridItem span={8}>
                                        <NumberInput
                                            value={value}
                                            min={minValue}
                                            max={maxValue}
                                            onMinus={onMinus}
                                            onPlus={onPlus}
                                            inputName="input"
                                            inputAriaLabel="number input"
                                            minusBtnAriaLabel="minus"
                                            plusBtnAriaLabel="plus"
                                        />
                                    </GridItem>
                                </Grid>
                            </div>
                        </Form>
                    </GridItem>

                    <GridItem span={4} className="pf-custom-rack-render">
                        <RackVisualizer
                            count={value}
                            shelves={tempShelf}
                            onTypeChange={handleShelfTypeChange}
                            onShelfClick={handleShelfClick}
                        />
                    </GridItem>
                </Grid>

                <ModalFooter className="pf-custom-new-ottorack-modal-footer">
                    <Button
                        variant="secondary"
                        onClick={() => { setIsOttorackEditModalOpen(false); }}
                    >
                        {'Cancel'}
                    </Button>
                    <Button
                        className="pf-custom-button"
                        onClick={() => {
                            editOttorackSave();
                            setIsOttorackEditModalOpen(false);
                            setTempOttorack({ name: '' });
                        }}
                    >
                        {'Save'}
                    </Button>
                    <Button
                        className="pf-custom-button"
                        variant="danger"
                        onClick={() => {
                            deletingOttorack(ottorack[ottorackIndex!].id);
                            setIsOttorackEditModalOpen(false);
                            setTempOttorack({ name: '' });
                        }}
                    >
                        {'Delete'}
                    </Button>
                </ModalFooter>
            </PageSection>
        </Modal>
    );
}