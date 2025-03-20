export default interface readFile {
    path?: string;
    relativePath?: string; 
    fileName?: string;
    data?: string;
    loadResult?: 'danger' | 'success';
    loadError?: DOMException;
}