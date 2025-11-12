import {
  Brand,
  Button,
  Content,
  ContentVariants,
  Form,
  FormGroup,
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
import { useContext, useEffect, useMemo, useState } from "react";
import { JobContext } from "../../App";
import ottoEjectIcon from '../../public/ottoEject-Icon.svg';
import thumbnail from '../../public/thumbnail.png';
import { OttoejectDevice } from "../../representations/ottoejectRepresentation";
import { deleteOttoeject, getOttoejectById, registerOttoeject, sendOttoejectMacro, testOttoejectConnection } from "../../ottoengine_API";

export default function OttoejectModal() {
  const {
    ottoeject,
    setOttoeject,
    ottoejectAddModalOpen,
    setIsOttoejectAddModalOpen,
    ottoejectEditModalOpen,
    setIsOttoejectEditModalOpen,
    ottoejectIndex
  } = useContext(JobContext);

  const isEdit = Boolean(ottoejectEditModalOpen);
  const isOpen = Boolean(ottoejectAddModalOpen || ottoejectEditModalOpen);
  const selected = useMemo<OttoejectDevice | undefined>(
    () => (isEdit && ottoejectIndex != null ? ottoeject[ottoejectIndex] : undefined),
    [isEdit, ottoejectIndex, ottoeject]
  );

  const [temp, setTemp] = useState<Partial<OttoejectDevice>>({});
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState<string | undefined>(undefined);
  const [testSuccess, setTestSuccess] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (!isOpen) return;
    setSubmitting(false);
    setTesting(false);
    setTestMessage(undefined);
    setTestSuccess(undefined);
    if (isEdit && selected) {
      setTemp({ ...selected });
    } else {
      setTemp({});
    }
  }, [isOpen, isEdit, selected]);

  const onClose = () => {
    if (isEdit) setIsOttoejectEditModalOpen(false);
    else setIsOttoejectAddModalOpen(false);
    setTemp({});
    setTestMessage(undefined);
    setTestSuccess(undefined);
    setSubmitting(false);
    setTesting(false);
  };

  const handleTestConnection = async () => {
    if (!temp?.ip_address) return;
    setTesting(true);
    setTestMessage(undefined);
    setTestSuccess(undefined);
    try {
      const res = await testOttoejectConnection({
        device_name: temp.device_name,
        ip_address: temp.ip_address,
      });
      setTestSuccess(res.connected || false);
      setTestMessage(res.message || (res.connected ? 'Connection successful' : 'Connection failed'));
    } catch (error: any) {
      setTestSuccess(false);
      setTestMessage(error.message || 'Connection failed');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    try {
      setSubmitting(true);
      if (isEdit && ottoejectIndex != null && selected) {
        // No backend update endpoint provided; update local state only
        setOttoeject(prev => {
          const copy = prev.slice();
          copy[ottoejectIndex] = { ...copy[ottoejectIndex], ...temp } as OttoejectDevice;
          return copy;
        });
        setIsOttoejectEditModalOpen(false);
      } else {
        // Create
        const created = await registerOttoeject(temp as any);
        const merged = created ? { ...(temp as any), ...created } : (temp as any);
        if (merged?.id) {
          try {
            const fresh = await getOttoejectById(merged.id);
            setOttoeject(prev => ([...(prev ?? []), fresh]));
          } catch {
            setOttoeject(prev => ([...(prev ?? []), merged]));
          }
        } else {
          setOttoeject(prev => ([...(prev ?? []), merged]));
        }
        setIsOttoejectAddModalOpen(false);
        setTemp({});
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!isEdit || ottoejectIndex == null || !selected) return;
    setSubmitting(true);
    try {
      if (selected.id != null) {
        try { await deleteOttoeject(selected.id); } catch {}
      }
      setOttoeject(prev => prev.filter((_, i) => i !== ottoejectIndex));
      setIsOttoejectEditModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleHome = async () => {
    if (!isEdit || !selected?.id) return;
    await sendOttoejectMacro(selected.id, { macro: "OTTOEJECT_HOME" });
  };

  const title = isEdit ? 'EDIT OTTOEJECT' : 'ADD NEW OTTOEJECT';

  return (
    <Modal
      isOpen={isOpen}
      className="pf-custom-new-ottoeject-modal"
      aria-label="ottoejectModal"
      onClose={onClose}
    >
      <PageSection className="pf-custom-new-ottoeject">
        <ModalHeader className="pf-custom-upload-header">
          <Content component={ContentVariants.h3}>
            <Brand src={ottoEjectIcon} alt="OttoEject logo" className='pf-custom-modal-icon' />
            {` ${title}`}
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
                    id='ottoeject-name'
                    placeholder=""
                    value={temp?.device_name || ''}
                    onChange={(_e, v: string) => setTemp(prev => ({ ...(prev || {}), device_name: v }))}
                  />
                </GridItem>
              </Grid>

              <div className="pf-c-form-group">
                <span className="pf-custom-border-label">{'CONNECTION: '}</span>
                <Grid>
                  <GridItem span={3}>
                    <Content>{'IP ADDRESS:'}</Content>
                  </GridItem>
                  <GridItem span={8}>
                    <TextInputGroup>
                      <TextInputGroupMain id='ottoeject-connection-ipaddress' value={temp?.ip_address || ''}
                        onChange={(_e, v: any) => setTemp(prev => ({ ...(prev || {}), ip_address: v }))} />
                    </TextInputGroup>
                  </GridItem>
                </Grid>
                <Grid>
                  <GridItem span={3}><Content>{''}</Content></GridItem>
                  <GridItem span={8}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
                      <Button
                        variant="secondary"
                        isDisabled={testing || !temp?.ip_address}
                        onClick={handleTestConnection}
                      >
                        {testing ? 'Testing…' : 'Test Connection'}
                      </Button>
                      {testMessage && (
                        <span style={{ color: testSuccess ? '#3E8635' : '#C9190B', fontWeight: 500 }}>
                          {testMessage}
                        </span>
                      )}
                    </div>
                  </GridItem>
                </Grid>
              </div>
            </Form>
          </GridItem>

          <GridItem span={4}>
            <FormGroup>
              <Brand src={thumbnail} alt={"ottoeject thumbnail"} className="pf-custom-thumbnail" />
              {isEdit && (
                <Content className="pf-custom-align-center"><strong>{temp?.status}</strong></Content>
              )}
            </FormGroup>
          </GridItem>
        </Grid>

        <ModalFooter className="pf-custom-new-ottoeject-modal-footer">
          {isEdit && (
            <Button variant="secondary" onClick={handleHome} isDisabled={submitting}>{'Home OTTOeject'}</Button>
          )}
          <Button variant="danger" onClick={onClose}>{'Cancel'}</Button>
          <Button className="pf-custom-button" variant="primary" isDisabled={submitting} onClick={handleSave}>
            {submitting ? (isEdit ? 'Saving…' : 'Adding…') : (isEdit ? 'Save' : 'ADD')}
          </Button>
          {isEdit && (
            <Button className="pf-custom-button" variant="danger" isDisabled={submitting} onClick={handleDelete}>{'Delete'}</Button>
          )}
        </ModalFooter>
      </PageSection>
    </Modal>
  );
}
