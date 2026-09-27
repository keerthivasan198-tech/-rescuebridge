export interface Patient {
  id: string;
  name: string;
  maskedPhone: string;
  visitDate: string;
  visitId: string;
}

export interface PatientSession {
  sessionId: string;
  patientName: string;
  clinicName: string;
  visitDate: string;
  feedbackId?: string;
}
