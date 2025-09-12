export interface OttoejectRegistration {
    device_name: string;
    ip_address: string;
}
  
export interface OttoejectMacroPayload {
    macro: string;
}
  
export interface OttoejectDevice {
    id?: number;
    device_name?: string;
    ip_address?: string;
    status?: string;
}
  
export interface OttoejectStatus {
    status: string;
}
